import { Hono } from "hono";
import { and, desc, eq, like, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { requireRole } from "../middleware/auth";

export type PaymentsEnv = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const paymentsRouter = new Hono<{
  Bindings: PaymentsEnv;
  Variables: Variables;
}>();

const PAYMENT_STATUSES = [
  "pending_verification",
  "verified",
  "rejected",
] as const;
type PaymentRecordStatus = (typeof PAYMENT_STATUSES)[number];

const PAYMENT_METHODS = [
  "bank_transfer",
  "credit_card",
  "cash",
  "ewallet",
  "other",
] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  );
}

/**
 * Recalculates an invoice's financial state after payment verification:
 * paidAmount = sum of VERIFIED payments; status follows the balance.
 */
async function recalcInvoiceFromPayments(
  db: DrizzleD1Database<typeof schema>,
  invoiceId: string,
): Promise<void> {
  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .all();
  if (!invoice) return;

  const verified = await db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.invoiceId, invoiceId),
        eq(schema.payments.status, "verified"),
      ),
    )
    .all();

  const paidAmount = verified.reduce((s, p) => s + p.amount, 0);
  const balanceDue = Math.max(0, invoice.total - paidAmount);

  let status = invoice.status;
  if (status !== "draft" && status !== "void") {
    status = balanceDue === 0 ? "paid" : paidAmount > 0 ? "partially_paid" : "issued";
  }

  await db
    .update(schema.invoices)
    .set({
      paidAmount,
      balanceDue,
      status,
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    })
    .where(eq(schema.invoices.id, invoiceId))
    .run();
}

// GET /payments — list with filters, search, pagination.
paymentsRouter.get(
  "/",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");

    const status = c.req.query("status");
    const invoiceId = c.req.query("invoiceId");
    const method = c.req.query("method");
    const q = c.req.query("q")?.trim();
    const limit = Math.min(
      Math.max(Number(c.req.query("limit") ?? "50"), 1),
      200,
    );
    const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

    const conditions = [];
    if (
      status &&
      (PAYMENT_STATUSES as readonly string[]).includes(status)
    ) {
      conditions.push(
        eq(
          schema.payments.status,
          status as PaymentRecordStatus,
        ),
      );
    }
    if (invoiceId) conditions.push(eq(schema.payments.invoiceId, invoiceId));
    if (method && isPaymentMethod(method)) {
      conditions.push(eq(schema.payments.method, method));
    }
    if (q) {
      conditions.push(
        or(
          like(schema.payments.reference, `%${q}%`),
          like(schema.payments.notes, `%${q}%`),
        )!,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, total] = await Promise.all([
      db
        .select()
        .from(schema.payments)
        .where(where)
        .orderBy(desc(schema.payments.paidAt))
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ count: schema.payments.id })
        .from(schema.payments)
        .where(where)
        .all(),
    ]);

    return c.json({
      success: true,
      data: rows,
      pagination: { total: total.length, limit, offset },
    });
  },
);

// POST /payments — record a customer payment (multipart with optional proof).
// Fields: invoiceId, amount, method, reference?, notes?, verifyNow? ("true").
// File: "proof" (image/pdf) stored to R2 under payments/<paymentId>/<uuid>.
paymentsRouter.post("/", requireRole("sales", "management", "finance"), async (c) => {
  const db = c.get("db");

  const contentType = c.req.header("content-type") ?? "";
  let invoiceId = "";
  let amount = 0;
  let method: PaymentMethod = "bank_transfer";
  let reference: string | null = null;
  let notes: string | null = null;
  let verifyNow = false;
  let proofFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await c.req.formData();
    invoiceId = (form.get("invoiceId") as string | null) ?? "";
    amount = Number(form.get("amount") ?? "0");
    const methodRaw = (form.get("method") as string | null) ?? "bank_transfer";
    if (isPaymentMethod(methodRaw)) method = methodRaw;
    reference = (form.get("reference") as string | null) ?? null;
    notes = (form.get("notes") as string | null) ?? null;
    verifyNow = (form.get("verifyNow") as string | null) === "true";
    const file = form.get("proof");
    if (file instanceof File && file.size > 0) proofFile = file;
  } else {
    const body = (await c.req.json<{
      invoiceId: string;
      amount: number;
      method?: PaymentMethod;
      reference?: string;
      notes?: string;
      verifyNow?: boolean;
      createdBy?: string;
    }>());
    invoiceId = body.invoiceId;
    amount = body.amount;
    if (body.method && isPaymentMethod(body.method)) method = body.method;
    reference = body.reference ?? null;
    notes = body.notes ?? null;
    verifyNow = body.verifyNow ?? false;
  }

  if (!invoiceId) {
    return c.json({ success: false, error: "invoiceId is required" }, 400);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return c.json(
      { success: false, error: "amount must be a positive number" },
      400,
    );
  }

  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .all();
  if (!invoice) {
    return c.json({ success: false, error: "Invoice not found" }, 404);
  }
  if (invoice.status === "void" || invoice.status === "draft") {
    return c.json(
      {
        success: false,
        error: `Cannot record a payment on a ${invoice.status} invoice`,
      },
      409,
    );
  }

  const payment: schema.NewPaymentRow = {
    id: crypto.randomUUID(),
    invoiceId,
    amount: Math.floor(amount),
    method,
    status: verifyNow ? "verified" : "pending_verification",
    verifiedBy: verifyNow
      ? (c.req.header("x-user-role") ?? "system")
      : null,
    verifiedAt: verifyNow
      ? new Date().toISOString().replace("T", " ").slice(0, 19)
      : null,
    proofKey: null,
    proofUploaded: false,
    reference,
    notes,
    createdBy: (c.req.header("x-user-id") ?? "system") as string | null,
  };

  // Optional proof upload to R2.
  if (proofFile) {
    const ext = proofFile.name.includes(".")
      ? proofFile.name.slice(proofFile.name.lastIndexOf("."))
      : "";
    const r2Key = `payments/${payment.id}/proof-${crypto.randomUUID()}${ext}`;
    const bytes = await proofFile.arrayBuffer();
    await c.env.DOCUMENTS.put(r2Key, bytes, {
      httpMetadata: {
        contentType: proofFile.type || "application/octet-stream",
      },
    });
    payment.proofKey = r2Key;
    payment.proofUploaded = true;
  }

  await db.insert(schema.payments).values(payment).run();

  if (verifyNow) {
    await recalcInvoiceFromPayments(db, invoiceId);
  }

  await logAudit(db, {
    actor: payment.createdBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "payment.create",
    entityType: "payment",
    entityId: payment.id,
    detail: `Payment ${payment.amount} recorded on ${invoice.number} (${payment.status})`,
  });

  return c.json({ success: true, data: payment }, 201);
});

// GET /payments/:id — single payment.
paymentsRouter.get(
  "/:id",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, id))
      .all();
    if (!payment) {
      return c.json({ success: false, error: "Payment not found" }, 404);
    }

    return c.json({ success: true, data: payment });
  },
);

// GET /payments/:id/proof — stream the proof file from R2.
paymentsRouter.get(
  "/:id/proof",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, id))
      .all();
    if (!payment) {
      return c.json({ success: false, error: "Payment not found" }, 404);
    }
    if (!payment.proofKey) {
      return c.json(
        { success: false, error: "No proof uploaded for this payment" },
        404,
      );
    }

    const object = await c.env.DOCUMENTS.get(payment.proofKey);
    if (!object) {
      return c.json(
        { success: false, error: "Proof file missing from storage" },
        404,
      );
    }

    return new Response(object.body, {
      headers: {
        "content-type":
          object.httpMetadata?.contentType ?? "application/octet-stream",
        "content-disposition": `inline; filename="proof-${payment.id}"`,
      },
    });
  },
);

// POST /payments/:id/verify — approve a pending payment.
// Cascades: invoice paidAmount/balanceDue/status recalculation.
paymentsRouter.post("/:id/verify", requireRole("finance", "management"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, id))
    .all();
  if (!payment) {
    return c.json({ success: false, error: "Payment not found" }, 404);
  }
  if (payment.status !== "pending_verification") {
    return c.json(
      {
        success: false,
        error: `Only pending payments can be verified (current: ${payment.status})`,
      },
      409,
    );
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .update(schema.payments)
    .set({
      status: "verified",
      verifiedBy: c.req.header("x-user-id") ?? "system",
      verifiedAt: now,
    })
    .where(eq(schema.payments.id, id))
    .run();

  // Cascade to the invoice.
  await recalcInvoiceFromPayments(db, payment.invoiceId);

  await logAudit(db, {
    actor: c.req.header("x-user-id") ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "payment.verify",
    entityType: "payment",
    entityId: id,
    detail: `Payment ${payment.amount} verified on invoice ${payment.invoiceId}`,
  });

  return c.json({ success: true, data: { id, status: "verified" } });
});

// POST /payments/:id/reject — reject a pending payment (no invoice impact).
paymentsRouter.post("/:id/reject", requireRole("finance", "management"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [payment] = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, id))
    .all();
  if (!payment) {
    return c.json({ success: false, error: "Payment not found" }, 404);
  }
  if (payment.status !== "pending_verification") {
    return c.json(
      {
        success: false,
        error: `Only pending payments can be rejected (current: ${payment.status})`,
      },
      409,
    );
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .update(schema.payments)
    .set({
      status: "rejected",
      verifiedBy: c.req.header("x-user-id") ?? "system",
      verifiedAt: now,
    })
    .where(eq(schema.payments.id, id))
    .run();

  await logAudit(db, {
    actor: c.req.header("x-user-id") ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "payment.reject",
    entityType: "payment",
    entityId: id,
    detail: `Payment ${payment.amount} rejected on invoice ${payment.invoiceId}`,
  });

  return c.json({ success: true, data: { id, status: "rejected" } });
});

export default paymentsRouter;

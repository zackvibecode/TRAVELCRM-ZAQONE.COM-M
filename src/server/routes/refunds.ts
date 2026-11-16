import { Hono } from "hono";
import { and, desc, eq, like } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { requireRole } from "../middleware/auth";

export type RefundsEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const refundsRouter = new Hono<{
  Bindings: RefundsEnv;
  Variables: Variables;
}>();

const REFUND_STATUSES = [
  "requested",
  "processing",
  "completed",
  "rejected",
] as const;
type RefundStatus = (typeof REFUND_STATUSES)[number];

function isRefundStatus(value: unknown): value is RefundStatus {
  return (
    typeof value === "string" &&
    (REFUND_STATUSES as readonly string[]).includes(value)
  );
}

/** Sequential refund number: REF-<year>-<0001>. */
async function nextRefundNumber(
  db: DrizzleD1Database<typeof schema>,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REF-${year}-`;

  const rows = await db
    .select({ number: schema.refunds.number })
    .from(schema.refunds)
    .where(like(schema.refunds.number, `${prefix}%`))
    .all();

  let max = 0;
  for (const row of rows) {
    const seq = Number(row.number.slice(prefix.length));
    if (!Number.isNaN(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

// GET /refunds — list with filters and pagination.
refundsRouter.get(
  "/",
  requireRole("management", "finance"),
  async (c) => {
    const db = c.get("db");

    const status = c.req.query("status");
    const invoiceId = c.req.query("invoiceId");
    const limit = Math.min(
      Math.max(Number(c.req.query("limit") ?? "50"), 1),
      200,
    );
    const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

    const conditions = [];
    if (status && isRefundStatus(status)) {
      conditions.push(eq(schema.refunds.status, status));
    }
    if (invoiceId) conditions.push(eq(schema.refunds.invoiceId, invoiceId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, total] = await Promise.all([
      db
        .select()
        .from(schema.refunds)
        .where(where)
        .orderBy(desc(schema.refunds.requestedAt))
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ count: schema.refunds.id })
        .from(schema.refunds)
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

// GET /refunds/:id — single refund.
refundsRouter.get(
  "/:id",
  requireRole("management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [refund] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, id))
      .all();
    if (!refund) {
      return c.json({ success: false, error: "Refund not found" }, 404);
    }

    return c.json({ success: true, data: refund });
  },
);

// POST /refunds — request a refund.
// Constraint: amount cannot exceed the invoice's total verified payments
// minus already-refunded (completed) amounts.
refundsRouter.post("/", requireRole("finance", "management"), async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<{
    invoiceId: string;
    amount: number;
    reason: string;
    paymentId?: string;
    createdBy?: string;
  }>());

  if (!body.invoiceId) {
    return c.json({ success: false, error: "invoiceId is required" }, 400);
  }
  if (!Number.isFinite(body.amount) || body.amount <= 0) {
    return c.json(
      { success: false, error: "amount must be a positive number" },
      400,
    );
  }
  if (!body.reason?.trim()) {
    return c.json({ success: false, error: "reason is required" }, 400);
  }

  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, body.invoiceId))
    .all();
  if (!invoice) {
    return c.json({ success: false, error: "Invoice not found" }, 404);
  }

  // Refundable = verified payments − completed refunds.
  const completedRefunds = await db
    .select()
    .from(schema.refunds)
    .where(
      and(
        eq(schema.refunds.invoiceId, body.invoiceId),
        eq(schema.refunds.status, "completed"),
      ),
    )
    .all();
  const alreadyRefunded = completedRefunds.reduce((s, r) => s + r.amount, 0);
  const refundable = invoice.paidAmount - alreadyRefunded;

  if (refundable <= 0) {
    return c.json(
      {
        success: false,
        error: "No refundable balance — the invoice has no verified payments left",
      },
      409,
    );
  }
  if (body.amount > refundable) {
    return c.json(
      {
        success: false,
        error: `Refund exceeds refundable balance (${refundable})`,
        data: { refundable },
      },
      422,
    );
  }

  const refund: schema.NewRefundRow = {
    id: crypto.randomUUID(),
    number: await nextRefundNumber(db),
    invoiceId: body.invoiceId,
    paymentId: body.paymentId ?? null,
    amount: Math.floor(body.amount),
    reason: body.reason.trim(),
    status: "requested",
  };

  await db.insert(schema.refunds).values(refund).run();
  await logAudit(db, {
    actor: body.createdBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "refund.request",
    entityType: "refund",
    entityId: refund.id,
    detail: `Refund ${refund.number} requested for ${refund.amount} on ${invoice.number}`,
  });

  return c.json({ success: true, data: refund }, 201);
});

// POST /refunds/:id/process — requested → processing.
refundsRouter.post(
  "/:id/process",
  requireRole("finance", "management"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [refund] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, id))
      .all();
    if (!refund) {
      return c.json({ success: false, error: "Refund not found" }, 404);
    }
    if (refund.status !== "requested") {
      return c.json(
        {
          success: false,
          error: `Only requested refunds can be processed (current: ${refund.status})`,
        },
        409,
      );
    }

    await db
      .update(schema.refunds)
      .set({ status: "processing" })
      .where(eq(schema.refunds.id, id))
      .run();
    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "refund.process",
      entityType: "refund",
      entityId: id,
      detail: `Refund ${refund.number} moved to processing`,
    });

    return c.json({ success: true, data: { id, status: "processing" } });
  },
);

// POST /refunds/:id/complete — processing → completed.
// Cascade: reduces the invoice's paidAmount and restores balanceDue;
// invoice status is recomputed (paid → partially_paid, etc.).
refundsRouter.post(
  "/:id/complete",
  requireRole("finance", "management"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [refund] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, id))
      .all();
    if (!refund) {
      return c.json({ success: false, error: "Refund not found" }, 404);
    }
    if (refund.status !== "processing") {
      return c.json(
        {
          success: false,
          error: `Only processing refunds can be completed (current: ${refund.status})`,
        },
        409,
      );
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await db
      .update(schema.refunds)
      .set({
        status: "completed",
        processedAt: now,
        processedBy: c.req.header("x-user-id") ?? "system",
      })
      .where(eq(schema.refunds.id, id))
      .run();

    // Cascade: pull the refunded amount out of the invoice's paid balance.
    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, refund.invoiceId))
      .all();
    if (invoice) {
      const paidAmount = Math.max(0, invoice.paidAmount - refund.amount);
      const balanceDue = Math.max(0, invoice.total - paidAmount);
      let status = invoice.status;
      if (status !== "draft" && status !== "void") {
        status =
          balanceDue === 0
            ? "paid"
            : paidAmount > 0
              ? "partially_paid"
              : "issued";
      }
      await db
        .update(schema.invoices)
        .set({
          paidAmount,
          balanceDue,
          status,
          updatedAt: now,
        })
        .where(eq(schema.invoices.id, invoice.id))
        .run();
    }

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "refund.complete",
      entityType: "refund",
      entityId: id,
      detail: `Refund ${refund.number} completed — ${refund.amount} returned on ${invoice?.number ?? refund.invoiceId}`,
    });

    return c.json({
      success: true,
      data: { id, status: "completed" },
    });
  },
);

// POST /refunds/:id/reject — requested/processing → rejected (no balance impact).
refundsRouter.post(
  "/:id/reject",
  requireRole("finance", "management"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [refund] = await db
      .select()
      .from(schema.refunds)
      .where(eq(schema.refunds.id, id))
      .all();
    if (!refund) {
      return c.json({ success: false, error: "Refund not found" }, 404);
    }
    if (refund.status === "completed" || refund.status === "rejected") {
      return c.json(
        {
          success: false,
          error: `Refund already ${refund.status}`,
        },
        409,
      );
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await db
      .update(schema.refunds)
      .set({
        status: "rejected",
        processedAt: now,
        processedBy: c.req.header("x-user-id") ?? "system",
      })
      .where(eq(schema.refunds.id, id))
      .run();
    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "refund.reject",
      entityType: "refund",
      entityId: id,
      detail: `Refund ${refund.number} rejected`,
    });

    return c.json({ success: true, data: { id, status: "rejected" } });
  },
);

export default refundsRouter;

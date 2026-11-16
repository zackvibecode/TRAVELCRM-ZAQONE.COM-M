import { Hono } from "hono";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { requireRole } from "../middleware/auth";
import { normalizePhone, whatsappLink } from "../lib/phone";

export type QuotationsEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const quotationsRouter = new Hono<{
  Bindings: QuotationsEnv;
  Variables: Variables;
}>();

const QUOTATION_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
] as const;
type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

function isQuotationStatus(value: unknown): value is QuotationStatus {
  return (
    typeof value === "string" &&
    (QUOTATION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Sequential quotation number: QTN-<year>-<0001>. The year comes from the
 * current date; the sequence resets naturally each year via the LIKE bound.
 */
async function nextQuotationNumber(
  db: DrizzleD1Database<typeof schema>,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QTN-${year}-`;

  const rows = await db
    .select({ number: schema.quotations.number })
    .from(schema.quotations)
    .where(like(schema.quotations.number, `${prefix}%`))
    .all();

  let max = 0;
  for (const row of rows) {
    const seq = Number(row.number.slice(prefix.length));
    if (!Number.isNaN(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

interface QuotationItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface CreateQuotationInput {
  customerName: string;
  customerPhone?: string;
  packageName?: string;
  destination?: string;
  paxAdult?: number;
  paxChild?: number;
  paxInfant?: number;
  departureDate?: string;
  validUntil?: string;
  discount?: number;
  leadId?: string;
  items: QuotationItemInput[];
  createdBy?: string;
}

interface UpdateQuotationInput {
  customerName?: string;
  customerPhone?: string | null;
  packageName?: string | null;
  destination?: string | null;
  paxAdult?: number;
  paxChild?: number;
  paxInfant?: number;
  departureDate?: string | null;
  validUntil?: string | null;
  discount?: number;
  status?: QuotationStatus;
  updatedBy?: string;
}

// GET /quotations — list with filters, search, pagination.
quotationsRouter.get(
  "/",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");

    const status = c.req.query("status");
    const leadId = c.req.query("leadId");
    const q = c.req.query("q")?.trim();
    const limit = Math.min(
      Math.max(Number(c.req.query("limit") ?? "50"), 1),
      200,
    );
    const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

    const conditions = [];
    if (status && isQuotationStatus(status)) {
      conditions.push(eq(schema.quotations.status, status));
    }
    if (leadId) conditions.push(eq(schema.quotations.leadId, leadId));
    if (q) {
      conditions.push(
        or(
          like(schema.quotations.number, `%${q}%`),
          like(schema.quotations.customerName, `%${q}%`),
          like(schema.quotations.packageName, `%${q}%`),
        )!,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, total] = await Promise.all([
      db
        .select()
        .from(schema.quotations)
        .where(where)
        .orderBy(desc(schema.quotations.createdAt))
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ count: schema.quotations.id })
        .from(schema.quotations)
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

// GET /quotations/:id — single quotation.
quotationsRouter.get(
  "/:id",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [quotation] = await db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.id, id))
      .all();
    if (!quotation) {
      return c.json({ success: false, error: "Quotation not found" }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...quotation,
        whatsapp: quotation.customerPhone
          ? whatsappLink(
              quotation.customerPhone,
              `Halo ${quotation.customerName}, berikut penawaran ${quotation.packageName ?? "perjalanan Anda"}: ${quotation.number}, total ${quotation.total}.`,
            )
          : null,
      },
    });
  },
);

// POST /quotations — create with sequential number and computed totals.
quotationsRouter.post("/", requireRole("sales", "management"), async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<CreateQuotationInput>()) as CreateQuotationInput;

  if (!body.customerName?.trim()) {
    return c.json({ success: false, error: "customerName is required" }, 400);
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return c.json(
      { success: false, error: "at least one item is required" },
      400,
    );
  }
  if (body.items.some((i) => !i.description?.trim() || i.quantity < 1)) {
    return c.json(
      { success: false, error: "items must have descriptions and qty >= 1" },
      400,
    );
  }
  if (body.status && !isQuotationStatus(body.status)) {
    return c.json({ success: false, error: "Invalid status" }, 400);
  }

  const subtotal = body.items.reduce(
    (s, i) => s + i.quantity * Math.max(0, i.unitPrice),
    0,
  );
  const discount = Math.max(0, body.discount ?? 0);
  const total = Math.max(0, subtotal - discount);

  const quotation: schema.NewQuotationRow = {
    id: crypto.randomUUID(),
    number: await nextQuotationNumber(db),
    customerName: body.customerName.trim(),
    customerPhone: body.customerPhone
      ? normalizePhone(body.customerPhone)
      : null,
    packageName: body.packageName ?? null,
    destination: body.destination ?? null,
    paxAdult: body.paxAdult ?? 0,
    paxChild: body.paxChild ?? 0,
    paxInfant: body.paxInfant ?? 0,
    departureDate: body.departureDate ?? null,
    status: "draft",
    validUntil: body.validUntil ?? null,
    subtotal,
    discount,
    total,
    leadId: body.leadId ?? null,
    createdBy: body.createdBy ?? null,
  };

  await db.insert(schema.quotations).values(quotation).run();
  await logAudit(db, {
    actor: body.createdBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "quotation.create",
    entityType: "quotation",
    entityId: quotation.id,
    detail: `Quotation ${quotation.number} created for ${quotation.customerName} (total ${total})`,
  });

  return c.json({ success: true, data: quotation }, 201);
});

// PATCH /quotations/:id — update fields or transition status.
// Status transitions: draft → sent → accepted/rejected; rejected/expired → draft.
quotationsRouter.patch(
  "/:id",
  requireRole("sales", "management"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = (await c.req.json<UpdateQuotationInput>()) as UpdateQuotationInput;

    const [existing] = await db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.id, id))
      .all();
    if (!existing) {
      return c.json({ success: false, error: "Quotation not found" }, 404);
    }

    if (body.status !== undefined) {
      if (!isQuotationStatus(body.status)) {
        return c.json({ success: false, error: "Invalid status" }, 400);
      }
      const allowed: Record<QuotationStatus, QuotationStatus[]> = {
        draft: ["sent", "rejected"],
        sent: ["accepted", "rejected", "draft"],
        accepted: [],
        rejected: ["draft"],
        expired: ["draft"],
      };
      if (
        body.status !== existing.status &&
        !allowed[existing.status].includes(body.status)
      ) {
        return c.json(
          {
            success: false,
            error: `Invalid transition ${existing.status} → ${body.status}`,
          },
          422,
        );
      }
    }

    const patch: Partial<schema.NewQuotationRow> = {
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    };
    if (body.customerName !== undefined)
      patch.customerName = body.customerName.trim();
    if (body.customerPhone !== undefined) {
      patch.customerPhone = body.customerPhone
        ? normalizePhone(body.customerPhone)
        : null;
    }
    if (body.packageName !== undefined) patch.packageName = body.packageName;
    if (body.destination !== undefined) patch.destination = body.destination;
    if (body.paxAdult !== undefined) patch.paxAdult = body.paxAdult;
    if (body.paxChild !== undefined) patch.paxChild = body.paxChild;
    if (body.paxInfant !== undefined) patch.paxInfant = body.paxInfant;
    if (body.departureDate !== undefined)
      patch.departureDate = body.departureDate;
    if (body.validUntil !== undefined) patch.validUntil = body.validUntil;
    if (body.discount !== undefined) {
      patch.discount = Math.max(0, body.discount);
      patch.total = Math.max(0, existing.subtotal - Math.max(0, body.discount));
    }
    if (body.status !== undefined) patch.status = body.status;

    await db
      .update(schema.quotations)
      .set(patch)
      .where(eq(schema.quotations.id, id))
      .run();
    await logAudit(db, {
      actor: body.updatedBy ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "quotation.update",
      entityType: "quotation",
      entityId: id,
      detail: body.status
        ? `Quotation ${existing.number}: ${existing.status} → ${body.status}`
        : `Quotation ${existing.number} updated`,
    });

    const [updated] = await db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.id, id))
      .all();
    return c.json({ success: true, data: updated });
  },
);

// DELETE /quotations/:id — only drafts can be deleted.
quotationsRouter.delete("/:id", requireRole("sales", "management"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(schema.quotations)
    .where(eq(schema.quotations.id, id))
    .all();
  if (!existing) {
    return c.json({ success: false, error: "Quotation not found" }, 404);
  }
  if (existing.status !== "draft") {
    return c.json(
      {
        success: false,
        error: "Only draft quotations can be deleted — reject it instead",
      },
      409,
    );
  }

  await db.delete(schema.quotations).where(eq(schema.quotations.id, id)).run();
  await logAudit(db, {
    actor: c.req.query("by") ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "quotation.delete",
    entityType: "quotation",
    entityId: id,
    detail: `Draft quotation ${existing.number} deleted`,
  });

  return c.json({ success: true, data: { id } });
});

export default quotationsRouter;

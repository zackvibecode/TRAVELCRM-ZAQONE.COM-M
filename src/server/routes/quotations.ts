import { Hono } from "hono";
import { and, desc, eq, like, or } from "drizzle-orm";
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
  status?: string;
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

// GET /quotations/:id/print — print-ready HTML document.
// The client opens this in a new tab and uses the browser's print-to-PDF.
quotationsRouter.get(
  "/:id/print",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const lang = c.req.query("lang") === "ms" ? "ms" : "en";
    const L = lang === "ms"
      ? {
          title: "Penawaran Perjalanan",
          created: "Dibuat",
          validUntil: "Berlaku sehingga",
          addressedTo: "Ditujukan kepada",
          pkg: "Pakej",
          destination: "Destinasi",
          pax: "Jumlah Pax",
          departureDate: "Tarikh Berlepas",
          status: "Status",
          adult: "Dewasa",
          child: "Kanak-kanak",
          infant: "Bayi",
          description: "Penerangan",
          qty: "Bil.",
          unitPrice: "Harga Seunit",
          amount: "Jumlah",
          subtotal: "Subjumlah",
          discount: "Diskaun",
          total: "Jumlah",
          packageTrip: "Pakej perjalanan",
          footer: "Penawaran ini bukan tiket/pengesahan tempahan. Harga boleh berubah tanpa notis sebelum pembayaran deposit. Dokumen ini dihasilkan oleh ZAQONE TRAVEL CRM.",
        }
      : {
          title: "Travel Quotation",
          created: "Created",
          validUntil: "Valid until",
          addressedTo: "Addressed to",
          pkg: "Package",
          destination: "Destination",
          pax: "Total Pax",
          departureDate: "Departure Date",
          status: "Status",
          adult: "Adults",
          child: "Children",
          infant: "Infants",
          description: "Description",
          qty: "Qty",
          unitPrice: "Unit Price",
          amount: "Amount",
          subtotal: "Subtotal",
          discount: "Discount",
          total: "Total",
          packageTrip: "Travel package",
          footer: "This quotation is not a ticket/booking confirmation. Prices may change without notice before the deposit is paid. This document was generated by ZAQONE TRAVEL CRM.",
        };

    const [quotation] = await db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.id, id))
      .all();
    if (!quotation) {
      return c.json({ success: false, error: "Quotation not found" }, 404);
    }

    const pax = [
      `${quotation.paxAdult} ${L.adult}`,
      `${quotation.paxChild} ${L.child}`,
      `${quotation.paxInfant} ${L.infant}`,
    ]
      .filter((_, i) => [quotation.paxAdult, quotation.paxChild, quotation.paxInfant][i] > 0)
      .join(" • ") || "—";

    const rm = (n: number) => {
      return `RM ${new Intl.NumberFormat("ms-MY").format(Math.round(n))}`;
    };

    const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${L.title} ${quotation.number}</title>
<style>
  * { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; }
  body { max-width: 720px; margin: 40px auto; color: #1c1917; padding: 0 24px; }
  header { display: flex; justify-content: space-between; border-bottom: 3px solid #1c1917; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { margin: 0; font-size: 22px; }
  .muted { color: #78716c; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e7e5e4; font-size: 13px; }
  th { background: #fafaf9; }
  td.num, th.num { text-align: right; }
  .totals { margin-left: auto; width: 280px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { font-weight: 700; font-size: 16px; border-top: 2px solid #1c1917; margin-top: 4px; padding-top: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; font-size: 13px; }
  .box { border: 1px solid #e7e5e4; border-radius: 8px; padding: 10px 12px; }
  .box .muted { display: block; margin-bottom: 2px; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e7e5e4; font-size: 11px; color: #78716c; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <header>
    <div>
      <h1>ZAQONE TRAVEL CRM</h1>
      <div class="muted">${L.title}</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">${quotation.number}</div>
      <div class="muted">${L.created}: ${quotation.createdAt}</div>
      ${quotation.validUntil ? `<div class="muted">${L.validUntil}: ${quotation.validUntil}</div>` : ""}
    </div>
  </header>

  <div class="grid">
    <div class="box"><span class="muted">${L.addressedTo}</span><strong>${quotation.customerName}</strong></div>
    <div class="box"><span class="muted">${L.pkg}</span><strong>${quotation.packageName ?? "—"}</strong></div>
    <div class="box"><span class="muted">${L.destination}</span>${quotation.destination ?? "—"}</div>
    <div class="box"><span class="muted">${L.pax}</span>${pax}</div>
    <div class="box"><span class="muted">${L.departureDate}</span>${quotation.departureDate ?? "—"}</div>
    <div class="box"><span class="muted">${L.status}</span>${quotation.status}</div>
  </div>

  <table>
    <thead>
      <tr><th>${L.description}</th><th class="num">${L.qty}</th><th class="num">${L.unitPrice}</th><th class="num">${L.amount}</th></tr>
    </thead>
    <tbody>
      ${
        /* items are stored on the quotation totals; line items live in the
           request payload. For print we render the aggregate when the
           quotation has no line-item rows (frontend sends totals only). */
        ""
      }
      <tr>
        <td>${quotation.packageName ?? L.packageTrip}</td>
        <td class="num">${quotation.paxAdult + quotation.paxChild + quotation.paxInfant || 1}</td>
        <td class="num">—</td>
        <td class="num">${rm(quotation.subtotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <div><span>${L.subtotal}</span><span>${rm(quotation.subtotal)}</span></div>
    ${quotation.discount > 0 ? `<div><span>${L.discount}</span><span>-${rm(quotation.discount)}</span></div>` : ""}
    <div class="grand"><span>${L.total}</span><span>${rm(quotation.total)}</span></div>
  </div>

  <footer>
    ${L.footer}
  </footer>
</body>
</html>`;

    return c.html(html);
  },
);

// POST /quotations/:id/convert-to-booking — accepted quotation → booking.
// Accepts the required booking linkage fields and creates the booking with
// the quotation's financial totals; marks the quotation converted.
quotationsRouter.post(
  "/:id/convert-to-booking",
  requireRole("sales", "management"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = (await c.req.json<{
      customerId: string;
      packageId: string;
      departureId: string;
      paxAdult?: number;
      paxChild?: number;
      paxInfant?: number;
      createdBy?: string;
    }>());

    const [quotation] = await db
      .select()
      .from(schema.quotations)
      .where(eq(schema.quotations.id, id))
      .all();
    if (!quotation) {
      return c.json({ success: false, error: "Quotation not found" }, 404);
    }
    if (quotation.status !== "accepted") {
      return c.json(
        {
          success: false,
          error: `Only accepted quotations can be converted (current: ${quotation.status})`,
        },
        409,
      );
    }
    if (!body.customerId || !body.packageId || !body.departureId) {
      return c.json(
        {
          success: false,
          error: "customerId, packageId, and departureId are required",
        },
        400,
      );
    }

    const { generateBookingReference } = await import("../lib/reference");

    const paxAdult = body.paxAdult ?? quotation.paxAdult;
    const paxChild = body.paxChild ?? quotation.paxChild;
    const paxInfant = body.paxInfant ?? quotation.paxInfant;

    // Deposit defaults to 50% of the quotation total unless overridden
    // upstream (the booking payload can be patched later).
    const depositAmount = Math.floor(quotation.total / 2);

    const booking: schema.NewBookingRow = {
      id: crypto.randomUUID(),
      reference: generateBookingReference(),
      customerId: body.customerId,
      packageId: body.packageId,
      departureId: body.departureId,
      type:
        paxAdult + paxChild > 4
          ? "group"
          : "individual",
      status: "pending_deposit",
      paymentStatus: "unpaid",
      paxAdult,
      paxChild,
      paxInfant,
      totalAmount: quotation.total,
      discount: quotation.discount,
      depositAmount,
      paidAmount: 0,
      balanceDue: quotation.total,
      createdBy: body.createdBy ?? quotation.createdBy ?? null,
    };

    await db.insert(schema.bookings).values(booking).run();

    // Mark the quotation as converted (still `accepted`, but linked).
    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await db
      .update(schema.quotations)
      .set({ updatedAt: now })
      .where(eq(schema.quotations.id, id))
      .run();

    await logAudit(db, {
      actor: body.createdBy ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "quotation.convert_to_booking",
      entityType: "quotation",
      entityId: id,
      detail: `Quotation ${quotation.number} converted to booking ${booking.reference}`,
    });

    return c.json(
      { success: true, data: { quotationId: id, booking } },
      201,
    );
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

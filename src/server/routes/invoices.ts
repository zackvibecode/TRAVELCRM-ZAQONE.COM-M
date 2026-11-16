import { Hono } from "hono";
import { and, asc, desc, eq, gte, like, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { requireRole } from "../middleware/auth";

export type InvoicesEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const invoicesRouter = new Hono<{
  Bindings: InvoicesEnv;
  Variables: Variables;
}>();

const INVOICE_STATUSES = [
  "draft",
  "issued",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

function isInvoiceStatus(value: unknown): value is InvoiceStatus {
  return (
    typeof value === "string" &&
    (INVOICE_STATUSES as readonly string[]).includes(value)
  );
}

/** Sequential invoice number: INV-<year>-<0001>. */
async function nextInvoiceNumber(
  db: DrizzleD1Database<typeof schema>,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const rows = await db
    .select({ number: schema.invoices.number })
    .from(schema.invoices)
    .where(like(schema.invoices.number, `${prefix}%`))
    .all();

  let max = 0;
  for (const row of rows) {
    const seq = Number(row.number.slice(prefix.length));
    if (!Number.isNaN(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

interface ItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface CreateInvoiceInput {
  bookingId?: string;
  quotationId?: string;
  customerId?: string;
  customerName: string;
  packageName?: string;
  issueDate?: string;
  dueDate?: string;
  discount?: number;
  depositAmount?: number;
  notes?: string;
  items: ItemInput[];
  createdBy?: string;
}

/** Recomputes an invoice's financial totals from its item rows. */
async function recalcInvoiceTotals(
  db: DrizzleD1Database<typeof schema>,
  invoiceId: string,
): Promise<void> {
  const items = await db
    .select()
    .from(schema.invoiceItems)
    .where(eq(schema.invoiceItems.invoiceId, invoiceId))
    .orderBy(asc(schema.invoiceItems.sortOrder))
    .all();

  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .all();

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const total = Math.max(0, subtotal - invoice.discount);
  const balanceDue = Math.max(0, total - invoice.paidAmount);

  let status: InvoiceStatus = invoice.status as InvoiceStatus;
  if (status !== "draft" && status !== "void") {
    status = balanceDue === 0 ? "paid" : invoice.paidAmount > 0 ? "partially_paid" : "issued";
  }

  await db
    .update(schema.invoices)
    .set({
      subtotal,
      total,
      balanceDue,
      status,
      updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    })
    .where(eq(schema.invoices.id, invoiceId))
    .run();
}

// GET /invoices — list with filters, search, pagination.
invoicesRouter.get(
  "/",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");

    const status = c.req.query("status");
    const customerId = c.req.query("customerId");
    const bookingId = c.req.query("bookingId");
    const overdue = c.req.query("overdue") === "true";
    const q = c.req.query("q")?.trim();
    const limit = Math.min(
      Math.max(Number(c.req.query("limit") ?? "50"), 1),
      200,
    );
    const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

    const conditions = [];
    if (status && isInvoiceStatus(status)) {
      conditions.push(eq(schema.invoices.status, status));
    }
    if (overdue) {
      conditions.push(gte(schema.invoices.balanceDue, 1));
    }
    if (customerId) {
      conditions.push(eq(schema.invoices.customerId, customerId));
    }
    if (bookingId) conditions.push(eq(schema.invoices.bookingId, bookingId));
    if (q) {
      conditions.push(
        or(
          like(schema.invoices.number, `%${q}%`),
          like(schema.invoices.customerName, `%${q}%`),
          like(schema.invoices.packageName, `%${q}%`),
        )!,
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, total] = await Promise.all([
      db
        .select()
        .from(schema.invoices)
        .where(where)
        .orderBy(desc(schema.invoices.createdAt))
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ count: schema.invoices.id })
        .from(schema.invoices)
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

// GET /invoices/stats — workspace billing KPIs.
invoicesRouter.get(
  "/stats",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const rows = await db.select().from(schema.invoices).all();

    const today = new Date().toISOString().slice(0, 10);
    const active = rows.filter((r) => r.status !== "draft" && r.status !== "void");
    const totalBilled = active.reduce((s, r) => s + r.total, 0);
    const collected = active.reduce((s, r) => s + r.paidAmount, 0);
    const outstanding = active.reduce((s, r) => s + r.balanceDue, 0);
    const overdueAmount = active
      .filter((r) => r.balanceDue > 0 && r.dueDate && r.dueDate < today)
      .reduce((s, r) => s + r.balanceDue, 0);

    return c.json({
      success: true,
      data: {
        count: rows.length,
        totalBilled,
        collected,
        outstanding,
        overdueAmount,
      },
    });
  },
);

// GET /invoices/:id — single invoice with items.
invoicesRouter.get(
  "/:id",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, id))
      .all();
    if (!invoice) {
      return c.json({ success: false, error: "Invoice not found" }, 404);
    }

    const [items, paymentHistory, refundHistory] = await Promise.all([
      db
        .select()
        .from(schema.invoiceItems)
        .where(eq(schema.invoiceItems.invoiceId, id))
        .orderBy(asc(schema.invoiceItems.sortOrder))
        .all(),
      db
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.invoiceId, id))
        .orderBy(desc(schema.payments.paidAt))
        .all(),
      db
        .select()
        .from(schema.refunds)
        .where(eq(schema.refunds.invoiceId, id))
        .orderBy(desc(schema.refunds.requestedAt))
        .all(),
    ]);

    // Balance summary: verified payments vs pending vs refunded.
    const verifiedTotal = paymentHistory
      .filter((p) => p.status === "verified")
      .reduce((s, p) => s + p.amount, 0);
    const pendingTotal = paymentHistory
      .filter((p) => p.status === "pending_verification")
      .reduce((s, p) => s + p.amount, 0);
    const refundedTotal = refundHistory
      .filter((r) => r.status === "completed")
      .reduce((s, r) => s + r.amount, 0);

    return c.json({
      success: true,
      data: {
        ...invoice,
        items,
        payments: paymentHistory,
        refunds: refundHistory,
        balanceSummary: {
          total: invoice.total,
          paid: verifiedTotal,
          pendingVerification: pendingTotal,
          refunded: refundedTotal,
          balanceDue: invoice.balanceDue,
          progressPct:
            invoice.total > 0
              ? Math.min(
                  100,
                  Math.round((invoice.paidAmount / invoice.total) * 100),
                )
              : 0,
        },
      },
    });
  },
);

// POST /invoices — create draft with sequential number and item rows.
invoicesRouter.post("/", requireRole("sales", "management", "finance"), async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<CreateInvoiceInput>()) as CreateInvoiceInput;

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

  const subtotal = body.items.reduce(
    (s, i) => s + i.quantity * Math.max(0, i.unitPrice),
    0,
  );
  const discount = Math.max(0, body.discount ?? 0);
  const total = Math.max(0, subtotal - discount);
  const depositAmount = Math.max(0, body.depositAmount ?? 0);

  const invoice: schema.NewInvoiceRow = {
    id: crypto.randomUUID(),
    number: await nextInvoiceNumber(db),
    bookingId: body.bookingId ?? null,
    quotationId: body.quotationId ?? null,
    customerId: body.customerId ?? null,
    customerName: body.customerName.trim(),
    packageName: body.packageName ?? null,
    status: "draft",
    issueDate: body.issueDate ?? null,
    dueDate: body.dueDate ?? null,
    subtotal,
    discount,
    total,
    depositAmount,
    paidAmount: 0,
    balanceDue: total,
    notes: body.notes ?? null,
    createdBy: body.createdBy ?? null,
  };

  await db.insert(schema.invoices).values(invoice).run();

  const itemRows: schema.NewInvoiceItemRow[] = body.items.map((item, idx) => ({
    id: crypto.randomUUID(),
    invoiceId: invoice.id,
    description: item.description.trim(),
    quantity: item.quantity,
    unitPrice: Math.max(0, item.unitPrice),
    amount: item.quantity * Math.max(0, item.unitPrice),
    sortOrder: idx,
  }));
  await db.insert(schema.invoiceItems).values(itemRows).run();

  await logAudit(db, {
    actor: body.createdBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "invoice.create",
    entityType: "invoice",
    entityId: invoice.id,
    detail: `Invoice ${invoice.number} created for ${invoice.customerName} (total ${total})`,
  });

  return c.json({ success: true, data: { ...invoice, items: itemRows } }, 201);
});

// POST /invoices/:id/issue — publish a draft to the customer.
invoicesRouter.post(
  "/:id/issue",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, id))
      .all();
    if (!invoice) {
      return c.json({ success: false, error: "Invoice not found" }, 404);
    }
    if (invoice.status !== "draft") {
      return c.json(
        { success: false, error: `Only drafts can be issued (current: ${invoice.status})` },
        409,
      );
    }

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);
    await db
      .update(schema.invoices)
      .set({
        status: "issued",
        issueDate: invoice.issueDate ?? new Date().toISOString().slice(0, 10),
        updatedAt: now,
      })
      .where(eq(schema.invoices.id, id))
      .run();
    await logAudit(db, {
      actor: c.req.query("by") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "invoice.issue",
      entityType: "invoice",
      entityId: id,
      detail: `Invoice ${invoice.number} issued`,
    });

    return c.json({ success: true, data: { id, status: "issued" } });
  },
);

// POST /invoices/:id/void — cancel an invoice (blocked when fully paid).
invoicesRouter.post(
  "/:id/void",
  requireRole("management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, id))
      .all();
    if (!invoice) {
      return c.json({ success: false, error: "Invoice not found" }, 404);
    }
    if (invoice.paidAmount > 0) {
      return c.json(
        {
          success: false,
          error: "Cannot void an invoice with verified payments — refund instead",
        },
        409,
      );
    }
    if (invoice.status === "void") {
      return c.json({ success: false, error: "Already void" }, 409);
    }

    await db
      .update(schema.invoices)
      .set({
        status: "void",
        updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      })
      .where(eq(schema.invoices.id, id))
      .run();
    await logAudit(db, {
      actor: c.req.query("by") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "invoice.void",
      entityType: "invoice",
      entityId: id,
      detail: `Invoice ${invoice.number} voided`,
    });

    return c.json({ success: true, data: { id, status: "void" } });
  },
);

// POST /invoices/:id/duplicate — copy items to a fresh draft.
invoicesRouter.post(
  "/:id/duplicate",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, id))
      .all();
    if (!invoice) {
      return c.json({ success: false, error: "Invoice not found" }, 404);
    }

    const items = await db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, id))
      .orderBy(asc(schema.invoiceItems.sortOrder))
      .all();

    const newInvoice: schema.NewInvoiceRow = {
      id: crypto.randomUUID(),
      number: await nextInvoiceNumber(db),
      bookingId: invoice.bookingId,
      quotationId: invoice.quotationId,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      packageName: invoice.packageName,
      status: "draft",
      issueDate: null,
      dueDate: invoice.dueDate,
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      total: invoice.total,
      depositAmount: invoice.depositAmount,
      paidAmount: 0,
      balanceDue: invoice.total,
      notes: invoice.notes,
      createdBy: c.req.query("by") ?? invoice.createdBy,
    };
    await db.insert(schema.invoices).values(newInvoice).run();

    if (items.length > 0) {
      await db
        .insert(schema.invoiceItems)
        .values(
          items.map((item) => ({
            id: crypto.randomUUID(),
            invoiceId: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            sortOrder: item.sortOrder,
          })),
        )
        .run();
    }

    await logAudit(db, {
      actor: c.req.query("by") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "invoice.duplicate",
      entityType: "invoice",
      entityId: newInvoice.id,
      detail: `Invoice ${invoice.number} duplicated as ${newInvoice.number}`,
    });

    return c.json({ success: true, data: { id: newInvoice.id, number: newInvoice.number } }, 201);
  },
);

// GET /invoices/:id/print — receipt-style print-ready HTML.
invoicesRouter.get(
  "/:id/print",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, id))
      .all();
    if (!invoice) {
      return c.json({ success: false, error: "Invoice not found" }, 404);
    }

    const items = await db
      .select()
      .from(schema.invoiceItems)
      .where(eq(schema.invoiceItems.invoiceId, id))
      .orderBy(asc(schema.invoiceItems.sortOrder))
      .all();

    const idr = (n: number) => {
      const rm = Math.round(n / 3000);
      return `RM ${new Intl.NumberFormat("ms-MY").format(rm)}`;
    };

    const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Invoice ${invoice.number}</title>
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
  .totals { margin-left: auto; width: 300px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { font-weight: 700; font-size: 16px; border-top: 2px solid #1c1917; margin-top: 4px; padding-top: 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; font-size: 13px; }
  .box { border: 1px solid #e7e5e4; border-radius: 8px; padding: 10px 12px; }
  .box .muted { display: block; margin-bottom: 2px; }
  .status { display: inline-block; padding: 2px 10px; border-radius: 999px; background: #fafaf9; border: 1px solid #e7e5e4; font-weight: 600; font-size: 12px; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e7e5e4; font-size: 11px; color: #78716c; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <header>
    <div>
      <h1>ZAQONE TRAVEL CRM</h1>
      <div class="muted">Invoice</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:700">${invoice.number}</div>
      <div class="muted">Terbit: ${invoice.issueDate ?? "—"}</div>
      <div class="muted">Jatuh tempo: ${invoice.dueDate ?? "—"}</div>
      <span class="status">${invoice.status}</span>
    </div>
  </header>

  <div class="grid">
    <div class="box"><span class="muted">Ditagihkan kepada</span><strong>${invoice.customerName}</strong></div>
    <div class="box"><span class="muted">Paket</span>${invoice.packageName ?? "—"}</div>
  </div>

  <table>
    <thead>
      <tr><th>Deskripsi</th><th class="num">Qty</th><th class="num">Harga Satuan</th><th class="num">Jumlah</th></tr>
    </thead>
    <tbody>
      ${items
        .map(
          (i) => `<tr>
        <td>${i.description}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${idr(i.unitPrice)}</td>
        <td class="num">${idr(i.amount)}</td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>${idr(invoice.subtotal)}</span></div>
    ${invoice.discount > 0 ? `<div><span>Diskon</span><span>-${idr(invoice.discount)}</span></div>` : ""}
    ${invoice.depositAmount > 0 ? `<div><span>Deposit</span><span>${idr(invoice.depositAmount)}</span></div>` : ""}
    <div class="grand"><span>Total</span><span>${idr(invoice.total)}</span></div>
    <div><span>Dibayar</span><span>${idr(invoice.paidAmount)}</span></div>
    <div class="grand"><span>Sisa</span><span>${idr(invoice.balanceDue)}</span></div>
  </div>

  ${invoice.notes ? `<p style="font-size:12px"><strong>Catatan:</strong> ${invoice.notes}</p>` : ""}

  <footer>
    Invoice ini dihasilkan oleh ZAQONE TRAVEL CRM. Pembayaran dapat diverifikasi
    melalui kanal transfer bank / e-wallet terdaftar.
  </footer>
</body>
</html>`;

    return c.html(html);
  },
);

// DELETE /invoices/:id — only drafts.
invoicesRouter.delete("/:id", requireRole("sales", "management", "finance"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, id))
    .all();
  if (!invoice) {
    return c.json({ success: false, error: "Invoice not found" }, 404);
  }
  if (invoice.status !== "draft") {
    return c.json(
      {
        success: false,
        error: "Only draft invoices can be deleted — void it instead",
      },
      409,
    );
  }

  await db.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, id)).run();
  await db.delete(schema.invoices).where(eq(schema.invoices.id, id)).run();
  await logAudit(db, {
    actor: c.req.query("by") ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "invoice.delete",
    entityType: "invoice",
    entityId: id,
    detail: `Draft invoice ${invoice.number} deleted`,
  });

  return c.json({ success: true, data: { id } });
});

export default invoicesRouter;

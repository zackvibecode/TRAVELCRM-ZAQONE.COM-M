import { Hono } from "hono";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { requireRole } from "../middleware/auth";
import { whatsappLink } from "../lib/phone";

export type PaymentRemindersEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const paymentRemindersRouter = new Hono<{
  Bindings: PaymentRemindersEnv;
  Variables: Variables;
}>();

const REMINDER_CHANNELS = ["whatsapp", "email"] as const;
type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

const DEFAULT_TEMPLATE =
  "Hello {customer}, this is a payment reminder for invoice {invoice} " +
  "amounting to {balance}, due on {due}. Thank you!";

/** Render a message from a DB notification template or the built-in default. */
function renderReminder(
  template: string | undefined,
  invoice: typeof schema.invoices.$inferSelect,
): string {
  const balance = `RM ${new Intl.NumberFormat("ms-MY").format(Math.round(invoice.balanceDue))}`;
  if (template && template.includes("{{")) {
    const values: Record<string, string> = {
      customer_name: invoice.customerName,
      booking_ref: invoice.number,
      amount: balance,
      due_date: invoice.dueDate ?? "—",
    };
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
      values[key] !== undefined ? values[key]! : `{{${key}}}`,
    );
  }
  const source = template ?? DEFAULT_TEMPLATE;
  return source
    .replaceAll("{customer}", invoice.customerName)
    .replaceAll("{invoice}", invoice.number)
    .replaceAll("{balance}", balance)
    .replaceAll("{due}", invoice.dueDate ?? "—");
}

/**
 * GET /payment-reminders/due — invoices needing attention:
 * balanceDue > 0, not draft/void, due within 30 days or overdue.
 */
paymentRemindersRouter.get(
  "/due",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 30 * 86400_000)
      .toISOString()
      .slice(0, 10);

    const rows = await db
      .select()
      .from(schema.invoices)
      .where(
        and(
          gte(schema.invoices.balanceDue, 1),
          ne(schema.invoices.status, "draft"),
          ne(schema.invoices.status, "void"),
          ne(schema.invoices.status, "paid"),
          gte(schema.invoices.dueDate, "0000-00-00"),
          sql`${schema.invoices.dueDate} IS NOT NULL AND ${schema.invoices.dueDate} <= ${horizon}`,
        ),
      )
      .orderBy(schema.invoices.dueDate)
      .limit(200)
      .all();

    // Active payment_reminder template (DB), falling back to the default.
    const tplRows = await db
      .select({ body: schema.notificationTemplates.body })
      .from(schema.notificationTemplates)
      .where(
        and(
          eq(schema.notificationTemplates.code, "payment_reminder"),
          eq(schema.notificationTemplates.enabled, true),
        ),
      )
      .limit(1);
    const templateBody = tplRows[0]?.body;

    const data = rows.map((invoice) => {
      const overdue = !!invoice.dueDate && invoice.dueDate < today;
      const daysUntil = invoice.dueDate
        ? Math.round(
            (new Date(invoice.dueDate).getTime() - new Date(today).getTime()) /
              86400_000,
          )
        : null;
      return {
        ...invoice,
        overdue,
        daysUntil,
        message: renderReminder(templateBody, invoice),
      };
    });

    return c.json({ success: true, data });
  },
);

/**
 * GET /payment-reminders/template — the active DB template (payment_reminder)
 * when configured, plus the customer/invoice data used by the frontend
 * composer. Falls back to the built-in default template.
 */
paymentRemindersRouter.get(
  "/template",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const rows = await db
      .select()
      .from(schema.notificationTemplates)
      .where(eq(schema.notificationTemplates.code, "payment_reminder"))
      .limit(1);
    const tpl = rows[0];
    return c.json({
      success: true,
      data: {
        template: tpl?.body ?? DEFAULT_TEMPLATE,
        placeholders: tpl
          ? ["{{customer_name}}", "{{booking_ref}}", "{{amount}}", "{{due_date}}"]
          : ["{customer}", "{invoice}", "{balance}", "{due}"],
        channel: tpl?.channel ?? "whatsapp",
        source: tpl ? "db" : "builtin",
      },
    });
  },
);

/**
 * POST /payment-reminders — log a reminder dispatch.
 * Body: invoiceId, channel (whatsapp|email), message, sentBy.
 * Returns the WhatsApp deep link when the channel is whatsapp and the
 * invoice has a customer with a phone (via the linked customer record).
 */
paymentRemindersRouter.post(
  "/",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const body = (await c.req.json<{
      invoiceId: string;
      channel: ReminderChannel;
      message: string;
      sentBy?: string;
    }>());

    if (!body.invoiceId) {
      return c.json({ success: false, error: "invoiceId is required" }, 400);
    }
    if (!REMINDER_CHANNELS.includes(body.channel)) {
      return c.json(
        { success: false, error: "channel must be whatsapp or email" },
        400,
      );
    }
    if (!body.message?.trim()) {
      return c.json({ success: false, error: "message is required" }, 400);
    }

    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, body.invoiceId))
      .all();
    if (!invoice) {
      return c.json({ success: false, error: "Invoice not found" }, 404);
    }
    if (invoice.balanceDue <= 0) {
      return c.json(
        { success: false, error: "Invoice has no outstanding balance" },
        409,
      );
    }

    // Resolve the customer phone for the WhatsApp deep link.
    let whatsapp: string | null = null;
    if (body.channel === "whatsapp" && invoice.customerId) {
      const [customer] = await db
        .select({ phone: schema.customers.phone })
        .from(schema.customers)
        .where(eq(schema.customers.id, invoice.customerId))
        .all();
      if (customer) {
        whatsapp = whatsappLink(customer.phone, body.message);
      }
    }

    const reminder: schema.NewPaymentReminderRow = {
      id: crypto.randomUUID(),
      invoiceId: body.invoiceId,
      channel: body.channel,
      message: body.message.trim(),
      sentBy: body.sentBy ?? (c.req.header("x-user-id") ?? "system"),
    };
    await db.insert(schema.paymentReminders).values(reminder).run();

    await logAudit(db, {
      actor: body.sentBy ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "payment_reminder.send",
      entityType: "payment_reminder",
      entityId: reminder.id,
      detail: `${body.channel} reminder for ${invoice.number} sent to ${invoice.customerName}`,
    });

    return c.json(
      { success: true, data: { ...reminder, whatsapp } },
      201,
    );
  },
);

// GET /payment-reminders — dispatch history, newest first.
paymentRemindersRouter.get(
  "/",
  requireRole("sales", "management", "finance"),
  async (c) => {
    const db = c.get("db");

    const invoiceId = c.req.query("invoiceId");
    const limit = Math.min(
      Math.max(Number(c.req.query("limit") ?? "50"), 1),
      200,
    );
    const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

    const where = invoiceId
      ? eq(schema.paymentReminders.invoiceId, invoiceId)
      : undefined;

    const [rows, total] = await Promise.all([
      db
        .select()
        .from(schema.paymentReminders)
        .where(where)
        .orderBy(desc(schema.paymentReminders.sentAt))
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ count: schema.paymentReminders.id })
        .from(schema.paymentReminders)
        .where(where)
        .all(),
    ]);

    // Join invoice numbers for display.
    const invoices = await db
      .select({ id: schema.invoices.id, number: schema.invoices.number, customerName: schema.invoices.customerName })
      .from(schema.invoices)
      .all();
    const invoiceMap = new Map(invoices.map((i) => [i.id, i]));

    const data = rows.map((r) => ({
      ...r,
      invoiceNumber: invoiceMap.get(r.invoiceId)?.number ?? r.invoiceId,
      customerName: invoiceMap.get(r.invoiceId)?.customerName ?? null,
    }));

    return c.json({
      success: true,
      data,
      pagination: { total: total.length, limit, offset },
    });
  },
);

// DELETE old reminder history is intentionally omitted — history is immutable.

export default paymentRemindersRouter;

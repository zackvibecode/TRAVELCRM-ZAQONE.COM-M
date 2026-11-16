import { Hono } from "hono";
import { and, desc, eq, like, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { requireRole } from "../middleware/auth";
import { normalizePhone, whatsappLink } from "../lib/phone";

export type CustomersEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const customersRouter = new Hono<{
  Bindings: CustomersEnv;
  Variables: Variables;
}>();

interface CreateCustomerInput {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  type?: "individual" | "corporate";
  city?: string;
  notes?: string;
  leadId?: string;
  createdBy?: string;
}

interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  email?: string | null;
  type?: "individual" | "corporate";
  city?: string | null;
  notes?: string | null;
  updatedBy?: string;
}

// GET /customers — list with search, type filter, pagination.
customersRouter.get(
  "/",
  requireRole("sales", "management", "finance", "operations"),
  async (c) => {
  const db = c.get("db");

  const type = c.req.query("type");
  const q = c.req.query("q")?.trim();
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "50"), 1), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

  const conditions = [];
  if (type === "individual" || type === "corporate") {
    conditions.push(eq(schema.customers.type, type));
  }
  if (q) {
    conditions.push(
      or(
        like(schema.customers.name, `%${q}%`),
        like(schema.customers.phone, `%${q}%`),
        like(schema.customers.email, `%${q}%`),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(schema.customers)
      .where(where)
      .orderBy(desc(schema.customers.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: schema.customers.id })
      .from(schema.customers)
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

// GET /customers/:id — profile with booking history and originating lead.
customersRouter.get(
  "/:id",
  requireRole("sales", "management", "finance", "operations"),
  async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [customer] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id))
    .all();
  if (!customer) {
    return c.json({ success: false, error: "Customer not found" }, 404);
  }

  const [bookingRows, leadRow] = await Promise.all([
    db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.customerId, id))
      .orderBy(desc(schema.bookings.createdAt))
      .limit(100)
      .all(),
    customer.leadId
      ? db
          .select()
          .from(schema.leads)
          .where(eq(schema.leads.id, customer.leadId))
          .all()
      : Promise.resolve([]),
  ]);

  const totalSpend = bookingRows.reduce((s, b) => s + b.paidAmount, 0);

  // Billing history & balance summary across the customer's invoices.
  const invoiceRows = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.customerId, id))
    .orderBy(desc(schema.invoices.createdAt))
    .limit(100)
    .all();
  const activeInvoices = invoiceRows.filter(
    (i) => i.status !== "draft" && i.status !== "void",
  );
  const billingSummary = {
    invoiceCount: invoiceRows.length,
    totalBilled: activeInvoices.reduce((s, i) => s + i.total, 0),
    totalPaid: activeInvoices.reduce((s, i) => s + i.paidAmount, 0),
    outstanding: activeInvoices.reduce((s, i) => s + i.balanceDue, 0),
  };

  return c.json({
    success: true,
    data: {
      ...customer,
      whatsapp: whatsappLink(
        customer.phone,
        `Halo ${customer.name}, ini dari ZAQONE TRAVEL CRM.`,
      ),
      lead: leadRow[0] ?? null,
      bookings: bookingRows,
      invoices: invoiceRows,
      stats: {
        bookingCount: bookingRows.length,
        totalSpend,
        activeBookings: bookingRows.filter((b) =>
          ["pending_deposit", "confirmed"].includes(b.status),
        ).length,
        billing: billingSummary,
      },
    },
  });
  },
);

// POST /customers — create a customer (optionally converted from a lead).
customersRouter.post("/", requireRole("sales", "management"), async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<CreateCustomerInput>()) as CreateCustomerInput;

  if (!body.name?.trim() || !body.phone?.trim()) {
    return c.json(
      { success: false, error: "name and phone are required" },
      400,
    );
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return c.json(
      { success: false, error: "phone must contain at least one digit" },
      400,
    );
  }

  // Duplicate check by phone.
  const [dupe] = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(eq(schema.customers.phone, phone))
    .all();
  if (dupe) {
    return c.json(
      {
        success: false,
        error: "A customer with this phone number already exists",
        data: { existingId: dupe.id },
      },
      409,
    );
  }

  const customer: schema.NewCustomerRow = {
    id: body.id ?? crypto.randomUUID(),
    name: body.name.trim(),
    phone,
    email: body.email ?? null,
    type: body.type ?? "individual",
    city: body.city ?? null,
    notes: body.notes ?? null,
    leadId: body.leadId ?? null,
  };

  await db.insert(schema.customers).values(customer).run();

  // If converted from a lead: link back and log the conversion.
  if (body.leadId) {
    await db
      .update(schema.leads)
      .set({
        customerId: customer.id,
        stage: "won",
        updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      })
      .where(eq(schema.leads.id, body.leadId))
      .run();
    await db.insert(schema.leadActivities).values({
      id: crypto.randomUUID(),
      leadId: body.leadId,
      type: "stage_change",
      text: "Lead converted to customer",
      user: body.createdBy ?? "system",
    }).run();
  }

  await logAudit(db, {
    actor: body.createdBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "customer.create",
    entityType: "customer",
    entityId: customer.id,
    detail: `Customer ${customer.name} created${body.leadId ? " from lead" : ""}`,
  });

  return c.json({ success: true, data: customer }, 201);
});

// PATCH /customers/:id — update customer fields.
customersRouter.patch("/:id", requireRole("sales", "management"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json<UpdateCustomerInput>()) as UpdateCustomerInput;

  const [existing] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id))
    .all();
  if (!existing) {
    return c.json({ success: false, error: "Customer not found" }, 404);
  }

  const patch: Partial<schema.NewCustomerRow> = {
    updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.phone !== undefined) patch.phone = body.phone.trim();
  if (body.email !== undefined) patch.email = body.email;
  if (body.type !== undefined) patch.type = body.type;
  if (body.city !== undefined) patch.city = body.city;
  if (body.notes !== undefined) patch.notes = body.notes;

  await db
    .update(schema.customers)
    .set(patch)
    .where(eq(schema.customers.id, id))
    .run();
  await logAudit(db, {
    actor: body.updatedBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "customer.update",
    entityType: "customer",
    entityId: id,
    detail: `Customer ${existing.name} updated`,
  });

  const [updated] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id))
    .all();
  return c.json({ success: true, data: updated });
});

// DELETE /customers/:id — hard delete, blocked when bookings exist.
customersRouter.delete("/:id", requireRole("management"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(schema.customers)
    .where(eq(schema.customers.id, id))
    .all();
  if (!existing) {
    return c.json({ success: false, error: "Customer not found" }, 404);
  }

  const bookingRows = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(eq(schema.bookings.customerId, id))
    .all();
  if (bookingRows.length > 0) {
    return c.json(
      {
        success: false,
        error: "Cannot delete a customer with existing bookings",
      },
      409,
    );
  }

  await db.delete(schema.customers).where(eq(schema.customers.id, id)).run();
  await logAudit(db, {
    actor: c.req.query("by") ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "customer.delete",
    entityType: "customer",
    entityId: id,
    detail: `Customer ${existing.name} deleted`,
  });

  return c.json({ success: true, data: { id } });
});

export default customersRouter;

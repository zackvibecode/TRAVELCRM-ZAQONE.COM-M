import { Hono } from "hono";
import { and, eq, ne } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";

export type SuppliersEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const suppliersRouter = new Hono<{
  Bindings: SuppliersEnv;
  Variables: Variables;
}>();

// ---- Suppliers CRUD ----

suppliersRouter.get("/suppliers", async (c) => {
  const db = c.get("db");
  const type = c.req.query("type");

  const rows = type
    ? await db
        .select()
        .from(schema.suppliers)
        .where(eq(schema.suppliers.type, type as schema.SupplierRow["type"]))
        .all()
    : await db.select().from(schema.suppliers).all();

  return c.json({ success: true, suppliers: rows });
});

suppliersRouter.post("/suppliers", requireRole("operations", "management"), async (c) => {
  const db = c.get("db");
  let body: {
    name?: string;
    type?: schema.SupplierRow["type"];
    contactName?: string;
    phone?: string;
    email?: string;
    notes?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.name || !body.type) {
    return c.json({ success: false, error: "name and type are required" }, 400);
  }

  const row: schema.NewSupplierRow = {
    id: crypto.randomUUID(),
    name: body.name,
    type: body.type,
    contactName: body.contactName ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    notes: body.notes ?? null,
    createdAt: new Date().toISOString(),
  };

  await db.insert(schema.suppliers).values(row).run();
  return c.json({ success: true, supplier: row }, 201);
});

// ---- Departure costs ----

// GET /departures/:id/costs
suppliersRouter.get("/departures/:id/costs", requireRole("operations", "management", "finance"), async (c) => {
  const db = c.get("db");
  const departureId = c.req.param("id");

  const rows = await db
    .select()
    .from(schema.departureCosts)
    .where(eq(schema.departureCosts.departureId, departureId))
    .all();

  return c.json({ success: true, costs: rows });
});

// POST /departures/:id/costs
suppliersRouter.post("/departures/:id/costs", requireRole("operations", "management", "finance"), async (c) => {
  const db = c.get("db");
  const departureId = c.req.param("id");

  let body: {
    supplierId?: string;
    category?: string;
    description?: string;
    estimatedAmount?: number;
    actualAmount?: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.category) {
    return c.json({ success: false, error: "category is required" }, 400);
  }

  const row: schema.NewDepartureCostRow = {
    id: crypto.randomUUID(),
    departureId,
    supplierId: body.supplierId ?? null,
    category: body.category,
    description: body.description ?? null,
    estimatedAmount: body.estimatedAmount ?? 0,
    actualAmount: body.actualAmount ?? 0,
    createdAt: new Date().toISOString(),
  };

  await db.insert(schema.departureCosts).values(row).run();
  return c.json({ success: true, cost: row }, 201);
});

// PATCH /costs/:id
suppliersRouter.patch("/costs/:id", requireRole("operations", "management", "finance"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(schema.departureCosts)
    .where(eq(schema.departureCosts.id, id))
    .get();
  if (!existing) {
    return c.json({ success: false, error: "Cost not found" }, 404);
  }

  let body: {
    supplierId?: string;
    category?: string;
    description?: string;
    estimatedAmount?: number;
    actualAmount?: number;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const patch: Partial<schema.NewDepartureCostRow> = {};
  if (body.supplierId !== undefined) patch.supplierId = body.supplierId ?? null;
  if (body.category !== undefined) patch.category = body.category;
  if (body.description !== undefined) patch.description = body.description ?? null;
  if (body.estimatedAmount !== undefined) patch.estimatedAmount = body.estimatedAmount;
  if (body.actualAmount !== undefined) patch.actualAmount = body.actualAmount;

  await db
    .update(schema.departureCosts)
    .set(patch)
    .where(eq(schema.departureCosts.id, id))
    .run();

  const updated = await db
    .select()
    .from(schema.departureCosts)
    .where(eq(schema.departureCosts.id, id))
    .get();

  return c.json({ success: true, cost: updated });
});

// DELETE /costs/:id
suppliersRouter.delete("/costs/:id", requireRole("operations", "management", "finance"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select({ id: schema.departureCosts.id })
    .from(schema.departureCosts)
    .where(eq(schema.departureCosts.id, id))
    .get();
  if (!existing) {
    return c.json({ success: false, error: "Cost not found" }, 404);
  }

  await db
    .delete(schema.departureCosts)
    .where(eq(schema.departureCosts.id, id))
    .run();

  return c.json({ success: true });
});

// ---- Profit summary ----

// GET /departures/:id/profit — revenue, costs, gross profit, margin.
suppliersRouter.get("/departures/:id/profit", requireRole("operations", "management", "finance"), async (c) => {
  const db = c.get("db");
  const departureId = c.req.param("id");

  const departure = await db
    .select({ id: schema.departures.id })
    .from(schema.departures)
    .where(eq(schema.departures.id, departureId))
    .get();
  if (!departure) {
    return c.json({ success: false, error: "Departure not found" }, 404);
  }

  // Revenue = sum of totalAmount for non-cancelled bookings on this departure.
  const revenueRows = await db
    .select({ total: schema.bookings.totalAmount })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.departureId, departureId),
        ne(schema.bookings.status, "cancelled"),
      ),
    )
    .all();
  const revenue = revenueRows.reduce((sum, r) => sum + r.total, 0);

  // Costs = sum of actualAmount (falling back to estimated when actual is 0).
  const costs = await db
    .select()
    .from(schema.departureCosts)
    .where(eq(schema.departureCosts.departureId, departureId))
    .all();
  const totalEstimated = costs.reduce((sum, c) => sum + c.estimatedAmount, 0);
  const totalActual = costs.reduce(
    (sum, c) => sum + (c.actualAmount > 0 ? c.actualAmount : c.estimatedAmount),
    0,
  );

  const grossProfit = revenue - totalActual;
  const margin =
    revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;

  return c.json({
    success: true,
    revenue,
    totalEstimatedCost: totalEstimated,
    totalActualCost: totalActual,
    grossProfit,
    marginPercent: margin,
  });
});

export default suppliersRouter;

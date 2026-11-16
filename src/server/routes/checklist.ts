import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export type ChecklistEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const checklistRouter = new Hono<{
  Bindings: ChecklistEnv;
  Variables: Variables;
}>();

const DEFAULT_ITEMS = [
  { label: "Flight tickets issued", category: "Transport" },
  { label: "Hotel confirmations received", category: "Accommodation" },
  { label: "Rooming list finalized", category: "Accommodation" },
  { label: "Visa documents prepared", category: "Documents" },
  { label: "Travel insurance issued", category: "Documents" },
  { label: "Final manifest confirmed", category: "Operations" },
  { label: "Tour leader briefing done", category: "Operations" },
  { label: "Airport transfers arranged", category: "Transport" },
  { label: "Meal / dietary requirements sent", category: "Operations" },
];

// GET /departures/:id/checklist — list items (seeds defaults on first read).
checklistRouter.get("/departures/:id/checklist", async (c) => {
  const db = c.get("db");
  const departureId = c.req.param("id");

  let items = await db
    .select()
    .from(schema.tripChecklistItems)
    .where(eq(schema.tripChecklistItems.departureId, departureId))
    .orderBy(asc(schema.tripChecklistItems.sortOrder))
    .all();

  if (items.length === 0) {
    const now = new Date().toISOString();
    const rows = DEFAULT_ITEMS.map((d, i) => ({
      id: crypto.randomUUID(),
      departureId,
      label: d.label,
      category: d.category,
      done: false,
      sortOrder: i,
      updatedAt: now,
    }));
    if (rows.length > 0) {
      await db.insert(schema.tripChecklistItems).values(rows).run();
      items = await db
        .select()
        .from(schema.tripChecklistItems)
        .where(eq(schema.tripChecklistItems.departureId, departureId))
        .orderBy(asc(schema.tripChecklistItems.sortOrder))
        .all();
    }
  }

  return c.json({ success: true, items });
});

// POST /departures/:id/checklist — add a custom checklist item.
checklistRouter.post("/departures/:id/checklist", async (c) => {
  const db = c.get("db");
  const departureId = c.req.param("id");

  let body: { label?: string; category?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.label) {
    return c.json({ success: false, error: "label is required" }, 400);
  }

  const existing = await db
    .select({ id: schema.tripChecklistItems.id })
    .from(schema.tripChecklistItems)
    .where(eq(schema.tripChecklistItems.departureId, departureId))
    .all();

  const item: schema.NewTripChecklistItemRow = {
    id: crypto.randomUUID(),
    departureId,
    label: body.label,
    category: body.category ?? null,
    done: false,
    sortOrder: existing.length,
    updatedAt: new Date().toISOString(),
  };

  await db.insert(schema.tripChecklistItems).values(item).run();

  return c.json({ success: true, item }, 201);
});

// PATCH /checklist/:itemId — update label, done, or sortOrder.
checklistRouter.patch("/checklist/:itemId", async (c) => {
  const db = c.get("db");
  const itemId = c.req.param("itemId");

  const existing = await db
    .select()
    .from(schema.tripChecklistItems)
    .where(eq(schema.tripChecklistItems.id, itemId))
    .get();
  if (!existing) {
    return c.json({ success: false, error: "Checklist item not found" }, 404);
  }

  let body: { label?: string; category?: string; done?: boolean; sortOrder?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const patch: Partial<schema.NewTripChecklistItemRow> = {
    updatedAt: new Date().toISOString(),
  };
  if (body.label !== undefined) patch.label = body.label;
  if (body.category !== undefined) patch.category = body.category ?? null;
  if (body.done !== undefined) patch.done = body.done;
  if (body.sortOrder !== undefined) patch.sortOrder = body.sortOrder;

  await db
    .update(schema.tripChecklistItems)
    .set(patch)
    .where(eq(schema.tripChecklistItems.id, itemId))
    .run();

  const updated = await db
    .select()
    .from(schema.tripChecklistItems)
    .where(eq(schema.tripChecklistItems.id, itemId))
    .get();

  return c.json({ success: true, item: updated });
});

// DELETE /checklist/:itemId — remove a checklist item.
checklistRouter.delete("/checklist/:itemId", async (c) => {
  const db = c.get("db");
  const itemId = c.req.param("itemId");

  const existing = await db
    .select({ id: schema.tripChecklistItems.id })
    .from(schema.tripChecklistItems)
    .where(eq(schema.tripChecklistItems.id, itemId))
    .get();
  if (!existing) {
    return c.json({ success: false, error: "Checklist item not found" }, 404);
  }

  await db
    .delete(schema.tripChecklistItems)
    .where(eq(schema.tripChecklistItems.id, itemId))
    .run();

  return c.json({ success: true });
});

export default checklistRouter;

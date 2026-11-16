import { Hono } from "hono";
import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import {
  convertHold,
  getAvailability,
  holdSeats,
  releaseExpiredHolds,
  releaseHold,
} from "../lib/seat-availability";

export type DeparturesEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const departuresRouter = new Hono<{
  Bindings: DeparturesEnv;
  Variables: Variables;
}>();

// GET /departures/calendar — departures grouped by month, with occupancy.
// Optional ?from=YYYY-MM-DD&to=YYYY-MM-DD filters the window.
departuresRouter.get("/calendar", async (c) => {
  const db = c.get("db");

  const from = c.req.query("from");
  const to = c.req.query("to");

  const conditions: SQL[] = [];
  if (from) conditions.push(gte(schema.departures.departureDate, from));
  if (to) conditions.push(lte(schema.departures.departureDate, to));

  const rows = await db
    .select()
    .from(schema.departures)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .all();

  // Group by calendar month key "YYYY-MM".
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const month = row.departureDate.slice(0, 7);
    const list = grouped.get(month) ?? [];
    list.push(row);
    grouped.set(month, list);
  }

  const months = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, departures]) => ({
      month,
      departures: departures.map((d) => ({
        id: d.id,
        packageId: d.packageId,
        departureDate: d.departureDate,
        returnDate: d.returnDate,
        seatCapacity: d.seatCapacity,
        seatsBooked: d.seatsBooked,
        seatsHeld: d.seatsHeld,
        seatsAvailable: Math.max(0, d.seatCapacity - d.seatsBooked - d.seatsHeld),
        occupancy: d.seatCapacity > 0 ? Math.round((d.seatsBooked / d.seatCapacity) * 100) : 0,
        status: d.status,
      })),
    }));

  return c.json({ success: true, months });
});

// GET /departures/:id/availability — current seat availability.
departuresRouter.get("/:id/availability", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const availability = await getAvailability(db, id);
  if (!availability) {
    return c.json({ success: false, error: "Departure not found" }, 404);
  }

  return c.json({ success: true, ...availability });
});

// POST /departures/:id/hold — atomically hold seats.
departuresRouter.post("/:id/hold", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  let body: { count?: number; heldBy?: string; holdMinutes?: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const count = body.count ?? 1;
  if (count < 1) {
    return c.json({ success: false, error: "count must be >= 1" }, 400);
  }

  const result = await holdSeats(db, id, count, body.heldBy, body.holdMinutes);
  if (!result.ok) {
    return c.json(
      { success: false, reason: result.reason, seatsAvailable: result.seatsAvailable },
      result.reason === "not_found" ? 404 : 409,
    );
  }

  return c.json({ success: true, holdId: result.holdId, seatsAvailable: result.seatsAvailable }, 201);
});

// POST /seat-holds/:id/convert — convert a hold into booked seats.
departuresRouter.post("/seat-holds/:id/convert", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const result = await convertHold(db, id);
  if (!result.ok) {
    return c.json({ success: false, error: "Hold not found or not active" }, 404);
  }

  return c.json({ success: true });
});

// POST /seat-holds/:id/release — release a hold back to available.
departuresRouter.post("/seat-holds/:id/release", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const result = await releaseHold(db, id);
  if (!result.ok) {
    return c.json({ success: false, error: "Hold not found or not active" }, 404);
  }

  return c.json({ success: true });
});

// POST /departures/release-expired — manually release all expired holds.
departuresRouter.post("/release-expired", async (c) => {
  const db = c.get("db");
  const released = await releaseExpiredHolds(db);
  return c.json({ success: true, released });
});

export default departuresRouter;

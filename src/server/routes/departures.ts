import { Hono } from "hono";
import { and, gte, lte, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

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

export default departuresRouter;

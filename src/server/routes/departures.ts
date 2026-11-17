import { Hono } from "hono";
import { and, eq, gte, inArray, lte, ne, type SQL } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";
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

// POST /departures — create a new departure for a package.
departuresRouter.post("/", requireRole("super_admin", "management", "operations"), async (c) => {
  const db = c.get("db");

  let body: {
    packageId?: string;
    departureDate?: string;
    returnDate?: string;
    seatCapacity?: number;
    adultPrice?: number;
    childPrice?: number;
    infantPrice?: number;
    tourLeader?: string;
    notes?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.packageId?.trim() || !body.departureDate?.trim()) {
    return c.json(
      { success: false, error: "packageId and departureDate are required" },
      400,
    );
  }

  const [pkg] = await db
    .select({ id: schema.packages.id })
    .from(schema.packages)
    .where(eq(schema.packages.id, body.packageId))
    .all();
  if (!pkg) {
    return c.json({ success: false, error: "Package not found" }, 404);
  }

  const id = crypto.randomUUID();
  await db
    .insert(schema.departures)
    .values({
      id,
      packageId: body.packageId,
      departureDate: body.departureDate,
      returnDate: body.returnDate ?? body.departureDate,
      seatCapacity: Number(body.seatCapacity) > 0 ? Number(body.seatCapacity) : 30,
      seatsBooked: 0,
      seatsHeld: 0,
      adultPrice: Number(body.adultPrice) || 0,
      childPrice: Number(body.childPrice) || 0,
      infantPrice: Number(body.infantPrice) || 0,
      status: "open",
      tourLeader: body.tourLeader?.trim() || null,
      notes: body.notes?.trim() || null,
    })
    .run();

  const [created] = await db
    .select()
    .from(schema.departures)
    .where(eq(schema.departures.id, id))
    .all();

  return c.json({ success: true, data: created }, 201);
});

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
departuresRouter.post("/:id/hold", requireRole("operations", "sales"), async (c) => {
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
departuresRouter.post("/seat-holds/:id/convert", requireRole("operations", "sales"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const result = await convertHold(db, id);
  if (!result.ok) {
    return c.json({ success: false, error: "Hold not found or not active" }, 404);
  }

  return c.json({ success: true });
});

// POST /seat-holds/:id/release — release a hold back to available.
departuresRouter.post("/seat-holds/:id/release", requireRole("operations", "sales"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const result = await releaseHold(db, id);
  if (!result.ok) {
    return c.json({ success: false, error: "Hold not found or not active" }, 404);
  }

  return c.json({ success: true });
});

// POST /departures/release-expired — manually release all expired holds.
departuresRouter.post("/release-expired", requireRole("operations"), async (c) => {
  const db = c.get("db");
  const released = await releaseExpiredHolds(db);
  return c.json({ success: true, released });
});

// GET /departures/:id/manifest — passenger manifest for a departure.
departuresRouter.get("/:id/manifest", requireRole("operations", "management", "sales"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const departure = await db
    .select({ id: schema.departures.id })
    .from(schema.departures)
    .where(eq(schema.departures.id, id))
    .get();
  if (!departure) {
    return c.json({ success: false, error: "Departure not found" }, 404);
  }

  // Bookings on this departure, excluding cancelled/draft.
  const bookings = await db
    .select({ id: schema.bookings.id, reference: schema.bookings.reference })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.departureId, id),
        ne(schema.bookings.status, "cancelled"),
        ne(schema.bookings.status, "draft"),
      ),
    )
    .all();

  const bookingIds = bookings.map((b) => b.id);
  if (bookingIds.length === 0) {
    return c.json({ success: true, manifest: [] });
  }

  const passengers = await db
    .select()
    .from(schema.passengers)
    .where(inArray(schema.passengers.bookingId, bookingIds))
    .all();

  const refByBookingId = new Map(bookings.map((b) => [b.id, b.reference]));
  const manifest = passengers.map((p) => ({
    ...p,
    bookingReference: refByBookingId.get(p.bookingId) ?? null,
  }));

  return c.json({ success: true, manifest });
});

// GET /departures/:id/manifest/export — CSV export of the manifest.
departuresRouter.get("/:id/manifest/export", requireRole("operations", "management", "sales"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const departure = await db
    .select({ id: schema.departures.id })
    .from(schema.departures)
    .where(eq(schema.departures.id, id))
    .get();
  if (!departure) {
    return c.json({ success: false, error: "Departure not found" }, 404);
  }

  const bookings = await db
    .select({ id: schema.bookings.id, reference: schema.bookings.reference })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.departureId, id),
        ne(schema.bookings.status, "cancelled"),
        ne(schema.bookings.status, "draft"),
      ),
    )
    .all();

  const bookingIds = bookings.map((b) => b.id);
  const passengers =
    bookingIds.length > 0
      ? await db
          .select()
          .from(schema.passengers)
          .where(inArray(schema.passengers.bookingId, bookingIds))
          .all()
      : [];

  const refByBookingId = new Map(bookings.map((b) => [b.id, b.reference]));

  const header = [
    "Full Name",
    "Type",
    "Nationality",
    "Passport Number",
    "Passport Expiry",
    "Room Type",
    "Dietary Note",
    "Booking Reference",
  ];
  const escape = (v: string | null) =>
    v == null ? "" : `"${v.replace(/"/g, '""')}"`;

  const lines = passengers.map((p) =>
    [
      p.fullName,
      p.type,
      p.nationality ?? "",
      p.passportNumber ?? "",
      p.passportExpiry ?? "",
      p.roomType ?? "",
      p.dietaryNote ?? "",
      refByBookingId.get(p.bookingId) ?? "",
    ]
      .map((v) => escape(v))
      .join(","),
  );

  const csv = [header.map((h) => `"${h}"`).join(","), ...lines].join("\n");

  return c.text(csv, 200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="manifest-${id}.csv"`,
  });
});

export default departuresRouter;

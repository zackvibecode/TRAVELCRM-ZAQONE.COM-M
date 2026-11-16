import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export type PassengersEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const passengersRouter = new Hono<{
  Bindings: PassengersEnv;
  Variables: Variables;
}>();

interface PassengerInput {
  fullName: string;
  type: "adult" | "child" | "infant";
  dateOfBirth?: string;
  gender?: "male" | "female";
  nationality?: string;
  passportNumber?: string;
  passportExpiry?: string;
  phone?: string;
  roomType?: string;
  roomingNote?: string;
  dietaryNote?: string;
  flightInfo?: string;
}

function normalizeInput(p: PassengerInput): schema.NewPassengerRow {
  return {
    id: crypto.randomUUID(),
    bookingId: "", // set by caller
    fullName: p.fullName,
    type: p.type,
    dateOfBirth: p.dateOfBirth ?? null,
    gender: p.gender ?? null,
    nationality: p.nationality ?? null,
    passportNumber: p.passportNumber ?? null,
    passportExpiry: p.passportExpiry ?? null,
    phone: p.phone ?? null,
    roomType: p.roomType ?? null,
    roomingNote: p.roomingNote ?? null,
    dietaryNote: p.dietaryNote ?? null,
    flightInfo: p.flightInfo ?? null,
    createdAt: new Date().toISOString(),
  };
}

// GET /bookings/:bookingId/passengers
passengersRouter.get("/bookings/:bookingId/passengers", async (c) => {
  const db = c.get("db");
  const bookingId = c.req.param("bookingId");

  const booking = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .get();
  if (!booking) {
    return c.json({ success: false, error: "Booking not found" }, 404);
  }

  const rows = await db
    .select()
    .from(schema.passengers)
    .where(eq(schema.passengers.bookingId, bookingId))
    .all();

  return c.json({ success: true, passengers: rows });
});

// POST /bookings/:bookingId/passengers
passengersRouter.post("/bookings/:bookingId/passengers", async (c) => {
  const db = c.get("db");
  const bookingId = c.req.param("bookingId");

  const booking = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(eq(schema.bookings.id, bookingId))
    .get();
  if (!booking) {
    return c.json({ success: false, error: "Booking not found" }, 404);
  }

  let body: PassengerInput;
  try {
    body = await c.req.json<PassengerInput>();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.fullName || !body.type) {
    return c.json({ success: false, error: "fullName and type are required" }, 400);
  }

  const row = normalizeInput(body);
  row.bookingId = bookingId;

  await db.insert(schema.passengers).values(row).run();
  await db
    .insert(schema.bookingHistory)
    .values({
      id: crypto.randomUUID(),
      bookingId,
      action: "passenger_added",
      detail: `Passenger added: ${row.fullName}`,
      at: new Date().toISOString(),
    })
    .run();

  return c.json({ success: true, passenger: row }, 201);
});

// PATCH /passengers/:id
passengersRouter.patch("/passengers/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(schema.passengers)
    .where(eq(schema.passengers.id, id))
    .get();
  if (!existing) {
    return c.json({ success: false, error: "Passenger not found" }, 404);
  }

  let body: Partial<PassengerInput>;
  try {
    body = await c.req.json<Partial<PassengerInput>>();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const patch: Partial<schema.NewPassengerRow> = {};
  const fields: Array<keyof PassengerInput> = [
    "fullName",
    "type",
    "dateOfBirth",
    "gender",
    "nationality",
    "passportNumber",
    "passportExpiry",
    "phone",
    "roomType",
    "roomingNote",
    "dietaryNote",
    "flightInfo",
  ];
  for (const f of fields) {
    if (body[f] !== undefined) {
      (patch as Record<string, unknown>)[f] = body[f] ?? null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return c.json({ success: false, error: "No fields to update" }, 400);
  }

  await db.update(schema.passengers).set(patch).where(eq(schema.passengers.id, id)).run();
  await db
    .insert(schema.bookingHistory)
    .values({
      id: crypto.randomUUID(),
      bookingId: existing.bookingId,
      action: "passenger_updated",
      detail: `Passenger updated: ${existing.fullName}`,
      at: new Date().toISOString(),
    })
    .run();

  const updated = await db
    .select()
    .from(schema.passengers)
    .where(eq(schema.passengers.id, id))
    .get();

  return c.json({ success: true, passenger: updated });
});

// DELETE /passengers/:id
passengersRouter.delete("/passengers/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(schema.passengers)
    .where(eq(schema.passengers.id, id))
    .get();
  if (!existing) {
    return c.json({ success: false, error: "Passenger not found" }, 404);
  }

  await db.delete(schema.passengers).where(eq(schema.passengers.id, id)).run();
  await db
    .insert(schema.bookingHistory)
    .values({
      id: crypto.randomUUID(),
      bookingId: existing.bookingId,
      action: "passenger_removed",
      detail: `Passenger removed: ${existing.fullName}`,
      at: new Date().toISOString(),
    })
    .run();

  return c.json({ success: true });
});

export default passengersRouter;

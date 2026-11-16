import { Hono } from "hono";
import { and, desc, eq, gt, like, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { generateBookingReference } from "../lib/reference";
import { calculatePricing } from "../lib/pricing";
import { canTransition, type BookingStatus } from "../lib/status";

export type BookingsEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const bookingsRouter = new Hono<{ Bindings: BookingsEnv; Variables: Variables }>();

interface CreateBookingInput {
  customerId: string;
  packageId: string;
  departureId: string;
  type?: "individual" | "group";
  paxAdult?: number;
  paxChild?: number;
  paxInfant?: number;
  totalAmount: number;
  discount?: number;
  depositAmount?: number;
  paidAmount?: number;
  createdBy?: string;
  passengers?: Array<{
    id?: string;
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
  }>;
}

// GET /bookings — list with optional filters, search, and pagination.
bookingsRouter.get("/", async (c) => {
  const db = c.get("db");

  const status = c.req.query("status") as
    | (typeof schema.bookings.$inferSelect)["status"]
    | undefined;
  const type = c.req.query("type") as
    | (typeof schema.bookings.$inferSelect)["type"]
    | undefined;
  const paymentStatus = c.req.query("paymentStatus") as
    | (typeof schema.bookings.$inferSelect)["paymentStatus"]
    | undefined;
  const q = c.req.query("q")?.trim();
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "50"), 1), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

  const conditions = [];
  if (status) conditions.push(eq(schema.bookings.status, status));
  if (type) conditions.push(eq(schema.bookings.type, type));
  if (paymentStatus) {
    conditions.push(eq(schema.bookings.paymentStatus, paymentStatus));
  }
  if (q) {
    conditions.push(
      or(
        like(schema.bookings.reference, `%${q}%`),
        like(schema.bookings.customerId, `%${q}%`),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(schema.bookings)
      .where(where)
      .orderBy(desc(schema.bookings.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: schema.bookings.id })
      .from(schema.bookings)
      .where(where)
      .all(),
  ]);

  return c.json({
    success: true,
    bookings: rows,
    total: total.length,
    limit,
    offset,
  });
});

// GET /bookings/:id — detail with passengers and history.
bookingsRouter.get("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const booking = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, id))
    .get();

  if (!booking) {
    return c.json({ success: false, error: "Booking not found" }, 404);
  }

  const [passengers, history] = await Promise.all([
    db
      .select()
      .from(schema.passengers)
      .where(eq(schema.passengers.bookingId, id))
      .all(),
    db
      .select()
      .from(schema.bookingHistory)
      .where(eq(schema.bookingHistory.bookingId, id))
      .orderBy(desc(schema.bookingHistory.at))
      .all(),
  ]);

  return c.json({
    success: true,
    booking,
    passengers,
    history,
  });
});

// POST /bookings — create a booking (with passengers) atomically.
bookingsRouter.post("/", async (c) => {
  const db = c.get("db");

  let body: CreateBookingInput;
  try {
    body = await c.req.json<CreateBookingInput>();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.customerId || !body.packageId || !body.departureId) {
    return c.json(
      { success: false, error: "customerId, packageId and departureId are required" },
      400,
    );
  }

  const paxAdult = body.paxAdult ?? 0;
  const paxChild = body.paxChild ?? 0;
  const paxInfant = body.paxInfant ?? 0;
  const discount = body.discount ?? 0;
  const depositAmount = body.depositAmount ?? 0;
  const paidAmount = body.paidAmount ?? 0;
  const totalAmount = body.totalAmount;
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  const bookingId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Generate a unique reference, retrying on the (rare) collision.
  let reference = generateBookingReference();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db
      .select({ id: schema.bookings.id })
      .from(schema.bookings)
      .where(eq(schema.bookings.reference, reference))
      .get();
    if (!existing) break;
    reference = generateBookingReference();
  }

  const bookingRow: schema.NewBookingRow = {
    id: bookingId,
    reference,
    customerId: body.customerId,
    packageId: body.packageId,
    departureId: body.departureId,
    type: body.type ?? "individual",
    status: "draft",
    paymentStatus: "unpaid",
    paxAdult,
    paxChild,
    paxInfant,
    totalAmount,
    discount,
    depositAmount,
    paidAmount,
    balanceDue,
    createdBy: body.createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const passengerRows: schema.NewPassengerRow[] = (body.passengers ?? []).map(
    (p) => ({
      id: p.id ?? crypto.randomUUID(),
      bookingId,
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
      createdAt: now,
    }),
  );

  const historyRow: schema.NewBookingHistoryRow = {
    id: crypto.randomUUID(),
    bookingId,
    action: "created",
    detail: `Booking created (${bookingRow.type})`,
    user: body.createdBy ?? null,
    at: now,
  };

  // Atomic insert via D1 batch.
  await db.batch([
    db.insert(schema.bookings).values(bookingRow),
    ...(passengerRows.length > 0
      ? [db.insert(schema.passengers).values(passengerRows)]
      : []),
    db.insert(schema.bookingHistory).values(historyRow),
  ]);

  return c.json(
    {
      success: true,
      booking: { id: bookingId, reference, status: bookingRow.status },
    },
    201,
  );
});

interface RecalculateInput {
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  discount?:
    | { kind: "amount"; value: number }
    | { kind: "percent"; value: number };
  paidAmount?: number;
}

// POST /bookings/:id/recalculate — recompute pricing and persist.
bookingsRouter.post("/:id/recalculate", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const booking = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, id))
    .get();
  if (!booking) {
    return c.json({ success: false, error: "Booking not found" }, 404);
  }

  let body: RecalculateInput;
  try {
    body = await c.req.json<RecalculateInput>();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (
    typeof body.adultPrice !== "number" ||
    typeof body.childPrice !== "number" ||
    typeof body.infantPrice !== "number"
  ) {
    return c.json(
      { success: false, error: "adultPrice, childPrice and infantPrice are required" },
      400,
    );
  }

  const result = calculatePricing(
    { adultPrice: body.adultPrice, childPrice: body.childPrice, infantPrice: body.infantPrice },
    {
      paxAdult: booking.paxAdult,
      paxChild: booking.paxChild,
      paxInfant: booking.paxInfant,
    },
    body.discount,
  );

  const paidAmount = body.paidAmount ?? booking.paidAmount;
  const balanceDue = Math.max(0, result.total - paidAmount);
  const now = new Date().toISOString();

  await db
    .update(schema.bookings)
    .set({
      totalAmount: result.total,
      discount: result.discount,
      paidAmount,
      balanceDue,
      updatedAt: now,
    })
    .where(eq(schema.bookings.id, id))
    .run();

  await db
    .insert(schema.bookingHistory)
    .values({
      id: crypto.randomUUID(),
      bookingId: id,
      action: "pricing_recalculated",
      detail: `Total recalculated to ${result.total} (discount ${result.discount})`,
      at: now,
    })
    .run();

  return c.json({ success: true, pricing: result, balanceDue });
});

interface StatusTransitionInput {
  status: BookingStatus;
  user?: string;
  note?: string;
}

// POST /bookings/:id/status — transition booking status with history.
bookingsRouter.post("/:id/status", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const booking = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, id))
    .get();
  if (!booking) {
    return c.json({ success: false, error: "Booking not found" }, 404);
  }

  let body: StatusTransitionInput;
  try {
    body = await c.req.json<StatusTransitionInput>();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.status) {
    return c.json({ success: false, error: "status is required" }, 400);
  }

  const from = booking.status as BookingStatus;
  if (!canTransition(from, body.status)) {
    return c.json(
      {
        success: false,
        error: `Cannot transition from '${from}' to '${body.status}'`,
        from,
        to: body.status,
      },
      409,
    );
  }

  const now = new Date().toISOString();
  await db
    .update(schema.bookings)
    .set({ status: body.status, updatedAt: now })
    .where(eq(schema.bookings.id, id))
    .run();

  await db
    .insert(schema.bookingHistory)
    .values({
      id: crypto.randomUUID(),
      bookingId: id,
      action: "status_changed",
      detail: `${from} → ${body.status}${body.note ? ` (${body.note})` : ""}`,
      user: body.user ?? null,
      at: now,
    })
    .run();

  return c.json({ success: true, status: body.status, from });
});

interface CancellationInput {
  reason?: string;
  user?: string;
}

// POST /bookings/:id/cancel — cancel a booking and release its seats.
bookingsRouter.post("/:id/cancel", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const booking = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.id, id))
    .get();
  if (!booking) {
    return c.json({ success: false, error: "Booking not found" }, 404);
  }

  const from = booking.status as BookingStatus;
  if (!canTransition(from, "cancelled")) {
    return c.json(
      {
        success: false,
        error: `Cannot cancel a booking in '${from}' status`,
      },
      409,
    );
  }

  let body: CancellationInput;
  try {
    body = await c.req.json<CancellationInput>().catch(() => ({}));
  } catch {
    body = {};
  }

  const totalPax =
    booking.paxAdult + booking.paxChild + booking.paxInfant;
  const now = new Date().toISOString();

  // Release seats if the booking was in a seat-consuming state and a
  // departure row exists. Uses a guarded decrement so seatsBooked never
  // drops below zero (no negative inventory).
  const departure = await db
    .select({ id: schema.departures.id, seatsBooked: schema.departures.seatsBooked })
    .from(schema.departures)
    .where(eq(schema.departures.id, booking.departureId))
    .get();

  let seatsReleased = 0;
  if (departure && departure.seatsBooked > 0 && totalPax > 0) {
    seatsReleased = Math.min(departure.seatsBooked, totalPax);
  }

  const cancelBooking = db
    .update(schema.bookings)
    .set({ status: "cancelled", updatedAt: now })
    .where(eq(schema.bookings.id, id));
  const recordHistory = db
    .insert(schema.bookingHistory)
    .values({
      id: crypto.randomUUID(),
      bookingId: id,
      action: "cancelled",
      detail: body.reason ? `Booking cancelled: ${body.reason}` : "Booking cancelled",
      user: body.user ?? null,
      at: now,
    });

  if (seatsReleased > 0) {
    await db.batch([
      cancelBooking,
      db
        .update(schema.departures)
        .set({
          seatsBooked: sql`MAX(0, ${schema.departures.seatsBooked} - ${seatsReleased})`,
          updatedAt: now,
        })
        .where(eq(schema.departures.id, departure!.id)),
      recordHistory,
    ]);
  } else {
    await db.batch([cancelBooking, recordHistory]);
  }

  return c.json({
    success: true,
    status: "cancelled",
    seatsReleased,
    totalPax,
  });
});

export default bookingsRouter;

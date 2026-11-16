import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { generateBookingReference } from "../lib/reference";

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

export default bookingsRouter;

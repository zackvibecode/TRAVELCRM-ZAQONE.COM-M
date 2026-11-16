import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export type AvailabilityResult = {
  departureId: string;
  seatCapacity: number;
  seatsBooked: number;
  seatsHeld: number;
  seatsAvailable: number;
};

export type HoldResult =
  | { ok: true; holdId: string; seatsAvailable: number }
  | { ok: false; reason: "not_found" | "insufficient"; seatsAvailable: number };

function expiryFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export async function getAvailability(
  db: DrizzleD1Database<typeof schema>,
  departureId: string,
): Promise<AvailabilityResult | null> {
  const row = await db
    .select({
      seatCapacity: schema.departures.seatCapacity,
      seatsBooked: schema.departures.seatsBooked,
      seatsHeld: schema.departures.seatsHeld,
    })
    .from(schema.departures)
    .where(eq(schema.departures.id, departureId))
    .get();

  if (!row) return null;

  return {
    departureId,
    seatCapacity: row.seatCapacity,
    seatsBooked: row.seatsBooked,
    seatsHeld: row.seatsHeld,
    seatsAvailable: Math.max(
      0,
      row.seatCapacity - row.seatsBooked - row.seatsHeld,
    ),
  };
}

/**
 * Atomically holds `count` seats on a departure. The guarded UPDATE only
 * increments `seats_held` when there are enough free seats, so concurrent
 * requests cannot overbook. Returns the created hold id on success.
 */
export async function holdSeats(
  db: DrizzleD1Database<typeof schema>,
  departureId: string,
  count: number,
  heldBy?: string,
  holdMinutes = 15,
): Promise<HoldResult> {
  const availability = await getAvailability(db, departureId);
  if (!availability) return { ok: false, reason: "not_found", seatsAvailable: 0 };

  const holdId = crypto.randomUUID();
  const expiresAt = expiryFromNow(holdMinutes);
  const now = new Date().toISOString();

  // Atomic guarded increment: only succeeds if enough seats remain.
  const result = await db
    .update(schema.departures)
    .set({
      seatsHeld: sql`${schema.departures.seatsHeld} + ${count}`,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.departures.id, departureId),
        sql`${schema.departures.seatCapacity} - ${schema.departures.seatsBooked} - ${schema.departures.seatsHeld} >= ${count}`,
      ),
    )
    .run();

  if (result.meta.changes === 0) {
    return {
      ok: false,
      reason: "insufficient",
      seatsAvailable: availability.seatsAvailable,
    };
  }

  await db
    .insert(schema.seatHolds)
    .values({
      id: holdId,
      departureId,
      seatCount: count,
      heldBy: heldBy ?? null,
      status: "active",
      expiresAt,
      createdAt: now,
    })
    .run();

  const after = await getAvailability(db, departureId);
  return {
    ok: true,
    holdId,
    seatsAvailable: after?.seatsAvailable ?? 0,
  };
}

/**
 * Converts an active hold into booked seats (booking confirmed), atomically
 * moving seats from `seats_held` to `seats_booked`.
 */
export async function convertHold(
  db: DrizzleD1Database<typeof schema>,
  holdId: string,
): Promise<{ ok: boolean; seatsReleased?: number }> {
  const hold = await db
    .select()
    .from(schema.seatHolds)
    .where(eq(schema.seatHolds.id, holdId))
    .get();

  if (!hold || hold.status !== "active") return { ok: false };

  const now = new Date().toISOString();
  const count = hold.seatCount;

  await db.batch([
    db
      .update(schema.departures)
      .set({
        seatsHeld: sql`MAX(0, ${schema.departures.seatsHeld} - ${count})`,
        seatsBooked: sql`${schema.departures.seatsBooked} + ${count}`,
        updatedAt: now,
      })
      .where(eq(schema.departures.id, hold.departureId)),
    db
      .update(schema.seatHolds)
      .set({ status: "converted", releasedAt: now })
      .where(eq(schema.seatHolds.id, holdId)),
  ]);

  return { ok: true };
}

/**
 * Releases an active hold, returning seats to the available pool.
 */
export async function releaseHold(
  db: DrizzleD1Database<typeof schema>,
  holdId: string,
): Promise<{ ok: boolean }> {
  const hold = await db
    .select()
    .from(schema.seatHolds)
    .where(eq(schema.seatHolds.id, holdId))
    .get();

  if (!hold || hold.status !== "active") return { ok: false };

  const now = new Date().toISOString();
  const count = hold.seatCount;

  await db.batch([
    db
      .update(schema.departures)
      .set({
        seatsHeld: sql`MAX(0, ${schema.departures.seatsHeld} - ${count})`,
        updatedAt: now,
      })
      .where(eq(schema.departures.id, hold.departureId)),
    db
      .update(schema.seatHolds)
      .set({ status: "released", releasedAt: now })
      .where(eq(schema.seatHolds.id, holdId)),
  ]);

  return { ok: true };
}

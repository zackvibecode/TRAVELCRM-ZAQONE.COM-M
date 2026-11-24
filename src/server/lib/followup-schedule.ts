import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { scheduleFirstFollowupKL, scheduleNextStageKL } from "./followup-schedule-kl";

type Db = DrizzleD1Database<typeof schema>;

export type StageCode = "FU1" | "FU2" | "FU3";

/** Stage sequence order — FU1 is first. */
export const STAGE_ORDER: Record<StageCode, number> = { FU1: 1, FU2: 2, FU3: 3 };

/**
 * Fallback offsets (days) used only when the `followup_stages` row is
 * missing or misconfigured. They mirror the seeded values so the engine
 * still behaves predictably if an admin deletes a stage row.
 */
const FALLBACK_OFFSET_DAYS: Record<StageCode, number> = { FU1: 1, FU2: 3, FU3: 7 };

/**
 * Resolves the configured day offset for a stage.
 *
 * Semantics (per the schema comment on `offset_days`): the offset is counted
 * **from the previous stage**, or from lead creation for FU1. So a lead gets
 * its first follow-up `offset_days(FU1)` after import, and after a stage is
 * confirmed the next one is scheduled `offset_days(next)` later.
 */
export async function stageOffsetDays(db: Db, stage: StageCode): Promise<number> {
  const [row] = await db
    .select({ offsetDays: schema.followupStages.offsetDays })
    .from(schema.followupStages)
    .where(eq(schema.followupStages.code, stage))
    .limit(1);
  const offset = row?.offsetDays;
  // Guard against a bad admin edit (0, negative, or absurdly large) — fall
  // back to the default rather than scheduling a follow-up in the past.
  if (offset === undefined || !Number.isFinite(offset) || offset < 1 || offset > 365) {
    return FALLBACK_OFFSET_DAYS[stage];
  }
  return offset;
}

/**
 * Instant of the first follow-up (FU1) for a lead created at `fromMs`.
 * Adds the configured KL calendar days, then snaps into business hours.
 */
export async function firstFollowupAt(db: Db, fromMs: number = Date.now()): Promise<Date> {
  const days = await stageOffsetDays(db, "FU1");
  return new Date(scheduleFirstFollowupKL(fromMs, days));
}

/**
 * Instant of the follow-up after `stage` is confirmed at `fromMs`.
 * Adds the configured KL calendar days, then snaps into business hours.
 */
export async function nextStageFollowupAt(
  db: Db,
  stage: StageCode,
  fromMs: number = Date.now(),
): Promise<Date> {
  const days = await stageOffsetDays(db, stage);
  return new Date(scheduleNextStageKL(fromMs, days));
}

/** The stage that follows `stage`, or null when the sequence is exhausted. */
export function nextStageOf(stage: StageCode): StageCode | null {
  const next = STAGE_ORDER[stage] + 1;
  return next <= 3 ? (`FU${next}` as StageCode) : null;
}

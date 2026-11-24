import { and, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

type DB = DrizzleD1Database<typeof schema>;

/**
 * How long a follow-up may stay overdue (past its next_followup_at) before
 * the engine pauses the lead automatically. Two weeks is deliberately
 * generous: it removes abandoned leads from the daily queue without
 * penalising a rep who is a few days behind.
 */
export const AUTO_PAUSE_AFTER_DAYS = 14;

const DAY_MS = 86_400_000;

/**
 * Scheduled follow-up maintenance (run by Cloudflare cron):
 * auto-pause leads whose follow-up has been overdue for too long.
 *
 * Rules:
 *  - Only `active` leads with a past `next_followup_at` are considered.
 *  - A lead is paused when it has been overdue for >= AUTO_PAUSE_AFTER_DAYS.
 *  - A lead that was contacted recently (within the same window) is left
 *    alone: the rep is still working it, only the schedule slipped.
 *  - `paused` / `done` / `escalated` leads are never touched — escalation is
 *    an admin-review state and must survive.
 *
 * Each pause writes a lead_activities row so the timeline shows it was the
 * engine (not the rep) that paused the sequence.
 *
 * Returns { scanned, paused } for logging.
 */
export async function runAutoPause(db: DB, nowMs: number = Date.now()): Promise<{
  scanned: number;
  paused: number;
}> {
  const cutoffIso = new Date(nowMs - AUTO_PAUSE_AFTER_DAYS * DAY_MS).toISOString();
  const recentlyContactedIso = cutoffIso;

  // Candidates: active, overdue beyond the threshold. A lead with no
  // schedule at all is not "overdue" and is skipped.
  const candidates = await db
    .select({
      id: schema.leads.id,
      name: schema.leads.name,
      ownerUserId: schema.leads.ownerUserId,
      nextFollowupAt: schema.leads.nextFollowupAt,
      lastContactedAt: schema.leads.lastContactedAt,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.followupState, "active"),
        isNotNull(schema.leads.nextFollowupAt),
        lt(schema.leads.nextFollowupAt, cutoffIso),
        // Not contacted within the window — a recently touched lead is still
        // being worked and must not be auto-paused.
        or(
          sql`${schema.leads.lastContactedAt} IS NULL`,
          lt(schema.leads.lastContactedAt, recentlyContactedIso),
        ),
      ),
    )
    .all();

  let paused = 0;
  const nowIso = new Date(nowMs).toISOString();

  for (const lead of candidates) {
    await db
      .update(schema.leads)
      .set({
        followupState: "paused",
        pausedAt: nowIso,
        pauseReason: `auto: overdue > ${AUTO_PAUSE_AFTER_DAYS} days without contact`,
        updatedAt: nowIso,
      })
      .where(eq(schema.leads.id, lead.id));

    await db.insert(schema.leadActivities).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: "pause",
      text: `Follow-up paused automatically: no contact for over ${AUTO_PAUSE_AFTER_DAYS} days.`,
      user: "system",
      at: nowIso,
    });
    paused++;
  }

  return { scanned: candidates.length, paused };
}

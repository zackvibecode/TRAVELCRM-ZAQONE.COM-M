/**
 * Personal pipeline aggregation for the Dashboard ("My Pipeline" cards).
 *
 * One owner's leads summarised as:
 *   counts   — lead count per sales-pipeline stage (new/contacted/…/lost)
 *   overdue  — active leads whose next follow-up is before today (KL)
 *   dueToday — active leads whose next follow-up falls inside today (KL)
 *
 * The two "action queues" use the same KL-day boundary as the Follow-Up
 * Center (`klTodayWindow`), so the number on the dashboard equals the rows
 * the rep sees when they click through. Paused / done / escalated leads are
 * excluded from the queues — they are not actionable today.
 *
 * The module is pure data access: the route layer decides WHO the owner is
 * (SALES = self, ADMIN = self or ?owner=) and passes that id in.
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { klTodayWindow } from "./kl-time";

type DB = DrizzleD1Database<typeof schema>;

/** Pipeline stages counted on the summary card (matches LeadStatus in the UI). */
export const PIPELINE_STAGES = [
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
  "archived",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface PipelineSummary {
  /** Lead count per pipeline stage; stages with 0 leads are omitted. */
  counts: Partial<Record<PipelineStage, number>>;
  /** Active leads with a next follow-up before today's KL window. */
  overdue: number;
  /** Active leads with a next follow-up due before the end of today (KL). */
  dueToday: number;
  /** Total leads owned, across every stage (for context / sanity). */
  total: number;
  /** The KL day boundary the queues were measured against. */
  window: { start: string; end: string };
}

/**
 * Aggregate one owner's pipeline. Two queries:
 *   1. counts per stage (GROUP BY stage) — one round trip for all stages.
 *   2. the owner's active, scheduled leads — the small set from which the
 *      due-today / overdue split is derived against the KL day window.
 * Both go through leads_owner_state_next_idx / leads_owner_stage_idx.
 */
export async function pipelineSummary(db: DB, ownerUserId: string): Promise<PipelineSummary> {
  const { startMs, endMs } = klTodayWindow();

  const [stageRows, scheduled] = await Promise.all([
    db
      .select({ stage: schema.leads.stage, count: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.leads)
      .where(eq(schema.leads.ownerUserId, ownerUserId))
      .groupBy(schema.leads.stage)
      .all(),
    db
      .select({ nextFollowupAt: schema.leads.nextFollowupAt })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.ownerUserId, ownerUserId),
          eq(schema.leads.followupState, "active"),
          isNotNull(schema.leads.nextFollowupAt),
        ),
      )
      .all(),
  ]);

  const counts: Partial<Record<PipelineStage, number>> = {};
  let total = 0;
  for (const row of stageRows) {
    // Legacy rows may carry a stage outside the UI enum; count them under
    // total but do not invent a bucket the frontend cannot render.
    if ((PIPELINE_STAGES as readonly string[]).includes(row.stage)) {
      counts[row.stage as PipelineStage] = row.count;
    }
    total += row.count;
  }

  let overdue = 0;
  let dueToday = 0;
  for (const row of scheduled) {
    const t = row.nextFollowupAt ? Date.parse(row.nextFollowupAt) : NaN;
    if (Number.isNaN(t) || t >= endMs) continue;
    if (t < startMs) overdue++;
    else dueToday++;
  }

  return {
    counts,
    overdue,
    dueToday,
    total,
    window: {
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
    },
  };
}

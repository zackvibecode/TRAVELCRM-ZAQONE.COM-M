/**
 * Unique-activity statistics for the Dashboard & Leaderboard.
 *
 * The plan is explicit: the leaderboard ranks sales by UNIQUE follow-up
 * activity — "not by clicks or messages". So every metric here is built
 * from `followup_activities` rows that were manually confirmed
 * (`confirmed = 1`) and is de-duplicated before it counts:
 *
 *   completed    — number of confirmed follow-ups (FU1/FU2/FU3 confirmations)
 *   uniqueLeads  — DISTINCT lead_id touched in the period (same lead = 1)
 *   activeDays   — DISTINCT KL calendar days with ≥1 confirmation
 *   won          — leads closed as "won" in the period (followup_completed_at)
 *
 * Day buckets are computed on the Asia/Kuala_Lumpur calendar, not UTC: a
 * confirmation at 01:00 KL is still "today" for the rep, although its UTC
 * timestamp already carries the next date. Buckets are derived in JS from
 * the raw ISO value via klTodayIso() so the dashboard agrees with the
 * Follow-Up Center's day boundary.
 *
 * All queries are range-bounded and go through
 * followup_activities_user_confirmed_at_idx / _confirmed_at_idx.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { klTodayIso } from "./kl-time";
import { withinRange, type KlRange, type OwnerScope } from "./dashboard-filter";

type DB = DrizzleD1Database<typeof schema>;

/** Leaderboard row — one sales rep's follow-up counts for a period. */
export interface SalesScoreRow {
  /** Staff user id — mirrors SalesScore.id (rows are keyed by it in the UI). */
  id: string;
  /** Staff user id again, as SalesScore.userId (used to highlight the signed-in rep). */
  userId: string;
  name: string;
  /** Total confirmed follow-ups (FU1 + FU2 + FU3). */
  completed: number;
  /** Confirmed FU1 follow-ups. */
  fu1: number;
  /** Confirmed FU2 follow-ups. */
  fu2: number;
  /** Confirmed FU3 follow-ups. */
  fu3: number;
  uniqueLeads: number;
  activeDays: number;
  won: number;
  /** Total leads currently owned by this rep, across every stage. */
  leadsOwned: number;
}

/** One KL day of trend data — same shape as `TrendPoint` in the frontend. */
export interface TrendBucket {
  /** ISO date (YYYY-MM-DD) of the KL day — stable key for charting. */
  date: string;
  /** Confirmed follow-ups that day. */
  followups: number;
  /** Distinct leads touched that day. */
  uniqueLeads: number;
}

/** Reusable WHERE for the activity table inside a period. */
function activityWhere(range: KlRange | null, scope: OwnerScope) {
  return and(
    eq(schema.followupActivities.confirmed, true),
    withinRange(schema.followupActivities.at, range),
    scope.scoped ? eq(schema.followupActivities.user, scope.ownerUserId!) : undefined,
  );
}

/**
 * Per-rep scores for a period. Reps with no confirmed activity in the period
 * are NOT returned (the leaderboard ranks active reps; the frontend shows
 * an empty state when the list is empty). Names are resolved from `user`.
 */
export async function salesScores(
  db: DB,
  range: KlRange | null,
  scope: OwnerScope = { scoped: false, ownerUserId: null },
): Promise<SalesScoreRow[]> {
  // One GROUP BY over the confirmed window. COUNT(DISTINCT …) is computed
  // in SQL for uniqueLeads; completed is split per FU stage (FU1/FU2/FU3).
  // activeDays needs KL day buckets so it is derived below from the day list.
  const rows = await db
    .select({
      userId: schema.followupActivities.user,
      completed: sql<number>`count(*)`.mapWith(Number),
      fu1: sql<number>`coalesce(sum(case when ${schema.followupActivities.stage} = 'FU1' then 1 else 0 end), 0)`.mapWith(Number),
      fu2: sql<number>`coalesce(sum(case when ${schema.followupActivities.stage} = 'FU2' then 1 else 0 end), 0)`.mapWith(Number),
      fu3: sql<number>`coalesce(sum(case when ${schema.followupActivities.stage} = 'FU3' then 1 else 0 end), 0)`.mapWith(Number),
      uniqueLeads: sql<number>`count(distinct ${schema.followupActivities.leadId})`.mapWith(Number),
    })
    .from(schema.followupActivities)
    .where(activityWhere(range, scope))
    .groupBy(schema.followupActivities.user)
    .all();

  if (rows.length === 0) return [];

  // Day list per rep (raw ISO) → distinct KL dates. One query, grouped by
  // rep + KL date would need a KL-aware expression SQLite lacks, so the
  // distinct-day computation is done in JS on the (small) window rows.
  const days = await db
    .select({ userId: schema.followupActivities.user, at: schema.followupActivities.at })
    .from(schema.followupActivities)
    .where(activityWhere(range, scope))
    .all();
  const activeDays = new Map<string, Set<string>>();
  for (const d of days) {
    let set = activeDays.get(d.userId);
    if (!set) {
      set = new Set();
      activeDays.set(d.userId, set);
    }
    const t = Date.parse(d.at);
    if (!Number.isNaN(t)) set.add(klTodayIso(new Date(t)));
  }

  // "Won" in the period: leads closed as won by this rep (owner).
  const userIds = rows.map((r) => r.userId);
  const wonRows = await db
    .select({ owner: schema.leads.ownerUserId, won: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.followupStatus, "won"),
        inArray(schema.leads.ownerUserId, userIds),
        withinRange(schema.leads.followupCompletedAt, range),
      ),
    )
    .groupBy(schema.leads.ownerUserId)
    .all();
  const wonByOwner = new Map(wonRows.map((w) => [w.owner, w.won]));

  // Total leads owned by each rep (all stages) — "how many leads they have".
  const ownedRows = await db
    .select({ owner: schema.leads.ownerUserId, owned: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.leads)
    .where(inArray(schema.leads.ownerUserId, userIds))
    .groupBy(schema.leads.ownerUserId)
    .all();
  const ownedByOwner = new Map(ownedRows.map((o) => [o.owner, o.owned]));

  // Resolve display names (only for reps that appear in the ranking).
  const users = await db
    .select({ id: schema.user.id, name: schema.user.name })
    .from(schema.user)
    .where(inArray(schema.user.id, userIds))
    .all();
  const names = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.userId,
    userId: r.userId,
    name: names.get(r.userId) ?? r.userId,
    completed: r.completed,
    fu1: r.fu1,
    fu2: r.fu2,
    fu3: r.fu3,
    uniqueLeads: r.uniqueLeads,
    activeDays: activeDays.get(r.userId)?.size ?? 0,
    won: wonByOwner.get(r.userId) ?? 0,
    leadsOwned: ownedByOwner.get(r.userId) ?? 0,
  }));
}

/** Totals across every rep in scope — for the team summary cards. */
export interface TeamTotals {
  uniqueLeads: number;
  completed: number;
  fu1: number;
  fu2: number;
  fu3: number;
  won: number;
  activeSales: number;
  leadsOwned: number;
}

export function teamTotals(scores: SalesScoreRow[]): TeamTotals {
  let uniqueLeads = 0;
  let completed = 0;
  let fu1 = 0;
  let fu2 = 0;
  let fu3 = 0;
  let won = 0;
  let leadsOwned = 0;
  for (const s of scores) {
    uniqueLeads += s.uniqueLeads;
    completed += s.completed;
    fu1 += s.fu1;
    fu2 += s.fu2;
    fu3 += s.fu3;
    won += s.won;
    leadsOwned += s.leadsOwned;
  }
  return { uniqueLeads, completed, fu1, fu2, fu3, won, activeSales: scores.length, leadsOwned };
}

/**
 * Daily trend for the last `days` KL days ending today (inclusive). Days
 * with no activity are returned with zeros so the chart has a continuous
 * line. `followups` = confirmed rows that day; `uniqueLeads` = distinct
 * leads touched that day.
 */
export async function dailyTrend(
  db: DB,
  days: number,
  scope: OwnerScope = { scoped: false, ownerUserId: null },
  nowMs: number = Date.now(),
): Promise<TrendBucket[]> {
  const n = Math.min(Math.max(Math.trunc(days) || 7, 1), 90);
  // Build the KL-day buckets first so the query range exactly covers them.
  const todayIso = klTodayIso(new Date(nowMs));
  const todayStartMs = Date.parse(`${todayIso}T00:00:00Z`) - 8 * 3_600_000;
  const fromMs = todayStartMs - (n - 1) * 86_400_000;
  const range: KlRange = {
    fromMs,
    toMs: todayStartMs + 86_400_000,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(todayStartMs + 86_400_000).toISOString(),
  };

  const buckets = new Map<string, { followups: number; leads: Set<string> }>();
  for (let i = 0; i < n; i++) {
    const d = new Date(fromMs + i * 86_400_000);
    buckets.set(klTodayIso(d), { followups: 0, leads: new Set() });
  }

  const rows = await db
    .select({ at: schema.followupActivities.at, leadId: schema.followupActivities.leadId })
    .from(schema.followupActivities)
    .where(activityWhere(range, scope))
    .all();

  for (const r of rows) {
    const t = Date.parse(r.at);
    if (Number.isNaN(t)) continue;
    const b = buckets.get(klTodayIso(new Date(t)));
    if (!b) continue;
    b.followups++;
    b.leads.add(r.leadId);
  }

  return [...buckets.entries()].map(([date, b]) => ({
    date,
    followups: b.followups,
    uniqueLeads: b.leads.size,
  }));
}

/**
 * Dashboard query filters: ranking period + sales scope.
 *
 * The Dashboard & Ranking feature (Phase 6) lets the user pick a period
 * (`week` / `month` / `all`) and, for admins, narrow the view to one sales
 * rep. Both map onto query parameters on `/api/followup/dashboard/*` and
 * `/api/followup/leaderboard`. This module is the single place that turns
 * those raw params into (a) a KL-calendar date range and (b) an owner scope,
 * so every dashboard endpoint agrees on what "this week" means.
 *
 * All boundaries are computed on the Asia/Kuala_Lumpur calendar: "this week"
 * starts Monday 00:00 KL, "this month" starts on the 1st 00:00 KL. That is
 * the same day boundary the Follow-Up Center uses, so dashboard counts match
 * what the rep sees in their task list.
 */
import { and, gte, lt, type SQL } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { KL_OFFSET_MINUTES } from "./kl-time";
import { klParts, klMs } from "./followup-schedule-kl";
import type { FollowupAccessRole } from "./owned-lead";

const DAY_MS = 86_400_000;

/** Ranking periods understood by the dashboard (mirrors the frontend tabs). */
export type DashboardPeriod = "week" | "month" | "all";

export const DASHBOARD_PERIODS: readonly DashboardPeriod[] = ["week", "month", "all"];

/** Default when the client sends nothing — same default as the UI tabs. */
export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = "month";

/**
 * Parse the `period` query parameter. Unknown or missing values fall back
 * to the default rather than erroring, so a stale bookmark still loads.
 */
export function parsePeriodParam(raw: string | undefined | null): DashboardPeriod {
  const v = (raw ?? "").trim().toLowerCase();
  return (DASHBOARD_PERIODS as readonly string[]).includes(v)
    ? (v as DashboardPeriod)
    : DEFAULT_DASHBOARD_PERIOD;
}

/** A half-open [fromMs, toMs) instant range on the KL calendar. */
export interface KlRange {
  fromMs: number;
  toMs: number;
  /** ISO strings for logging / echoing back to the client. */
  fromIso: string;
  toIso: string;
}

/** Build a KlRange from epoch ms bounds. */
function rangeFrom(fromMs: number, toMs: number): KlRange {
  return { fromMs, toMs, fromIso: new Date(fromMs).toISOString(), toIso: new Date(toMs).toISOString() };
}

/**
 * Start of the KL day (00:00 Asia/Kuala_Lumpur) containing `ms`.
 */
function klStartOfDay(ms: number): number {
  const { year, month, day } = klParts(ms);
  return klMs(year, month, day, 0);
}

/** 0 = Monday … 6 = Sunday, derived from the JS weekday (0 = Sunday). */
function mondayIndex(weekday: number): number {
  return (weekday + 6) % 7;
}

/**
 * The current period's range for "now", or `null` for `all` (unbounded).
 *   week  → Monday 00:00 KL … next Monday 00:00 KL
 *   month → 1st 00:00 KL … 1st of next month 00:00 KL
 * The end bound is "now" rounded up to the end of the KL day so that a
 * follow-up scheduled later today still counts as inside the period.
 */
export function periodRangeKL(period: DashboardPeriod, nowMs: number = Date.now()): KlRange | null {
  if (period === "all") return null;
  const { year, month, day, weekday } = klParts(nowMs);
  const todayStart = klStartOfDay(nowMs);

  if (period === "week") {
    const monday = todayStart - mondayIndex(weekday) * DAY_MS;
    return rangeFrom(monday, todayStart + DAY_MS);
  }

  // month: first of the current month → first of the next month.
  const monthStart = klMs(year, month, 1, 0);
  const nextMonth = month === 12 ? klMs(year + 1, 1, 1, 0) : klMs(year, month + 1, 1, 0);
  return rangeFrom(monthStart, Math.min(nextMonth, todayStart + DAY_MS));
}

/**
 * The immediately preceding period of the same length — used by the
 * "comparison between periods" panel. For `week` it is last Monday–Sunday,
 * for `month` the whole previous calendar month. `all` has no previous
 * window (null).
 */
export function previousRangeKL(period: DashboardPeriod, nowMs: number = Date.now()): KlRange | null {
  if (period === "all") return null;
  const { year, month, weekday } = klParts(nowMs);
  const todayStart = klStartOfDay(nowMs);

  if (period === "week") {
    const thisMonday = todayStart - mondayIndex(weekday) * DAY_MS;
    return rangeFrom(thisMonday - 7 * DAY_MS, thisMonday);
  }

  // Previous calendar month (its length may differ from the current one).
  const prevStart = month === 1 ? klMs(year - 1, 12, 1, 0) : klMs(year, month - 1, 1, 0);
  const prevEnd = klMs(year, month, 1, 0);
  return rangeFrom(prevStart, prevEnd);
}

/**
 * Drizzle condition: `column` falls inside [fromMs, toMs). Half-open so
 * adjacent periods never double-count an event exactly on the boundary.
 * Returns undefined for an unbounded (`all`) range.
 *
 * `column` is a text column holding ISO-ish timestamps; comparing as ISO
 * strings in SQLite is equivalent to comparing instants because every
 * writer stores `toISOString()` (fixed width, UTC "Z").
 */
export function withinRange(
  column: AnySQLiteColumn,
  range: KlRange | null,
): SQL | undefined {
  if (!range) return undefined;
  return and(gte(column, range.fromIso), lt(column, range.toIso))!;
}

/** Owner scope resolved for the caller. */
export interface OwnerScope {
  /** True when the query must be restricted to a single owner. */
  scoped: boolean;
  /** The owner user id when `scoped`, otherwise null. */
  ownerUserId: string | null;
}

/**
 * Resolve the `owner` / `sales` filter against the caller's access role.
 *
 * - SALES are ALWAYS scoped to themselves — the parameter is ignored so a
 *   rep can never read a colleague's numbers (neutral, no error leak).
 * - ADMIN may pass "all" (or nothing) for the whole team, or a user id to
 *   narrow the view.
 */
export function parseOwnerFilter(
  raw: string | undefined | null,
  access: FollowupAccessRole,
  staffId: string,
): OwnerScope {
  if (access === "SALES") return { scoped: true, ownerUserId: staffId };
  const v = (raw ?? "").trim();
  if (v === "" || v.toLowerCase() === "all") return { scoped: false, ownerUserId: null };
  return { scoped: true, ownerUserId: v };
}

/** Epoch ms of the KL day boundary — exported for tests & logging. */
export const KL_OFFSET_MS = KL_OFFSET_MINUTES * 60_000;

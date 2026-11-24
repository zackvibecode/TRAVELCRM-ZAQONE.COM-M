/**
 * Asia/Kuala_Lumpur time helpers. Malaysia is UTC+8 year-round (no DST),
 * so a fixed offset is exact. All follow-up scheduling math (today's task
 * list, overdue queue) runs against the KL working day.
 */

export const KL_OFFSET_MINUTES = 8 * 60;

/** IANA zone every dashboard response is measured and labelled in. */
export const KL_TIMEZONE = "Asia/Kuala_Lumpur";

/**
 * Today's KL day as an ISO window object, ready to embed in an API response
 * (same `{ start, end }` shape every dashboard endpoint returns).
 */
export function klWindow(now: Date = new Date()): { start: string; end: string } {
  const { startMs, endMs } = klTodayWindow(now);
  return { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

/** ISO date (YYYY-MM-DD) of "now" in Kuala Lumpur. */
export function klTodayIso(now: Date = new Date()): string {
  const kl = new Date(now.getTime() + KL_OFFSET_MINUTES * 60_000);
  return kl.toISOString().slice(0, 10);
}

/** Epoch ms of 00:00 Asia/Kuala_Lumpur for the given UTC instant. */
export function klStartOfDayMs(now: Date = new Date()): number {
  const klMidnightUtcMs = Date.parse(`${klTodayIso(now)}T00:00:00Z`);
  return klMidnightUtcMs - KL_OFFSET_MINUTES * 60_000;
}

/**
 * [startMs, endMs) window of the Kuala Lumpur day containing `now`.
 * A follow-up is "due today" when nextFollowupAt falls inside it.
 */
export function klTodayWindow(now: Date = new Date()): {
  startMs: number;
  endMs: number;
} {
  const startMs = klStartOfDayMs(now);
  return { startMs, endMs: startMs + 86_400_000 };
}

/** True when an ISO-ish datetime string falls inside today's KL window. */
export function isDueTodayKL(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return false;
  const { startMs, endMs } = klTodayWindow();
  return t >= startMs && t < endMs;
}

/** True when an ISO-ish datetime string is before today's KL window. */
export function isOverdueKL(value: string | null | undefined): boolean {
  if (!value) return false;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return false;
  return t < klStartOfDayMs();
}

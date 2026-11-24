/**
 * Follow-up scheduling in Asia/Kuala_Lumpur, aware of business hours.
 *
 * Malaysia is UTC+8 year-round (no DST), so a fixed offset is exact. The
 * engine deliberately schedules follow-ups *inside business hours* on a KL
 * calendar day: a lead imported at 03:00 must not come due at 03:00 three
 * days later, when nobody is working.
 */
import { KL_OFFSET_MINUTES } from "./kl-time";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** Business hours in KL local time (inclusive start, exclusive end). */
export const BUSINESS_START_HOUR = 9;
export const BUSINESS_END_HOUR = 18;
/** Default slot used when a computed time lands outside business hours. */
export const DEFAULT_SLOT_HOUR = 10;

export interface BusinessHours {
  startHour: number;
  endHour: number;
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  startHour: BUSINESS_START_HOUR,
  endHour: BUSINESS_END_HOUR,
};

/** KL local clock parts for a UTC instant. */
export function klParts(ms: number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday … 6 = Saturday
} {
  const kl = new Date(ms + KL_OFFSET_MINUTES * MINUTE_MS);
  return {
    year: kl.getUTCFullYear(),
    month: kl.getUTCMonth() + 1,
    day: kl.getUTCDate(),
    hour: kl.getUTCHours(),
    minute: kl.getUTCMinutes(),
    weekday: kl.getUTCDay(),
  };
}

/** Epoch ms for a given KL local wall-clock time. */
export function klMs(year: number, month: number, day: number, hour: number, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour, minute) - KL_OFFSET_MINUTES * MINUTE_MS;
}

/** True when the KL local weekday is Saturday or Sunday. */
export function isWeekendKL(ms: number): boolean {
  const { weekday } = klParts(ms);
  return weekday === 0 || weekday === 6;
}

/**
 * The first business day STRICTLY AFTER the KL day containing `ms`.
 * Fri -> Mon, Sat -> Mon, Sun -> Mon, Tue -> Wed.
 */
export function nextBusinessDayKL(ms: number): number {
  const { year, month, day } = klParts(ms);
  // Start from the next calendar day at midday (avoids DST/edge issues),
  // then skip any weekend days.
  let cursor = klMs(year, month, day, 12) + DAY_MS;
  let guard = 0;
  while (isWeekendKL(cursor) && guard < 7) {
    cursor += DAY_MS;
    guard++;
  }
  return cursor;
}

/**
 * If `ms` falls on a weekend, moves it to the following Monday (keeping the
 * time of day). Business days are returned unchanged.
 */
export function skipWeekendKL(ms: number): number {
  let cursor = ms;
  let guard = 0;
  while (isWeekendKL(cursor) && guard < 7) {
    cursor += DAY_MS;
    guard++;
  }
  return cursor;
}

/**
 * True when the instant is inside business hours on a business day.
 * An instant on a weekend is never "in hours".
 */
export function isInBusinessHours(ms: number, hours: BusinessHours = DEFAULT_BUSINESS_HOURS): boolean {
  if (isWeekendKL(ms)) return false;
  const { hour } = klParts(ms);
  return hour >= hours.startHour && hour < hours.endHour;
}

/**
 * Normalises an instant to a valid business-hours slot on the same KL day
 * (or the next business day). Times before opening are pushed to opening;
 * times at/after closing roll to the default slot on the next business day.
 */
export function toBusinessSlotKL(ms: number, hours: BusinessHours = DEFAULT_BUSINESS_HOURS): number {
  let { year, month, day, hour, minute } = klParts(ms);
  // Weekend -> default slot on the following Monday.
  if (isWeekendKL(ms)) {
    const next = skipWeekendKL(ms);
    ({ year, month, day } = klParts(next));
    return klMs(year, month, day, DEFAULT_SLOT_HOUR);
  }
  if (hour < hours.startHour) {
    // Before opening: same day, at opening time.
    return klMs(year, month, day, hours.startHour);
  }
  if (hour >= hours.endHour) {
    // After closing: default slot on the next business day.
    const next = nextBusinessDayKL(klMs(year, month, day, 12));
    ({ year, month, day } = klParts(next));
    return klMs(year, month, day, DEFAULT_SLOT_HOUR);
  }
  return klMs(year, month, day, hour, minute);
}

/**
 * The instant of the first follow-up for a lead created at `fromMs`.
 * Adds `offsetDays` *calendar* days in KL, then snaps to business hours.
 */
export function scheduleFirstFollowupKL(fromMs: number, offsetDays: number): number {
  const { year, month, day, hour, minute } = klParts(fromMs);
  const target = klMs(year, month, day, hour, minute) + offsetDays * DAY_MS;
  return toBusinessSlotKL(target);
}

/**
 * The instant of the next follow-up after a stage is confirmed at `fromMs`.
 * Follows the same rule: +offsetDays KL calendar days, then business hours.
 */
export function scheduleNextStageKL(fromMs: number, offsetDays: number): number {
  return scheduleFirstFollowupKL(fromMs, Math.max(1, offsetDays));
}

/** Whole KL calendar days from `fromMs` until `targetMs` (0 if same day). */
export function klDaysBetween(fromMs: number, targetMs: number): number {
  const a = klStartOfKlDay(fromMs);
  const b = klStartOfKlDay(targetMs);
  return Math.round((b - a) / DAY_MS);
}

/** Epoch ms of 00:00 KL on the KL calendar day containing `ms`. */
export function klStartOfKlDay(ms: number): number {
  const { year, month, day } = klParts(ms);
  return klMs(year, month, day, 0);
}

/**
 * Human-readable KL timestamp for API responses / activity text, e.g.
 * "24 Nov 2026, 10:30". Locale is chosen by the caller's UI language.
 */
export function formatKlDateTime(ms: number, lang: "ms" | "en" = "en"): string {
  return new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(ms));
}

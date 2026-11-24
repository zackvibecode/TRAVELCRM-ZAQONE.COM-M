import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a value as Ringgit Malaysia (RM).
 * All amounts are stored and displayed in MYR (no currency conversion).
 */
export function formatRinggit(value: number): string {
  return `RM ${new Intl.NumberFormat("ms-MY").format(Math.round(value))}`;
}

/** Currency display helper — all amounts are shown as RM (Ringgit Malaysia). */
export function formatCurrency(amount: number): string {
  return formatRinggit(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Parses a timestamp that may come from D1/SQLite as a bare UTC datetime
 * ("2026-11-24 01:21:45" — no zone suffix). `new Date()` would treat that
 * as browser-local time and shift every KL display by the user's offset, so
 * we tag it as UTC explicitly. ISO strings that already carry a zone and
 * Date objects pass through untouched.
 */
export function parseDbDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  // "YYYY-MM-DD HH:MM:SS[.fff]" with no zone → UTC.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}Z`);
  }
  return new Date(trimmed);
}

/** KL-timezone timestamp formatter (date + time) used by the Follow-Up CRM. */
export function formatKlDateTime(value: string | Date): string {
  const date = parseDbDate(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

/**
 * Builds a WhatsApp click-to-chat URL from any phone format.
 *
 * Priority:
 *  1. An explicit international number (`+60…`, `60…`) is used as-is.
 *  2. A local Malaysian number (leading 0) becomes `60<rest>`.
 *  3. Any other digit string is passed through unchanged.
 *
 * `normalized` is the server-computed E.164 value (leads.phone_normalized)
 * and wins over `raw` when present, so display formatting never leaks
 * into the link.
 */
export function waLink(raw: string, normalized?: string | null): string {
  const source = (normalized ?? "").trim() || raw;
  const digits = source.replace(/[^0-9]/g, "").replace(/^0+/, "");
  const country = digits.startsWith("60") || digits.length > 10 ? "" : "60";
  return `https://wa.me/${country}${digits}`;
}

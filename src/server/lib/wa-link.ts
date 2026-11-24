/**
 * Malaysian WhatsApp number validation and wa.me deep-link builder.
 *
 * Used by the Phase 6 follow-up CRM. This is deliberately separate from
 * lib/phone.ts: that module assumes Indonesian numbers (0x → 62x) and is
 * shared by the leads / customers / quotations / payment-reminders routes,
 * which must keep their current behaviour. The follow-up CRM deals with
 * Malaysian leads, so the rules here are:
 *
 *   01xxxxxxxxx   → 601xxxxxxxxx   (Malaysian mobile, 0 dropped)
 *   +60 1xxxxxxxxx → 601xxxxxxxxx
 *   601xxxxxxxxx  → 601xxxxxxxxx
 *   0x-xxx xxxx   → 60xxxxxxxx    (landline, 0 dropped)
 *   +<other>      → kept as-is (international, no transformation)
 *
 * wa.me wants digits only, no "+".
 */

/** Malaysian mobile prefixes after the "60" country code (MNP makes the
 *  01x prefix only a strong hint, not a guarantee). */
const MY_MOBILE_RE = /^601[0-9]{8,9}$/;
/** Malaysian landline: 60 followed by area code 2-9 (e.g. 03, 04, 07…). */
const MY_LANDLINE_RE = /^60[2-9][0-9]{7,8}$/;
/** Any other international number in E.164 digits (max 15 per ITU). */
const INTL_RE = /^[1-9][0-9]{7,14}$/;

export type WaValidation =
  | { ok: true; digits: string; kind: "my_mobile" | "my_landline" | "international" }
  | { ok: false; reason: "empty" | "no_digits" | "too_short" | "too_long" | "bad_prefix" };

/**
 * Validates a raw phone string and returns wa.me-ready digits, or the
 * reason it cannot be used. Never throws; never returns partial digits.
 */
export function validateWhatsAppNumber(raw: string | null | undefined): WaValidation {
  if (!raw) return { ok: false, reason: "empty" };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return { ok: false, reason: "no_digits" };

  // Local number without country code: "0123…" → "60123…".
  // Only when it was NOT written with a "+" (a "+0…" is malformed).
  if (digits.startsWith("0") && !hadPlus) {
    const local = `60${digits.slice(1)}`;
    if (MY_MOBILE_RE.test(local)) return { ok: true, digits: local, kind: "my_mobile" };
    if (MY_LANDLINE_RE.test(local)) return { ok: true, digits: local, kind: "my_landline" };
    if (local.length < 10) return { ok: false, reason: "too_short" };
    return { ok: false, reason: "bad_prefix" };
  }

  if (digits.startsWith("60")) {
    if (MY_MOBILE_RE.test(digits)) return { ok: true, digits, kind: "my_mobile" };
    if (MY_LANDLINE_RE.test(digits)) return { ok: true, digits, kind: "my_landline" };
    if (digits.length < 10) return { ok: false, reason: "too_short" };
    return { ok: false, reason: "bad_prefix" };
  }

  // Anything else must be an explicit international number.
  if (!hadPlus) return { ok: false, reason: "bad_prefix" };
  if (digits.length > 15) return { ok: false, reason: "too_long" };
  if (digits.length < 8) return { ok: false, reason: "too_short" };
  if (INTL_RE.test(digits)) return { ok: true, digits, kind: "international" };
  return { ok: false, reason: "bad_prefix" };
}

/** wa.me-ready digits, or "" when the number is not usable. */
export function waDigits(raw: string | null | undefined): string {
  const v = validateWhatsAppNumber(raw);
  return v.ok ? v.digits : "";
}

/** True when the number can receive a wa.me deep link. */
export function isWhatsAppableMY(raw: string | null | undefined): boolean {
  return validateWhatsAppNumber(raw).ok;
}

/**
 * Builds a wa.me deep link with an optional pre-filled message.
 * Returns "" when the number is not usable — callers render the action
 * disabled. The message is URL-encoded exactly once.
 */
export function waMeLink(raw: string | null | undefined, message?: string): string {
  const digits = waDigits(raw);
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Human-readable reason a number was rejected, for the UI. */
export function waRejectMessage(reason: Exclude<WaValidation, { ok: true }>["reason"], lang: "ms" | "en" = "ms"): string {
  const ms: Record<typeof reason, string> = {
    empty: "Nomor WhatsApp belum diisi",
    no_digits: "Nomor WhatsApp tidak mengandungi digit",
    too_short: "Nomor WhatsApp terlalu pendek",
    too_long: "Nomor WhatsApp terlalu panjang",
    bad_prefix: "Nomor WhatsApp tidak sah (guna format 01xxxxxxxxx atau +60…)",
  };
  const en: Record<typeof reason, string> = {
    empty: "WhatsApp number is empty",
    no_digits: "WhatsApp number has no digits",
    too_short: "WhatsApp number is too short",
    too_long: "WhatsApp number is too long",
    bad_prefix: "Invalid WhatsApp number (use 01xxxxxxxxx or +60…)",
  };
  return (lang === "ms" ? ms : en)[reason];
}

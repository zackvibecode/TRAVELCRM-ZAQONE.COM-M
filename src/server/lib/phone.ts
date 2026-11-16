/**
 * Phone normalization & WhatsApp deep-link helpers.
 *
 * Normalizes Indonesian phone numbers to wa.me-friendly digits:
 * - strips everything except digits and a leading +
 * - converts local prefix "0..." → "62..." (Indonesia)
 * - converts "+62..." → "62..." (wa.me wants no plus)
 * - leaves other international numbers intact (minus formatting)
 *
 * Invalid input (no digits) returns an empty string so callers can
 * fall back to a disabled WhatsApp action.
 */

export function normalizePhone(raw: string): string {
  if (!raw) return "";

  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Keep digits; remember whether it had an international "+" prefix.
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return "";

  // Local Indonesian number: 08xx → 628xx
  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`;
  }

  // Already international with + prefix: strip nothing further
  // (62..., 60..., 65... all fine as-is).
  if (hadPlus || digits.length > 8) {
    return digits;
  }

  // Bare short numbers (extensions, desk lines) — not WhatsApp-able.
  return digits;
}

/** True when the number looks like a WhatsApp-capable phone. */
export function isWhatsAppable(raw: string): boolean {
  const normalized = normalizePhone(raw);
  return normalized.length >= 10;
}

/**
 * Builds a wa.me deep link with optional pre-filled message.
 * Returns an empty string when the number cannot be normalized —
 * callers should render the action as disabled.
 */
export function whatsappLink(raw: string, message?: string): string {
  const normalized = normalizePhone(raw);
  if (!isWhatsAppable(raw)) return "";

  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a value as Ringgit Malaysia (RM).
 * Mock data is still stored on the legacy rupiah scale, so values are
 * converted at display time (~Rp 3.000 = RM 1) until the backend phase
 * stores real MYR amounts.
 */
export function formatRinggit(value: number): string {
  const rm = Math.round(value / 3000);
  return `RM ${new Intl.NumberFormat("ms-MY").format(rm)}`;
}

/** Currency display helper — all amounts are shown as RM (Ringgit Malaysia). */
export function formatCurrency(amount: number): string {
  return formatRinggit(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/**
 * Builds a WhatsApp click-to-chat URL from any phone format.
 * Strips non-digits and normalizes a leading 0 (local Indonesia format)
 * to the 62 country code.
 */
export function waLink(phone: string) {
  const digits = phone.replace(/[^0-9]/g, "").replace(/^0/, "62");
  return `https://wa.me/${digits}`;
}

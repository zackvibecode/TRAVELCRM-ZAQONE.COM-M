const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomIndex(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

/**
 * Generates a human-friendly, unique booking reference of the form
 * `BK-XXXXXX` (6 unambiguous alphanumeric characters). Uniqueness is
 * ultimately guaranteed by the UNIQUE constraint on `bookings.reference`;
 * callers retry on conflict.
 */
export function generateBookingReference(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[randomIndex(ALPHABET.length)];
  }
  return `BK-${suffix}`;
}

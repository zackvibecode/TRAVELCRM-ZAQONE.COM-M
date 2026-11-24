/**
 * Verifies Malaysian WhatsApp number validation and wa.me URL building
 * from src/server/lib/wa-link.ts.
 * Run: npx tsx scripts/test-wa-link.ts
 */
import { validateWhatsAppNumber, waDigits, isWhatsAppableMY, waMeLink, waRejectMessage } from "../src/server/lib/wa-link";

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}
function okEq(label: string, raw: string, digits: string, kind?: string) {
  const v = validateWhatsAppNumber(raw);
  const pass = v.ok && v.digits === digits && (!kind || v.kind === kind);
  assert(label, pass, JSON.stringify(v));
}
function badEq(label: string, raw: string, reason: string) {
  const v = validateWhatsAppNumber(raw);
  const pass = !v.ok && v.reason === reason;
  assert(label, pass, JSON.stringify(v));
}

// --- valid Malaysian mobile --------------------------------------------------
okEq("01x mobile, plain", "0123456789", "60123456789", "my_mobile");
okEq("01x mobile, formatted with dashes/spaces", "012-345 6789", "60123456789", "my_mobile");
okEq("+60 1x mobile", "+60 12-345 6789", "60123456789", "my_mobile");
okEq("60 1x mobile, no plus", "60123456789", "60123456789", "my_mobile");
okEq("01x mobile, brackets", "(012) 345-6789", "60123456789", "my_mobile");

// --- valid Malaysian landline ------------------------------------------------
okEq("03 landline", "0323456789", "60323456789", "my_landline");
okEq("+60 4 landline", "+604 123 4567", "6041234567", "my_landline");

// --- valid international -----------------------------------------------------
okEq("+44 international", "+447911123456", "447911123456", "international");
okEq("+65 international", "+65 9123 4567", "6591234567", "international");
okEq("+966 international", "+966 50 123 4567", "966501234567", "international");

// --- rejected ---------------------------------------------------------------
badEq("empty string", "", "empty");
badEq("null", null as unknown as string, "empty");
badEq("whitespace only", "   ", "empty");
badEq("letters only", "abc", "no_digits");
badEq("too short local", "0123", "too_short");
badEq("too short 60-prefixed", "60123", "too_short");
badEq("bad local prefix (0 + 9 digits starting 1x but not 8-9 after)", "0199", "too_short");
badEq("bare digits without + and not MY", "79111234567", "bad_prefix");
badEq("+0… is malformed", "+0123456789", "bad_prefix");
badEq("too long international", "+1234567890123456", "too_long");

// --- helpers ----------------------------------------------------------------
assert("waDigits returns digits for valid", waDigits("012-345 6789") === "60123456789");
assert("waDigits returns empty for invalid", waDigits("abc") === "");
assert("isWhatsAppableMY true for valid", isWhatsAppableMY("+60 12 345 6789") === true);
assert("isWhatsAppableMY false for invalid", isWhatsAppableMY("0123") === false);

const url = waMeLink("012-345 6789", "Hai Priya! Ada masa?");
assert("waMeLink builds encoded URL", url === "https://wa.me/60123456789?text=" + encodeURIComponent("Hai Priya! Ada masa?"), url);
assert("waMeLink without message has no query", waMeLink("0123456789") === "https://wa.me/60123456789");
assert("waMeLink returns empty for invalid", waMeLink("abc", "hi") === "");

// Emoji + multibyte must survive a single round of encoding.
const emoji = waMeLink("0123456789", "😊 👍 Salam!");
assert("waMeLink encodes emoji exactly once", emoji === "https://wa.me/60123456789?text=" + encodeURIComponent("😊 👍 Salam!"), emoji);

// --- messages ---------------------------------------------------------------
assert("reject message ms", waRejectMessage("bad_prefix", "ms").includes("tidak sah"));
assert("reject message en", waRejectMessage("bad_prefix", "en").includes("Invalid"));

console.log(failed === 0 ? "\nAll wa-link checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);

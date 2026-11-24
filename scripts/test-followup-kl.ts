/**
 * Business-hours scheduling tests for the KL follow-up engine.
 * Run: npx tsx scripts/test-followup-kl.ts
 *
 * Reference dates (all KL local, UTC+8):
 *   Tue 24 Nov 2026 · Fri 27 Nov 2026 · Sat 28 Nov 2026 · Mon 30 Nov 2026
 */
import {
  scheduleFirstFollowupKL,
  scheduleNextStageKL,
  toBusinessSlotKL,
  isInBusinessHours,
  isWeekendKL,
  nextBusinessDayKL,
  skipWeekendKL,
  klDaysBetween,
  klMs,
  klParts,
  formatKlDateTime,
} from "../src/server/lib/followup-schedule-kl";

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}
const fmt = (ms: number) => {
  const p = klParts(ms);
  const names = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  return `${names[p.weekday]} ${p.day}/${p.month} ${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")} KL`;
};

// --- sanity on the reference dates -----------------------------------------
assert("24 Nov 2026 is a Tuesday", klParts(klMs(2026, 11, 24, 10)).weekday === 2);
assert("27 Nov 2026 is a Friday", klParts(klMs(2026, 11, 27, 10)).weekday === 5);
assert("28 Nov 2026 is a Saturday", isWeekendKL(klMs(2026, 11, 28, 10)));

// --- 1. lead imported during business hours: same time, N days later ------
const tue10 = klMs(2026, 11, 24, 10, 15);
const r1 = scheduleFirstFollowupKL(tue10, 1);
assert("+1d from Tue 10:15 -> Wed 10:15", r1 === klMs(2026, 11, 25, 10, 15), fmt(r1));

// --- 2. lead imported at 03:00 (nobody working) -> pushed to opening ------
const tue3 = klMs(2026, 11, 24, 3, 0);
const r2 = scheduleFirstFollowupKL(tue3, 1);
assert("+1d from Tue 03:00 -> Wed 09:00 (opening), NOT 03:00", r2 === klMs(2026, 11, 25, 9, 0), fmt(r2));

// --- 3. lead imported at 23:30 -> default slot next business day ----------
const tue2330 = klMs(2026, 11, 24, 23, 30);
const r3 = scheduleFirstFollowupKL(tue2330, 1);
assert("+1d from Tue 23:30 -> Thu 10:00 (default slot)", r3 === klMs(2026, 11, 26, 10, 0), fmt(r3));

// --- 4. a +1d follow-up landing on Saturday -> Monday ----------------------
// Imported Fri 27 Nov 11:00, FU1 = +1 day = Sat 28 Nov -> skips weekend.
const fri11 = klMs(2026, 11, 27, 11, 0);
const r4 = scheduleFirstFollowupKL(fri11, 1);
assert("+1d from Fri 11:00 -> Mon 30 Nov 10:00 (weekend skipped)", r4 === klMs(2026, 11, 30, 10, 0), fmt(r4));

// --- 5. a +3d follow-up from Thursday lands on Sunday -> Monday -----------
const thu11 = klMs(2026, 11, 26, 11, 0); // Thu 26 + 3d = Sun 29
const r5 = scheduleNextStageKL(thu11, 3);
assert("+3d from Thu -> Mon 30 Nov 10:00 (Sunday skipped)", r5 === klMs(2026, 11, 30, 10, 0), fmt(r5));

// --- 6. after closing on Friday -> Monday ----------------------------------
const fri19 = klMs(2026, 11, 27, 19, 0);
const r6 = toBusinessSlotKL(klMs(2026, 11, 28, 11, 0) + 0); // Sat 11:00 directly
assert("Sat 11:00 snaps to Mon 10:00", r6 === klMs(2026, 11, 30, 10, 0), fmt(r6));
const r6b = toBusinessSlotKL(fri19);
assert("Fri 19:00 (after hours) snaps to Mon 10:00", r6b === klMs(2026, 11, 30, 10, 0), fmt(r6b));

// --- 7. business-hours predicate ------------------------------------------
assert("Tue 10:00 is in hours", isInBusinessHours(klMs(2026, 11, 24, 10)));
assert("Tue 08:59 is NOT in hours", !isInBusinessHours(klMs(2026, 11, 24, 8, 59)));
assert("Tue 18:00 is NOT in hours (exclusive end)", !isInBusinessHours(klMs(2026, 11, 24, 18)));
assert("Sat 10:00 is NOT in hours (weekend)", !isInBusinessHours(klMs(2026, 11, 28, 10)));

// --- 8. nextBusinessDayKL / skipWeekendKL ---------------------------------
assert("Fri -> next business day is Mon", nextBusinessDayKL(klMs(2026, 11, 27, 12)) === klMs(2026, 11, 30, 12));
assert("Sat -> next business day is Mon", nextBusinessDayKL(klMs(2026, 11, 28, 12)) === klMs(2026, 11, 30, 12));
assert("Sun -> next business day is Mon", nextBusinessDayKL(klMs(2026, 11, 29, 12)) === klMs(2026, 11, 30, 12));
assert("Tue -> next business day is Wed", nextBusinessDayKL(klMs(2026, 11, 24, 12)) === klMs(2026, 11, 25, 12));
assert("skipWeekend: Sat -> Mon", skipWeekendKL(klMs(2026, 11, 28, 15)) === klMs(2026, 11, 30, 15));
assert("skipWeekend: Tue stays Tue", skipWeekendKL(klMs(2026, 11, 24, 15)) === klMs(2026, 11, 24, 15));

// --- 9. day math across a month boundary ----------------------------------
assert("Tue 24 -> Fri 27 is 3 KL days", klDaysBetween(klMs(2026, 11, 24, 9), klMs(2026, 11, 27, 9)) === 3);
assert("same KL day = 0", klDaysBetween(klMs(2026, 11, 24, 9), klMs(2026, 11, 24, 17)) === 0);

// --- 10. formatting is KL-zoned and bilingual ------------------------------
const f = formatKlDateTime(klMs(2026, 11, 24, 10, 5), "en");
assert("EN format contains KL time 10:05", /10:05/.test(f), f);
const fm = formatKlDateTime(klMs(2026, 11, 24, 10, 5), "ms");
assert("MS format contains KL time 10:05", /10:05/.test(fm), fm);

console.log(failed ? `\n${failed} TEST(S) FAILED` : "\nALL KL SCHEDULING TESTS PASSED");
process.exit(failed ? 1 : 0);

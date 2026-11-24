/**
 * Exercises the follow-up scheduling helper against a fake db that mirrors
 * the exact shape Drizzle returns for the helper's single select, so no
 * database driver is needed. Run: npx tsx scripts/test-followup-schedule.ts
 */
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../src/server/db/schema";

/** Controls what the fake `followup_stages` query returns. */
let stageRows: { offsetDays: number }[] = [{ offsetDays: 1 }];

/** Minimal stand-in: the helper only calls .select().from().where().limit(1). */
const chain = {
  from: () => chain,
  where: () => chain,
  limit: async () => stageRows,
};
const fakeDb = { select: () => chain } as unknown as DrizzleD1Database<typeof schema>;

const { stageOffsetDays, firstFollowupAt, nextStageFollowupAt, nextStageOf } = await import(
  "../src/server/lib/followup-schedule.ts"
);

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}

const DAY = 86_400_000;

// Seed values per stage (FU1=1, FU2=3, FU3=7).
for (const [code, days] of [["FU1", 1], ["FU2", 3], ["FU3", 7]] as const) {
  stageRows = [{ offsetDays: days }];
  assert(`${code} offset read from config = ${days}`, (await stageOffsetDays(fakeDb, code)) === days);
}

// firstFollowupAt = from + offset_days(FU1), snapped to KL business hours.
// t0 = Tue 13 Jan 2026 10:00 KL (UTC+8) — a weekday inside business hours, so
// the result keeps the same clock time N days later.
const t0 = Date.parse("2026-01-13T02:00:00.000Z");
stageRows = [{ offsetDays: 1 }];
const first = await firstFollowupAt(fakeDb, t0);
assert("first follow-up is +1 day (same KL clock time)", first.getTime() === t0 + DAY, first.toISOString());

// after FU1 confirmed -> next is +offset_days(FU2); after FU2 -> +offset_days(FU3)
// 13 Jan Tue + 3d = 16 Jan Fri (business day) · 13 Jan Tue + 7d = 20 Jan Tue
stageRows = [{ offsetDays: 3 }];
assert("FU2 is +3 days after FU1", (await nextStageFollowupAt(fakeDb, "FU2", t0)).getTime() === t0 + 3 * DAY);
stageRows = [{ offsetDays: 7 }];
assert("FU3 is +7 days after FU2", (await nextStageFollowupAt(fakeDb, "FU3", t0)).getTime() === t0 + 7 * DAY);

// An admin edit is honoured — this is exactly what the old hardcoded +1d broke.
// 13 Jan Tue + 2d = 15 Jan Thu (business day)
stageRows = [{ offsetDays: 2 }];
assert("admin edit: FU1 now +2 days", (await firstFollowupAt(fakeDb, t0)).getTime() === t0 + 2 * DAY);

// Business-hours rule: a lead arriving on Saturday 17 Jan at 09:00Z (17:00 KL,
// weekend) gets its follow-up on Monday 19 Jan at the default 10:00 KL slot.
const satT0 = Date.parse("2026-01-17T09:00:00.000Z");
stageRows = [{ offsetDays: 1 }];
const mondaySlot = await firstFollowupAt(fakeDb, satT0);
assert("Sat 17:00 KL +1d -> Mon 19 Jan 10:00 KL", mondaySlot.toISOString() === "2026-01-19T02:00:00.000Z", mondaySlot.toISOString());

// Bad / missing config falls back to the seeded default instead of breaking.
for (const bad of [0, -5, 9999, Number.NaN]) {
  stageRows = [{ offsetDays: bad }];
  assert(`bad offset ${bad} falls back to 1`, (await stageOffsetDays(fakeDb, "FU1")) === 1);
}
stageRows = [];
assert("missing stage row falls back to 1", (await stageOffsetDays(fakeDb, "FU1")) === 1);

// Stage sequencing.
assert("next of FU1 is FU2", nextStageOf("FU1") === "FU2");
assert("next of FU2 is FU3", nextStageOf("FU2") === "FU3");
assert("next of FU3 is null (exhausted)", nextStageOf("FU3") === null);

console.log(failed ? `\n${failed} TEST(S) FAILED` : "\nALL SCHEDULE TESTS PASSED");
process.exit(failed ? 1 : 0);

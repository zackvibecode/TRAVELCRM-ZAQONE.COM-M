/**
 * Verifies runAutoPause() against a REAL SQLite database (node:sqlite) via a
 * thin D1 shim, so the Drizzle predicates are compiled to SQL and evaluated
 * by SQLite itself — no hand-rolled predicate imitation.
 *
 * Run: npx tsx scripts/test-followup-auto-pause.ts
 *
 * Scenario matrix ("now" = 2026-11-24T02:00:00Z = 10:00 KL, Tue):
 *   A overdue 20d, never contacted      -> PAUSED
 *   B overdue 20d, contacted 3d ago     -> kept (rep is still working it)
 *   C overdue  5d, never contacted      -> kept (not overdue long enough)
 *   D overdue 20d, state = escalated    -> kept (admin-review state)
 *   E overdue 20d, state = paused       -> kept (already paused)
 *   F active, schedule in the future    -> kept (not overdue)
 *   G active, no schedule at all        -> kept (nothing to be overdue)
 *   H overdue 20d, contacted 15d ago    -> PAUSED (contact is older than window)
 */
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/d1";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../src/server/db/schema";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`
  CREATE TABLE leads (
    id text PRIMARY KEY, name text NOT NULL, owner_user_id text NOT NULL,
    followup_state text, next_followup_at text, last_contacted_at text,
    paused_at text, pause_reason text, updated_at text
  );
  CREATE TABLE lead_activities (
    id text PRIMARY KEY, lead_id text NOT NULL, type text NOT NULL,
    text text NOT NULL, "user" text NOT NULL DEFAULT 'system', at text NOT NULL
  );
`);

// Thin D1 shim: Drizzle's D1 driver calls prepare().bind(...).all()/run().
// D1 returns rows as ARRAYS of values (not objects), so every read
// statement is switched to array mode via setReturnArrays().
function makeDb(sqlite: DatabaseSync) {
  const d1 = {
    prepare(query: string) {
      const stmt = sqlite.prepare(query);
      stmt.setReturnArrays(true);
      return {
        bind(...args: unknown[]) {
          return {
            all: async () => ({ results: stmt.all(...(args as never[])), success: true }),
            run: async () => {
              stmt.run(...(args as never[]));
              return { results: [], success: true, meta: {} };
            },
            // Drizzle's values() uses the whole return value as the row array.
            raw: async () => stmt.all(...(args as never[])),
          };
        },
        all: async () => ({ results: stmt.all(), success: true }),
        run: async () => { stmt.run(); return { results: [], success: true, meta: {} }; },
      };
    },
    batch: async (stmts: { all: () => Promise<unknown> }[]) => ({
      results: await Promise.all(stmts.map((s) => s.all())),
    }),
    exec: async () => ({ results: [] }),
    dump: async () => new ArrayBuffer(0),
  };
  return drizzle(d1 as never);
}

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-24T02:00:00.000Z");
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

const insert = sqlite.prepare(
  `INSERT INTO leads (id, name, owner_user_id, followup_state, next_followup_at, last_contacted_at, updated_at)
   VALUES (?, ?, 'u', ?, ?, ?, ?)`,
);
const cases: [string, string, string | null, string | null][] = [
  ["A", "active", iso(20), null],
  ["B", "active", iso(20), iso(3)],
  ["C", "active", iso(5), null],
  ["D", "escalated", iso(20), null],
  ["E", "paused", iso(20), null],
  ["F", "active", iso(-3), null],
  ["G", "active", null, null],
  ["H", "active", iso(20), iso(15)],
];
for (const [id, state, next, contacted] of cases) {
  insert.run(id, `Lead ${id}`, state, next, contacted, iso(30));
}

const db = makeDb(sqlite) as DrizzleD1Database<typeof schema>;
const { runAutoPause, AUTO_PAUSE_AFTER_DAYS } = await import("../src/server/lib/followup-auto-pause.ts");

// Verifications read plain objects (only the shim's statements use arrays).
type VRow = { followup_state: string; pause_reason: string | null; paused_at: string | null };
const stateStmt = sqlite.prepare<[], VRow>(`SELECT followup_state, pause_reason, paused_at FROM leads WHERE id = ?`);
const row = (id: string): { s: string; r: string | null; p: string | null } => {
  const r = stateStmt.get(id) as VRow | undefined;
  return r ? { s: r.followup_state, r: r.pause_reason, p: r.paused_at } : { s: "", r: null, p: null };
};
const countActs = () => (sqlite.prepare(`SELECT COUNT(*) AS n FROM lead_activities`).get() as { n: number }).n;
const actRows = () => sqlite.prepare(`SELECT lead_id, type, "user" AS u FROM lead_activities ORDER BY id`).all() as { lead_id: string; type: string; u: string }[];

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}

const result = await runAutoPause(db, NOW);

assert("threshold is 14 days", AUTO_PAUSE_AFTER_DAYS === 14);
assert("A (overdue 20d, never contacted) is PAUSED", row("A").s === "paused", row("A").s);
assert("A has an 'auto:' pause reason", (row("A").r ?? "").startsWith("auto:"), row("A").r ?? "");
assert("A has pausedAt recorded", !!row("A").p, row("A").p ?? "");
assert("B (overdue 20d, contacted 3d ago) is KEPT active", row("B").s === "active", row("B").s);
assert("C (overdue 5d) is KEPT active", row("C").s === "active", row("C").s);
assert("D (escalated) is KEPT escalated", row("D").s === "escalated", row("D").s);
assert("E (already paused) stays paused without a new reason", row("E").s === "paused" && !row("E").r, `${row("E").s}/${row("E").r}`);
assert("F (future schedule) is KEPT active", row("F").s === "active", row("F").s);
assert("G (no schedule) is KEPT active", row("G").s === "active", row("G").s);
assert("H (contacted 15d ago, outside window) is PAUSED", row("H").s === "paused", row("H").s);
assert("exactly two leads were paused (A, H)", result.paused === 2, String(result.paused));
assert("scanned == paused (every candidate is acted on)", result.scanned === result.paused, `${result.scanned}`);

const tl = actRows();
assert("timeline entries written for exactly A and H", tl.length === 2 && tl.every((t) => ["A", "H"].includes(t.lead_id)), tl.map((t) => t.lead_id).join(","));
assert("timeline entries are attributed to 'system'", tl.every((t) => t.u === "system"));
assert("timeline entries are type 'pause'", tl.every((t) => t.type === "pause"));

// Idempotency: a second run must not pause anything new or duplicate entries.
const second = await runAutoPause(db, NOW);
assert("second run pauses nothing (idempotent)", second.paused === 0, String(second.paused));
assert("second run adds no duplicate timeline entries", countActs() === 2, String(countActs()));

console.log(failed ? `\n${failed} TEST(S) FAILED` : "\nALL AUTO-PAUSE TESTS PASSED");
process.exit(failed ? 1 : 0);

/**
 * Verifies the requireOwnedLead() contract from src/server/lib/owned-lead.ts.
 * Run: npx tsx scripts/test-owned-lead.ts
 *
 * Contract under test:
 *   - missing lead            → 404 { error: "not_found" }
 *   - ADMIN on any lead       → allowed
 *   - SALES on own lead       → allowed
 *   - SALES on someone else's → 404, IDENTICAL to the missing-lead response
 *                               (never 403, so existence never leaks)
 *   - role outside the CRM    → 404
 */
import { requireOwnedLead, followupAccessRole } from "../src/server/lib/owned-lead";

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}

type Staff = { id: string; name: string; email: string; role: string };

// A fake db whose select() resolves to whatever `rows` currently holds.
let rows: unknown[] = [];
const chain = { from: () => chain, where: () => chain, limit: async () => rows };
const fakeDb = { select: () => chain } as never;

const salesA: Staff = { id: "sales-a", name: "A", email: "a@x.com", role: "sales" };
const salesB: Staff = { id: "sales-b", name: "B", email: "b@x.com", role: "sales" };
const admin: Staff = { id: "admin-1", name: "Admin", email: "adm@x.com", role: "super_admin" };
const manager: Staff = { id: "mgr-1", name: "Mgr", email: "m@x.com", role: "management" };
const finance: Staff = { id: "fin-1", name: "Fin", email: "f@x.com", role: "finance" };

const leadOfA = { id: "lead-1", ownerUserId: "sales-a", name: "Owned by A" };

// --- role mapping ----------------------------------------------------------
assert("super_admin maps to ADMIN", followupAccessRole("super_admin") === "ADMIN");
assert("management maps to ADMIN", followupAccessRole("management") === "ADMIN");
assert("sales maps to SALES", followupAccessRole("sales") === "SALES");
assert("finance maps to null (outside CRM)", followupAccessRole("finance") === null);

// --- 1. missing lead → 404 -------------------------------------------------
rows = [];
const missing = await requireOwnedLead(fakeDb, "ghost", salesA);
assert("missing lead is not ok", !missing.ok);
let missingBodyText = "";
if (!missing.ok) {
  assert("missing lead → 404", missing.response.status === 404, String(missing.response.status));
  missingBodyText = JSON.stringify(await missing.response.json());
  assert(
    "missing lead body.error = not_found",
    JSON.parse(missingBodyText).error === "not_found",
    missingBodyText,
  );
}

// --- 2. ADMIN may access any lead -----------------------------------------
rows = [leadOfA];
const adminRes = await requireOwnedLead(fakeDb, "lead-1", admin);
assert("super_admin can open a lead owned by someone else", adminRes.ok);
const mgrRes = await requireOwnedLead(fakeDb, "lead-1", manager);
assert("management can open a lead owned by someone else", mgrRes.ok);

// --- 3. SALES on own lead → allowed ---------------------------------------
rows = [leadOfA];
const own = await requireOwnedLead(fakeDb, "lead-1", salesA);
assert("owner can open their own lead", own.ok);

// --- 4. SALES on another rep's lead → 404, indistinguishable from missing --
rows = [leadOfA];
const foreign = await requireOwnedLead(fakeDb, "lead-1", salesB);
assert("other sales rep is blocked", !foreign.ok);
if (!foreign.ok) {
  assert("foreign lead → 404 (never 403)", foreign.response.status === 404, String(foreign.response.status));
  const foreignBody = await foreign.response.json();
  assert(
    "foreign response is IDENTICAL to missing-lead response (no existence leak)",
    JSON.stringify(foreignBody) === missingBodyText,
    JSON.stringify(foreignBody),
  );
}

// --- 5. role outside the CRM → 404 ----------------------------------------
rows = [leadOfA];
const outsider = await requireOwnedLead(fakeDb, "lead-1", finance);
assert("finance role is blocked with 404", !outsider.ok && outsider.response.status === 404);

// --- 6. SALES role even on a lead with a null/empty owner → 404 -----------
rows = [{ id: "lead-2", ownerUserId: "", name: "No owner" }];
const noOwner = await requireOwnedLead(fakeDb, "lead-2", salesA);
assert("sales cannot open an unowned lead", !noOwner.ok && noOwner.response.status === 404);

console.log(failed ? `\n${failed} TEST(S) FAILED` : "\nALL OWNED-LEAD TESTS PASSED");
process.exit(failed ? 1 : 0);

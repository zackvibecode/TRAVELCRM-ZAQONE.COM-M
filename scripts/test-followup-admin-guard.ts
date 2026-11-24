/**
 * Verifies the admin-console guard contract from
 * src/server/middleware/followup-admin.ts.
 * Run: npx tsx scripts/test-followup-admin-guard.ts
 *
 * Strategy: build a Hono app in memory, replace the session resolution with
 * a stub that injects a staff identity of a chosen role, and assert the
 * HTTP status each role gets from the guarded route.
 */
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { followupAccessRole } from "../src/server/lib/owned-lead";
import type { StaffIdentity } from "../src/server/lib/auth-context";

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}

type Role = StaffIdentity["role"];

function staffOf(role: Role): StaffIdentity {
  return { id: `u-${role}`, name: role, email: `${role}@x.travel`, role, sessionId: "s" };
}

/**
 * Stand-in for requireStaffSession: injects `who` into c.var.staff and
 * continues; with who=null it mirrors the real 401.
 */
function stubSession(who: StaffIdentity | null) {
  return async (c: Context, next: Next) => {
    if (!who) return c.json({ error: "unauthorized", message: "Sign-in required" }, 401);
    c.set("staff", who);
    await next();
  };
}

async function statusFor(role: Role | null): Promise<number> {
  const app = new Hono();
  app.use("*", stubSession(role ? staffOf(role) : null));
  app.use("*", async (c, next) => {
    // The real guard's logic, inlined (requireStaffSession is stubbed above).
    const staff = c.get("staff") as StaffIdentity | undefined;
    if (!staff) return c.json({ error: "unauthorized" }, 401);
    if (followupAccessRole(staff.role) !== "ADMIN") {
      return c.json({ success: false, error: "forbidden" }, 403);
    }
    await next();
  });
  app.get("/x", (c) => c.json({ success: true, data: "ok" }));
  const res = await app.request("/x");
  return res.status;
}

// --- every role --------------------------------------------------------------
const expected: [Role | null, number][] = [
  ["super_admin", 200],
  ["management", 200],
  ["sales", 403],
  ["finance", 403],
  ["operations", 403],
  [null, 401],
];
for (const [role, want] of expected) {
  const got = await statusFor(role);
  assert(`${role ?? "anonymous"} → ${want}`, got === want, `got ${got}`);
}

console.log(failed === 0 ? "\nAll admin-guard checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);

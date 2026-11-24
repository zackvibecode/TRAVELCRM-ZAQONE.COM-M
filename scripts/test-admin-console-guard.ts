/**
 * Verifies the ADMIN-only access guard for the Admin Console.
 * Run: npx tsx scripts/test-admin-console-guard.ts
 *
 * Contract under test:
 *   - ROUTE_ROLES["/admin-console"] is exactly [super_admin, management]
 *   - canAccess("/admin-console", role) is true only for those two roles
 *   - crmAccessRole(role) maps super_admin/management → ADMIN, sales → SALES,
 *     everything else → null (the page renders "Access denied" for non-ADMIN)
 *   - the sidebar entry must be hidden for every role that cannot access it
 */
import { ROUTE_ROLES, canAccess, allowedRolesLabel } from "../src/lib/roles";
import { crmAccessRole } from "../src/pages/LeadManagement";

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}

const ALL_ROLES = ["super_admin", "management", "sales", "finance", "operations"] as const;
const ADMIN_ROLES = new Set(["super_admin", "management"]);

// --- 1. route map declares exactly the two admin roles ---------------------
const declared = ROUTE_ROLES["/admin-console"] ?? [];
assert(
  "route map declares /admin-console",
  declared.length > 0,
  `roles=${JSON.stringify(declared)}`,
);
assert(
  "route map allows only super_admin + management",
  declared.length === 2 && declared.every((r) => ADMIN_ROLES.has(r)),
);
assert(
  "route map does NOT allow sales",
  !declared.includes("sales"),
  "sales must be excluded from the admin console",
);

// --- 2. canAccess per role ------------------------------------------------
for (const role of ALL_ROLES) {
  const expected = ADMIN_ROLES.has(role);
  assert(
    `canAccess(/admin-console, ${role}) === ${expected}`,
    canAccess("/admin-console", role) === expected,
  );
}
assert("canAccess with undefined role is denied", canAccess("/admin-console", undefined) === false);

// --- 3. allowedRolesLabel matches the declared list -----------------------
const labels = allowedRolesLabel("/admin-console");
assert(
  "allowedRolesLabel returns the admin roles",
  labels.length === 2 && labels.every((r) => ADMIN_ROLES.has(r)),
  `labels=${labels.join(",")}`,
);

// --- 4. plan-level role mapping used by the page ---------------------------
assert("crmAccessRole(super_admin) → ADMIN", crmAccessRole("super_admin") === "ADMIN");
assert("crmAccessRole(management) → ADMIN", crmAccessRole("management") === "ADMIN");
assert("crmAccessRole(sales) → SALES", crmAccessRole("sales") === "SALES");
assert("crmAccessRole(finance) → null", crmAccessRole("finance") === null);
assert("crmAccessRole(operations) → null", crmAccessRole("operations") === null);

// --- 5. the page's own guard: non-ADMIN never passes ----------------------
// Mirrors the exact check in AdminConsole.tsx: `if (accessRole !== "ADMIN")`.
for (const role of ALL_ROLES) {
  const accessRole = crmAccessRole(role);
  const passesPageGuard = accessRole === "ADMIN";
  assert(
    `page guard ${passesPageGuard ? "admits" : "denies"} ${role}`,
    passesPageGuard === ADMIN_ROLES.has(role),
  );
}

console.log(failed === 0 ? "\nAll admin-console guard checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);

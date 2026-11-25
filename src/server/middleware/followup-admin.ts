import type { Context, MiddlewareHandler } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireStaffSession } from "./auth";
import type { StaffIdentity } from "../lib/auth-context";
import { followupAccessRole } from "../lib/owned-lead";

/** Roles that map to the ADMIN CRM role (see followupAccessRole). */
export const FOLLOWUP_ADMIN_ROLES = ["super_admin", "management"] as const;

/** Shape of a request context after requireFollowupAdmin ran. */
export interface FollowupAdminEnv {
  Bindings: { DB: D1Database };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    auth: import("../lib/auth").Auth;
    staff: StaffIdentity;
    userRole: StaffIdentity["role"];
  };
}

/**
 * Admin-only guard for the follow-up CRM admin console API.
 *
 * Order of checks (deliberate):
 *   1. requireStaffSession  → 401 when not signed in
 *   2. role → ADMIN         → otherwise 403 "Only ADMIN may access"
 *
 * Non-CRM roles (finance/operations) also fail step 2 with the same 403
 * since followupAccessRole returns null for them. Use this for routes under
 * /api/followup/admin/* — the console is by definition admin-only, so a
 * 403 here does not leak anything the caller is not already told by the
 * sidebar (the menu entry is hidden for non-admins).
 */
export function requireFollowupAdmin(): MiddlewareHandler<FollowupAdminEnv> {
  return async (c, next) => {
    // Run the session guard in-line so a missing session answers 401.
    let passed = false;
    await requireStaffSession(c as unknown as Context<FollowupAdminEnv>, async () => {
      passed = true;
    });
    if (!passed) {
      // requireStaffSession already wrote the 401 response.
      return;
    }

    const staff = c.get("staff");
    if (followupAccessRole(staff.role) !== "ADMIN") {
      return c.json(
        { success: false, error: "forbidden", message: "Only ADMIN may access the admin console" },
        403,
      );
    }
    await next();
  };
}

export default requireFollowupAdmin;

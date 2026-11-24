import type { Context } from "hono";
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { StaffIdentity } from "../lib/auth-context";

/**
 * Guard kontrak `/api/followup/*`: setiap lead hanya boleh diakses oleh
 * pemiliknya atau ADMIN (super_admin/management). Respons untuk lead yang
 * bukan milik pengguna adalah **404, bukan 403** — supaya kewujudan data
 * tidak bocor (orang tidak dapat membezakan "lead tidak wujud" dengan
 * "lead milik orang lain").
 */

/** Pemetaan peran sesuai rencana: super_admin/management → ADMIN, sales → SALES. */
export type FollowupAccessRole = "ADMIN" | "SALES";

export function followupAccessRole(
  role: StaffIdentity["role"],
): FollowupAccessRole | null {
  if (role === "super_admin" || role === "management") return "ADMIN";
  if (role === "sales") return "SALES";
  return null;
}

export type OwnedLeadResult =
  | { ok: true; lead: schema.LeadRow }
  | { ok: false; response: Response };

/**
 * Loads the lead and verifies the caller may see it.
 *
 * - Missing lead → 404.
 * - Caller is ADMIN (super_admin/management) → allowed.
 * - Caller is SALES and `lead.ownerUserId === staff.id` → allowed.
 * - Anything else → **404** (never 403, so existence never leaks).
 * - Role outside the follow-up CRM (finance/operations) → 404 as well,
 *   keeping the neutral contract uniform.
 */
export async function requireOwnedLead(
  db: DrizzleD1Database<typeof schema>,
  leadId: string,
  staff: StaffIdentity,
): Promise<OwnedLeadResult> {
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, leadId))
    .limit(1);

  if (!lead) {
    return {
      ok: false,
      response: Response.json(
        { error: "not_found", message: "Lead not found" },
        { status: 404 },
      ),
    };
  }

  const access = followupAccessRole(staff.role);

  if (access === "ADMIN") {
    return { ok: true, lead };
  }

  if (access === "SALES" && lead.ownerUserId === staff.id) {
    return { ok: true, lead };
  }

  // Not the owner (or a role outside the CRM) — neutral 404.
  return {
    ok: false,
    response: Response.json(
      { error: "not_found", message: "Lead not found" },
      { status: 404 },
    ),
  };
}

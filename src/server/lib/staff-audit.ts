import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

type Db = DrizzleD1Database<typeof schema>;

export type StaffAuditAction =
  | "login"
  | "logout"
  | "login_failed"
  | "password_reset_request"
  | "password_reset_done"
  | "role_change"
  | "staff_invite"
  | "staff_update"
  | "staff_delete"
  | "account_suspended"
  | "account_reactivated";

export interface LogStaffAuditInput {
  userId?: string | null;
  actorEmail: string;
  action: StaffAuditAction;
  detail?: string;
  ip?: string | null;
  userAgent?: string | null;
  outcome?: "success" | "failed";
}

/** Append an immutable staff audit event. */
export async function logStaffAudit(db: Db, input: LogStaffAuditInput) {
  await db.insert(schema.staffAuditLogs).values({
    id: crypto.randomUUID(),
    userId: input.userId ?? null,
    actorEmail: input.actorEmail,
    action: input.action,
    detail: input.detail ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    outcome: input.outcome ?? "success",
  });
}

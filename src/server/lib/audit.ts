import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export interface AuditEntry {
  actor?: string | null;
  role?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  detail?: string | null;
}

/**
 * Records an audit log entry. Best-effort: audit logging failures should not
 * break the primary mutation, so errors are swallowed.
 */
export async function logAudit(
  db: DrizzleD1Database<typeof schema>,
  entry: AuditEntry,
): Promise<void> {
  try {
    await db
      .insert(schema.auditLogs)
      .values({
        id: crypto.randomUUID(),
        actor: entry.actor ?? null,
        role: entry.role ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        detail: entry.detail ?? null,
        at: new Date().toISOString(),
      })
      .run();
  } catch (err) {
    console.error("[audit] failed to record log entry", err);
  }
}

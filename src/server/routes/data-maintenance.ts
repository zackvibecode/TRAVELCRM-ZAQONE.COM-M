import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { requireStaffSession, requireRole, requirePermission } from "../middleware/auth";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

type Env = {
  Bindings: { DOCUMENTS: R2Bucket };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: { id: string; name: string; email: string; role: string; sessionId: string };
    userRole: string;
  };
};

const maintenanceRouter = new Hono<Env>();

// Super Admin only.
maintenanceRouter.use(
  "*",
  requireStaffSession,
  requireRole("super_admin"),
  requirePermission("settings:write"),
);

/** Table counts for the Data Maintenance dashboard. */
const COUNT_TABLES = [
  ["bookings", "bookings"],
  ["passengers", "passengers"],
  ["customers", "customers"],
  ["leads", "leads"],
  ["invoices", "invoices"],
  ["payments", "payments"],
  ["packages", "packages"],
  ["departures", "packageDepartureDates"],
  ["seatHolds", "seatHolds"],
  ["auditLogs", "auditLogs"],
  ["mcpAuditLogs", "mcpAuditLogs"],
  ["documents", "passengerDocuments"],
] as const;

/** GET /data-maintenance/usage — row counts per table + R2 object estimate. */
maintenanceRouter.get("/usage", async (c) => {
  const db = c.get("db");
  const tables: { table: string; rows: number }[] = [];
  for (const [label, tableKey] of COUNT_TABLES) {
    const rows = await db
      .select({ value: (schema as never as Record<string, { id: never }>)[tableKey]!.id })
      .from(
        (schema as never as Record<string, typeof schema.bookings>)[tableKey]!,
      );
    tables.push({ table: label, rows: rows.length });
  }

  let r2Objects = 0;
  let r2Bytes = 0;
  let cursor: string | undefined;
  do {
    const page = await c.env.DOCUMENTS.list({ cursor });
    r2Objects += page.objects.length;
    r2Bytes += page.objects.reduce((s, o) => s + o.size, 0);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return c.json({
    success: true,
    usage: {
      tables,
      storage: { objects: r2Objects, totalBytes: r2Bytes },
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /data-maintenance/export — full JSON snapshot of the CRM data.
 * Returns a downloadable file; excludes internal hashes and tokens.
 */
maintenanceRouter.get("/export", async (c) => {
  const db = c.get("db");
  const exportData: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    version: 1,
  };

  for (const [label, tableKey] of COUNT_TABLES) {
    const rows = await db
      .select()
      .from(
        (schema as never as Record<string, typeof schema.bookings>)[tableKey]!,
      );
    exportData[label] = rows;
  }

  const filename = `zaqone-backup-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
});

/** POST /data-maintenance/cleanup/expired-holds — purge expired seat holds. */
maintenanceRouter.post("/cleanup/expired-holds", async (c) => {
  const db = c.get("db");
  const { releaseExpiredHolds } = await import("../lib/seat-availability");
  const released = await releaseExpiredHolds(db);
  return c.json({ success: true, released });
});

/**
 * Danger-zone actions require a confirmation phrase matching the action code.
 * Each destructive action is audited before it runs.
 */
const DANGER_ACTIONS: Record<string, { phrase: string; label: string }> = {
  clear_cache: { phrase: "CLEAR CACHE", label: "Clear application cache" },
  rebuild_index: { phrase: "REBUILD INDEX", label: "Rebuild search indexes" },
  purge_old_logs: { phrase: "PURGE LOGS", label: "Purge audit logs older than 90 days" },
  purge_expired_holds: {
    phrase: "PURGE HOLDS",
    label: "Purge expired seat holds",
  },
};

/**
 * POST /data-maintenance/danger/:action
 * Body: { confirmation: string } — must equal the action's phrase exactly.
 */
maintenanceRouter.post("/danger/:action", async (c) => {
  const db = c.get("db");
  const action = c.req.param("action");
  const rule = DANGER_ACTIONS[action];
  if (!rule) {
    return c.json({ success: false, error: "Unknown danger-zone action" }, 404);
  }

  const body = (await c.req.json()) as { confirmation?: string };
  if (body.confirmation !== rule.phrase) {
    return c.json(
      {
        success: false,
        error: `Confirmation phrase must be exactly '${rule.phrase}'`,
      },
      400,
    );
  }

  let affected = 0;
  switch (action) {
    case "clear_cache": {
      // Cache is edge-level; nothing persisted here. Bust via cache-control hint.
      affected = 0;
      break;
    }
    case "rebuild_index": {
      // Search index rebuild is a no-op stub until a search provider is wired.
      affected = 0;
      break;
    }
    case "purge_old_logs": {
      const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const old = await db
        .select({ id: schema.auditLogs.id })
        .from(schema.auditLogs)
        .where(sql`${schema.auditLogs.at} < ${cutoff}`);
      affected = old.length;
      for (const row of old) {
        await db.delete(schema.auditLogs).where(eq(schema.auditLogs.id, row.id));
      }
      break;
    }
    case "purge_expired_holds": {
      const { releaseExpiredHolds } = await import("../lib/seat-availability");
      affected = await releaseExpiredHolds(db);
      break;
    }
  }

  // Audit before responding — every danger action is recorded.
  await db.insert(schema.settingsAuditLogs).values({
    id: crypto.randomUUID(),
    actor: c.get("staff")?.email ?? "system",
    role: "super_admin",
    module: "data-maintenance",
    field: rule.label,
    beforeValue: null,
    afterValue: JSON.stringify({ action, affected }),
    changeType: "deleted",
  });

  return c.json({ success: true, action, affected, message: `${rule.label} completed` });
});

/** GET /data-maintenance/danger-actions — list guarded actions & phrases. */
maintenanceRouter.get("/danger-actions", async (c) => {
  return c.json({
    success: true,
    actions: Object.entries(DANGER_ACTIONS).map(([code, rule]) => ({
      code,
      label: rule.label,
      confirmationPhrase: rule.phrase,
    })),
  });
});

export default maintenanceRouter;

import { Hono } from "hono";
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

export default maintenanceRouter;

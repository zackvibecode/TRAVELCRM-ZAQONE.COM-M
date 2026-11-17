import { Hono } from "hono";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole, requirePermission } from "../middleware/auth";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    userRole: string;
  };
};

const staffAuditRouter = new Hono<Env>();

// Management and Super Admin can view the audit trail; only they need it.
staffAuditRouter.use("*", requireRole("super_admin", "management"));
staffAuditRouter.use("*", requirePermission("settings:read"));

/**
 * GET /staff-audit?userEmail=&action=&outcome=&date=&limit=&offset=
 * Filterable, paginated audit trail for the Staff Audit Log page.
 */
staffAuditRouter.get("/", async (c) => {
  const db = c.get("db");
  const userEmail = c.req.query("userEmail");
  const action = c.req.query("action");
  const outcome = c.req.query("outcome");
  const date = c.req.query("date"); // YYYY-MM-DD, matched in UTC
  const limit = Math.min(Number(c.req.query("limit") ?? 100) || 100, 500);
  const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);

  const conditions = [];
  if (userEmail) {
    conditions.push(eq(schema.staffAuditLogs.actorEmail, userEmail));
  }
  if (action) {
    conditions.push(
      eq(
        schema.staffAuditLogs.action,
        action as (typeof schema.staffAuditLogs.$inferSelect)["action"],
      ),
    );
  }
  if (outcome === "success" || outcome === "failed") {
    conditions.push(eq(schema.staffAuditLogs.outcome, outcome));
  }
  if (date) {
    // createdAt is a unix-timestamp column; match the given calendar day.
    const start = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
    const end = start + 86_400;
    conditions.push(
      gte(schema.staffAuditLogs.createdAt, new Date(start * 1000)),
    );
    conditions.push(
      lt(schema.staffAuditLogs.createdAt, new Date(end * 1000)),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(schema.staffAuditLogs)
    .where(where)
    .orderBy(desc(schema.staffAuditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // COUNT via aggregate select.
  const totalRows = await db
    .select({ value: schema.staffAuditLogs.id })
    .from(schema.staffAuditLogs)
    .where(where);

  return c.json({
    success: true,
    total: totalRows.length,
    limit,
    offset,
    entries: rows,
  });
});

export default staffAuditRouter;

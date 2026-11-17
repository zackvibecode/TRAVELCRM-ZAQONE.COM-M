import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";
import { generateAlerts, markAlertsRead } from "../lib/alerts";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
  };
};

const alertsRouter = new Hono<Env>();

/**
 * GET /alerts?unread=1
 * List persisted alerts (newest first). `unread=1` filters unread only.
 */
alertsRouter.get("/", async (c) => {
  const db = c.get("db");
  const unreadOnly = c.req.query("unread") === "1";

  const rows = await db.all<schema.AlertRow>(sql`
    SELECT * FROM alerts
    ${unreadOnly ? sql`WHERE is_read = 0` : sql``}
    ORDER BY created_at DESC
    LIMIT 100
  `);

  const unread = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count FROM alerts WHERE is_read = 0
  `);

  return c.json({
    alerts: rows,
    unreadCount: Number(unread[0]?.count ?? 0),
  });
});

/**
 * POST /alerts/generate
 * Scan live data and persist any new alerts (idempotent — dedup by entity).
 */
alertsRouter.post("/generate", async (c) => {
  const db = c.get("db");
  const created = await generateAlerts(db);
  return c.json({ created });
});

/**
 * POST /alerts/:id/read  — mark a single alert as read.
 */
alertsRouter.post("/:id/read", async (c) => {
  const db = c.get("db");
  const updated = await markAlertsRead(db, c.req.param("id"));
  return c.json({ updated });
});

/**
 * POST /alerts/read-all  — mark all alerts as read.
 */
alertsRouter.post("/read-all", async (c) => {
  const db = c.get("db");
  const updated = await markAlertsRead(db);
  return c.json({ updated });
});

export default alertsRouter;

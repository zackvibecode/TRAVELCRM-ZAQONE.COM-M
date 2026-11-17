import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";

type DB = DrizzleD1Database<typeof schema>;

/**
 * Scheduled content maintenance (run by Cloudflare cron):
 * - Activate banners whose start_at has arrived / deactivate expired ones.
 * - Publish pages whose scheduled_at has arrived.
 *
 * Returns { bannersActivated, bannersDeactivated, pagesPublished } for logging.
 */
export async function runScheduledContent(db: DB): Promise<{
  bannersActivated: number;
  bannersDeactivated: number;
  pagesPublished: number;
}> {
  // Banners: flip active=1 when within window, active=0 when outside.
  const activated = await db.all<{ id: string }>(sql`
    SELECT id FROM site_banners
    WHERE active = 0
      AND (start_at IS NULL OR start_at <= date('now'))
      AND (end_at IS NULL OR end_at >= date('now'))
  `);
  if (activated.length > 0) {
    const ids = activated.map((r) => r.id);
    await db.execute(sql`
      UPDATE site_banners SET active = 1
      WHERE id IN ${sql.join(ids.map((id) => sql`${id}`), sql`, `)}
    `);
  }

  const deactivated = await db.all<{ id: string }>(sql`
    SELECT id FROM site_banners
    WHERE active = 1
      AND ((start_at IS NOT NULL AND start_at > date('now'))
        OR (end_at IS NOT NULL AND end_at < date('now')))
  `);
  if (deactivated.length > 0) {
    const ids = deactivated.map((r) => r.id);
    await db.execute(sql`
      UPDATE site_banners SET active = 0
      WHERE id IN ${sql.join(ids.map((id) => sql`${id}`), sql`, `)}
    `);
  }

  // Pages: auto-publish when scheduled_at has arrived.
  const pages = await db.all<{ id: string }>(sql`
    SELECT id FROM site_pages
    WHERE status = 'draft'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= datetime('now')
  `);
  if (pages.length > 0) {
    const ids = pages.map((r) => r.id);
    await db.execute(sql`
      UPDATE site_pages SET status = 'published', updated_at = datetime('now')
      WHERE id IN ${sql.join(ids.map((id) => sql`${id}`), sql`, `)}
    `);
  }

  return {
    bannersActivated: activated.length,
    bannersDeactivated: deactivated.length,
    pagesPublished: pages.length,
  };
}

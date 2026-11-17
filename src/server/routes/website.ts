import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
  };
};

const websiteRouter = new Hono<Env>();

/**
 * Public website content endpoints. Only published pages and active banners
 * (within their display window) are exposed — draft content never leaks.
 */

/**
 * GET /website/pages — all published pages (slug, title, content).
 */
websiteRouter.get("/pages", async (c) => {
  const db = c.get("db");

  const rows = await db.all<{
    slug: string;
    title: string;
    content: string;
    updatedAt: string;
  }>(sql`
    SELECT slug, title, content, updated_at AS updatedAt
    FROM site_pages
    WHERE status = 'published'
    ORDER BY slug ASC
  `);

  return c.json({ pages: rows });
});

/**
 * GET /website/pages/:slug — a single published page (404 on draft/missing).
 */
websiteRouter.get("/pages/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");

  const rows = await db.all<{
    slug: string;
    title: string;
    content: string;
    updatedAt: string;
  }>(sql`
    SELECT slug, title, content, updated_at AS updatedAt
    FROM site_pages
    WHERE status = 'published' AND slug = ${slug}
    LIMIT 1
  `);

  if (rows.length === 0) {
    return c.json({ error: "page not found" }, 404);
  }
  return c.json({ page: rows[0] });
});

/**
 * GET /website/banners — active banners whose window covers today.
 */
websiteRouter.get("/banners", async (c) => {
  const db = c.get("db");

  const rows = await db.all<{
    id: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    ctaHref: string;
  }>(sql`
    SELECT id, title, subtitle, cta_label AS ctaLabel, cta_href AS ctaHref
    FROM site_banners
    WHERE active = 1
      AND (start_at IS NULL OR start_at <= date('now'))
      AND (end_at IS NULL OR end_at >= date('now'))
    ORDER BY created_at DESC
  `);

  return c.json({ banners: rows });
});

/**
 * GET /website/seo — SEO metadata for all pages that have it.
 */
websiteRouter.get("/seo", async (c) => {
  const db = c.get("db");

  const rows = await db.all<{
    slug: string;
    metaTitle: string;
    metaDescription: string;
    keywords: string;
  }>(sql`
    SELECT slug, meta_title AS metaTitle, meta_description AS metaDescription, keywords
    FROM site_seo
    ORDER BY slug ASC
  `);

  return c.json({ seo: rows });
});

// ---------------------------------------------------------------------------
// Admin content management (persisted CRUD for the Website Manager screen).
// ---------------------------------------------------------------------------

/**
 * GET /website/admin/pages — every page including drafts.
 */
websiteRouter.get("/admin/pages", async (c) => {
  const db = c.get("db");

  const rows = await db.all<schema.SitePageRow>(sql`
    SELECT * FROM site_pages ORDER BY slug ASC
  `);

  return c.json({ pages: rows });
});

/**
 * PUT /website/admin/pages/:id — upsert page content/status.
 */
websiteRouter.put("/admin/pages/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    content?: string;
    status?: "draft" | "published";
    scheduledAt?: string | null;
  }>();

  await db.execute(sql`
    INSERT INTO site_pages (id, slug, title, content, status, scheduled_at, updated_at)
    VALUES (
      ${id},
      ${id},
      ${body.title ?? ""},
      ${body.content ?? ""},
      ${body.status ?? "draft"},
      ${body.scheduledAt ?? null},
      datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      status = excluded.status,
      scheduled_at = excluded.scheduled_at,
      updated_at = datetime('now')
  `);

  const rows = await db.all<schema.SitePageRow>(sql`
    SELECT * FROM site_pages WHERE id = ${id} LIMIT 1
  `);
  return c.json({ page: rows[0] ?? null });
});

/**
 * POST /website/admin/pages — create a new page (id required, unique slug).
 */
websiteRouter.post("/admin/pages", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    id: string;
    slug?: string;
    title?: string;
    content?: string;
    status?: "draft" | "published";
  }>();

  if (!body.id) return c.json({ error: "id is required" }, 400);

  await db.execute(sql`
    INSERT INTO site_pages (id, slug, title, content, status, updated_at)
    VALUES (
      ${body.id},
      ${body.slug ?? body.id},
      ${body.title ?? ""},
      ${body.content ?? ""},
      ${body.status ?? "draft"},
      datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      content = excluded.content,
      status = excluded.status,
      updated_at = datetime('now')
  `);

  const rows = await db.all<schema.SitePageRow>(sql`
    SELECT * FROM site_pages WHERE id = ${body.id} LIMIT 1
  `);
  return c.json({ page: rows[0] ?? null }, 201);
});

/**
 * DELETE /website/admin/pages/:id
 */
websiteRouter.delete("/admin/pages/:id", async (c) => {
  const db = c.get("db");
  await db.execute(sql`DELETE FROM site_pages WHERE id = ${c.req.param("id")}`);
  return c.json({ ok: true });
});

/**
 * PATCH /website/admin/pages/:id/publish — toggle publish status.
 */
websiteRouter.patch("/admin/pages/:id/publish", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{ status?: "draft" | "published" }>();
  const status = body.status ?? "published";

  await db.execute(sql`
    UPDATE site_pages SET status = ${status}, updated_at = datetime('now')
    WHERE id = ${c.req.param("id")}
  `);

  const rows = await db.all<schema.SitePageRow>(sql`
    SELECT * FROM site_pages WHERE id = ${c.req.param("id")} LIMIT 1
  `);
  return c.json({ page: rows[0] ?? null });
});

/**
 * PUT /website/admin/banners/:id — upsert a banner.
 */
websiteRouter.put("/admin/banners/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json<{
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaHref?: string;
    startAt?: string | null;
    endAt?: string | null;
    active?: boolean;
  }>();

  await db.execute(sql`
    INSERT INTO site_banners (id, title, subtitle, cta_label, cta_href, start_at, end_at, active)
    VALUES (
      ${id},
      ${body.title ?? ""},
      ${body.subtitle ?? ""},
      ${body.ctaLabel ?? ""},
      ${body.ctaHref ?? "/site/packages"},
      ${body.startAt ?? null},
      ${body.endAt ?? null},
      ${body.active ?? true}
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      cta_label = excluded.cta_label,
      cta_href = excluded.cta_href,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      active = excluded.active
  `);

  const rows = await db.all<schema.SiteBannerRow>(sql`
    SELECT * FROM site_banners WHERE id = ${id} LIMIT 1
  `);
  return c.json({ banner: rows[0] ?? null });
});

/**
 * DELETE /website/admin/banners/:id
 */
websiteRouter.delete("/admin/banners/:id", async (c) => {
  const db = c.get("db");
  await db.execute(sql`DELETE FROM site_banners WHERE id = ${c.req.param("id")}`);
  return c.json({ ok: true });
});

/**
 * PUT /website/admin/seo/:slug — upsert SEO metadata for a page slug.
 */
websiteRouter.put("/admin/seo/:slug", async (c) => {
  const db = c.get("db");
  const slug = c.req.param("slug");
  const body = await c.req.json<{
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string;
  }>();

  await db.execute(sql`
    INSERT INTO site_seo (slug, meta_title, meta_description, keywords, updated_at)
    VALUES (${slug}, ${body.metaTitle ?? ""}, ${body.metaDescription ?? ""}, ${body.keywords ?? ""}, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      meta_title = excluded.meta_title,
      meta_description = excluded.meta_description,
      keywords = excluded.keywords,
      updated_at = datetime('now')
  `);

  const rows = await db.all<schema.SiteSeoRow>(sql`
    SELECT * FROM site_seo WHERE slug = ${slug} LIMIT 1
  `);
  return c.json({ seo: rows[0] ?? null });
});

export default websiteRouter;

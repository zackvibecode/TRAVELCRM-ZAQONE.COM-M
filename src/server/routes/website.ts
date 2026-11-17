import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";

type Env = {
  Bindings: {
    DOCUMENTS: R2Bucket;
  };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
  };
};

const websiteRouter = new Hono<Env>();

/**
 * Purge cached public content after an admin mutation. Cloudflare's Cache API
 * is scoped to the Worker zone; `delete` on the request URL prefix is
 * best-effort (cache is revalidated on next request). Failures never block the
 * write — content is always fresh at the source (D1).
 */
async function purgeContentCache(c: { req: { url: string } }): Promise<void> {
  try {
    const cache = (globalThis as unknown as { caches?: CacheStorage }).caches?.default;
    if (!cache) return;
    const origin = new URL(c.req.url).origin;
    const paths = [
      "/website/pages",
      "/website/banners",
      "/website/seo",
      "/website/packages",
      "/website/featured",
    ];
    await Promise.all(
      paths.map((p) => cache.delete(new Request(`${origin}${p}`)).catch(() => false)),
    );
  } catch {
    // Cache purge is best-effort; never fail the mutation.
  }
}

/**
 * All admin content-management endpoints require Super Admin or Management.
 * Public read endpoints (pages, banners, packages, seo, images) stay open.
 */
websiteRouter.use("/admin/*", requireRole("super_admin", "management"));
websiteRouter.use("/admin", requireRole("super_admin", "management"));


/**
 * Public website content endpoints. Only published pages and active banners
 * (within their display window) are exposed — draft content never leaks.
 */

// ---------------------------------------------------------------------------
// Featured packages & admin content summary.
// ---------------------------------------------------------------------------

/**
 * GET /website/featured — featured published packages (for homepage).
 */
websiteRouter.get("/featured", async (c) => {
  const db = c.get("db");
  const rows = await db.all<{
    id: string;
    name: string;
    destination: string;
    durationDays: number;
    adultPrice: number;
    coverImageUrl: string | null;
  }>(sql`
    SELECT id, name, destination, duration_days AS durationDays,
           adult_price AS adultPrice, cover_image_url AS coverImageUrl
    FROM packages
    WHERE publish_status = 'published' AND featured = 1
    ORDER BY name ASC
    LIMIT 8
  `);
  return c.json({ packages: rows });
});

/**
 * PATCH /website/admin/packages/:id/featured — toggle featured flag.
 */
websiteRouter.patch("/admin/packages/:id/featured", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{ featured?: boolean }>();
  const featured = body.featured ?? true;
  await db.run(sql`
    UPDATE packages SET featured = ${featured}, updated_at = datetime('now')
    WHERE id = ${c.req.param("id")}
  `);
  const rows = await db.all<{ id: string; featured: number }>(sql`
    SELECT id, featured FROM packages WHERE id = ${c.req.param("id")} LIMIT 1
  `);
  await purgeContentCache(c);
  return c.json({ package: rows[0] ?? null });
});

/**
 * GET /website/admin/summary — counts for the Website Manager overview cards.
 */
websiteRouter.get("/admin/summary", async (c) => {
  const db = c.get("db");

  const pages = await db.all<{
    total: number;
    published: number;
  }>(sql`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published
    FROM site_pages
  `);
  const banners = await db.all<{ total: number; active: number }>(sql`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active
    FROM site_banners
  `);
  const packages = await db.all<{ published: number; featured: number }>(sql`
    SELECT
      SUM(CASE WHEN publish_status = 'published' THEN 1 ELSE 0 END) AS published,
      SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END) AS featured
    FROM packages
  `);
  const enquiries = await db.all<{ count: number }>(sql`
    SELECT COUNT(*) AS count FROM leads WHERE source_id IN (
      SELECT id FROM lead_sources WHERE name = 'Website'
    )
  `);

  return c.json({
    pages: {
      total: Number(pages[0]?.total ?? 0),
      published: Number(pages[0]?.published ?? 0),
    },
    banners: {
      total: Number(banners[0]?.total ?? 0),
      active: Number(banners[0]?.active ?? 0),
    },
    packages: {
      published: Number(packages[0]?.published ?? 0),
      featured: Number(packages[0]?.featured ?? 0),
    },
    enquiries: Number(enquiries[0]?.count ?? 0),
  });
});

// ---------------------------------------------------------------------------
// Public website enquiry → CRM lead capture (PRD req #9).
// ---------------------------------------------------------------------------

/**
 * POST /website/enquiries — capture a public enquiry as a new CRM lead.
 * Body: { name, phone, email?, packageName?, pax?, message? }
 * Creates/uses the "Website" lead source and records an audit entry.
 */
websiteRouter.post("/enquiries", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    name?: string;
    phone?: string;
    email?: string;
    packageName?: string;
    pax?: number;
    message?: string;
  }>();

  const name = (body.name ?? "").trim();
  const phone = (body.phone ?? "").trim();
  if (!name || !/\d/.test(phone)) {
    return c.json(
      { error: "name and a valid phone number are required" },
      400,
    );
  }

  // Ensure the "Website" lead source exists.
  const sourceRows = await db.all<{ id: string }>(sql`
    SELECT id FROM lead_sources WHERE name = 'Website' LIMIT 1
  `);
  let sourceId = sourceRows[0]?.id;
  if (!sourceId) {
    sourceId = crypto.randomUUID();
    await db.run(sql`
      INSERT INTO lead_sources (id, name, active) VALUES (${sourceId}, 'Website', 1)
    `);
  }

  const leadId = crypto.randomUUID();
  const enquiryNote = [
    body.packageName ? `Package: ${body.packageName}` : "",
    body.message ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  await db.insert(schema.leads).values({
    id: leadId,
    name,
    phone,
    email: body.email ?? null,
    destination: body.packageName ?? null,
    pax: body.pax ?? 1,
    stage: "new",
    sourceId,
    notes: enquiryNote || null,
  }).run();

  await db.run(sql`
    INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
    VALUES (${crypto.randomUUID()}, 'website', 'public', 'enquiry_to_lead', 'leads', ${leadId}, ${enquiryNote || null}, datetime('now'))
  `);

  return c.json(
    { success: true, leadId, message: "Enquiry received — our team will contact you." },
    201,
  );
});

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
// Public package catalogue.
// ---------------------------------------------------------------------------

/**
 * GET /website/packages — published packages with next departure + seats left.
 * Query: ?destination=...&search=...
 */
websiteRouter.get("/packages", async (c) => {
  const db = c.get("db");
  const destination = c.req.query("destination");
  const search = c.req.query("search");

  const rows = await db.all<{
    id: string;
    name: string;
    destination: string;
    durationDays: number;
    adultPrice: number;
    coverImageUrl: string | null;
    highlights: string;
    nextDeparture: string | null;
    seatsLeft: number;
  }>(sql`
    SELECT
      p.id, p.name, p.destination, p.duration_days AS durationDays,
      p.adult_price AS adultPrice, p.cover_image_url AS coverImageUrl,
      p.highlights,
      (SELECT MIN(d.departure_date) FROM departures d
        WHERE d.package_id = p.id AND d.status IN ('open','almost_full')
          AND d.departure_date >= date('now')) AS nextDeparture,
      (SELECT COALESCE(SUM(d.seat_capacity - d.seats_booked - d.seats_held), 0)
         FROM departures d
        WHERE d.package_id = p.id AND d.status IN ('open','almost_full')
          AND d.departure_date >= date('now')) AS seatsLeft
    FROM packages p
    WHERE p.publish_status = 'published'
      ${destination ? sql`AND p.destination = ${destination}` : sql``}
      ${search ? sql`AND (p.name LIKE ${`%${search}%`} OR p.destination LIKE ${`%${search}%`})` : sql``}
    ORDER BY p.destination ASC, p.name ASC
  `);

  return c.json({
    packages: rows.map((r) => ({
      ...r,
      highlights: (() => {
        try {
          return JSON.parse(r.highlights || "[]");
        } catch {
          return [];
        }
      })(),
    })),
  });
});

/**
 * GET /website/packages/:id/availability — seat availability snapshot for the
 * package's next open departures. Used by the public detail page availability
 * badge and the booking "choose departure" step.
 */
websiteRouter.get("/packages/:id/availability", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const rows = await db.all<{
    id: string;
    departureDate: string;
    seatCapacity: number;
    seatsBooked: number;
    seatsHeld: number;
    status: string;
  }>(sql`
    SELECT id, departure_date AS departureDate,
           seat_capacity AS seatCapacity,
           seats_booked AS seatsBooked,
           seats_held AS seatsHeld, status
    FROM departures
    WHERE package_id = ${id}
      AND status IN ('open', 'almost_full', 'full')
      AND departure_date >= date('now')
    ORDER BY departure_date ASC
    LIMIT 12
  `);

  return c.json({
    packageId: id,
    departures: rows.map((d) => {
      const capacity = Number(d.seatCapacity);
      const confirmed = Number(d.seatsBooked);
      const held = Number(d.seatsHeld);
      const available = Math.max(0, capacity - confirmed - held);
      return {
        id: d.id,
        departureDate: d.departureDate,
        capacity,
        confirmed,
        held,
        available,
        isAlmostFull: capacity > 0 && available / capacity <= 0.2,
        isFull: available === 0,
        status: d.status,
      };
    }),
  });
});

/**
 * GET /website/packages/:id — full published detail + departure dates.
 */
websiteRouter.get("/packages/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const pkg = await db.all<schema.PackageRow>(sql`
    SELECT * FROM packages WHERE id = ${id} AND publish_status = 'published' LIMIT 1
  `);
  if (pkg.length === 0) return c.json({ error: "package not found" }, 404);

  const departures = await db.all<{
    id: string;
    departureDate: string;
    returnDate: string | null;
    adultPrice: number;
    seatCapacity: number;
    seatsBooked: number;
    seatsHeld: number;
    status: string;
  }>(sql`
    SELECT id, departure_date AS departureDate, return_date AS returnDate,
           adult_price AS adultPrice, seat_capacity AS seatCapacity,
           seats_booked AS seatsBooked, seats_held AS seatsHeld, status
    FROM departures
    WHERE package_id = ${id}
      AND status NOT IN ('cancelled', 'closed')
      AND departure_date >= date('now')
    ORDER BY departure_date ASC
  `);

  return c.json({
    package: pkg[0],
    departures: departures.map((d) => ({
      ...d,
      seatsLeft: Math.max(
        0,
        Number(d.seatCapacity) - Number(d.seatsBooked) - Number(d.seatsHeld),
      ),
    })),
  });
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

  await db.run(sql`
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
  await purgeContentCache(c);
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

  await db.run(sql`
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
  await purgeContentCache(c);
  return c.json({ page: rows[0] ?? null }, 201);
});

/**
 * DELETE /website/admin/pages/:id
 */
websiteRouter.delete("/admin/pages/:id", async (c) => {
  const db = c.get("db");
  await db.run(sql`DELETE FROM site_pages WHERE id = ${c.req.param("id")}`);
  await purgeContentCache(c);
  return c.json({ ok: true });
});

/**
 * PATCH /website/admin/pages/:id/publish — toggle publish status.
 */
websiteRouter.patch("/admin/pages/:id/publish", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{ status?: "draft" | "published" }>();
  const status = body.status ?? "published";

  await db.run(sql`
    UPDATE site_pages SET status = ${status}, updated_at = datetime('now')
    WHERE id = ${c.req.param("id")}
  `);

  const rows = await db.all<schema.SitePageRow>(sql`
    SELECT * FROM site_pages WHERE id = ${c.req.param("id")} LIMIT 1
  `);
  await purgeContentCache(c);
  return c.json({ page: rows[0] ?? null });
});

/**
 * GET /website/admin/banners — every banner including inactive.
 */
websiteRouter.get("/admin/banners", async (c) => {
  const db = c.get("db");
  const rows = await db.all<schema.SiteBannerRow>(sql`
    SELECT * FROM site_banners ORDER BY created_at DESC
  `);
  return c.json({ banners: rows });
});

/**
 * POST /website/admin/banners — create/replace a banner with a display window.
 */
websiteRouter.post("/admin/banners", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    id?: string;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaHref?: string;
    startAt?: string | null;
    endAt?: string | null;
    active?: boolean;
  }>();
  const id = body.id ?? crypto.randomUUID();

  await db.run(sql`
    INSERT INTO site_banners (id, title, subtitle, cta_label, cta_href, start_at, end_at, active)
    VALUES (
      ${id}, ${body.title ?? ""}, ${body.subtitle ?? ""},
      ${body.ctaLabel ?? ""}, ${body.ctaHref ?? "/site/packages"},
      ${body.startAt ?? null}, ${body.endAt ?? null}, ${body.active ?? true}
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title, subtitle = excluded.subtitle,
      cta_label = excluded.cta_label, cta_href = excluded.cta_href,
      start_at = excluded.start_at, end_at = excluded.end_at, active = excluded.active
  `);

  const rows = await db.all<schema.SiteBannerRow>(sql`
    SELECT * FROM site_banners WHERE id = ${id} LIMIT 1
  `);
  await purgeContentCache(c);
  return c.json({ banner: rows[0] ?? null }, 201);
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

  await db.run(sql`
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
  await purgeContentCache(c);
  return c.json({ banner: rows[0] ?? null });
});

/**
 * PATCH /website/admin/banners/:id/active — enable/disable a banner.
 */
websiteRouter.patch("/admin/banners/:id/active", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{ active?: boolean }>();
  const active = body.active ?? true;
  await db.run(sql`
    UPDATE site_banners SET active = ${active} WHERE id = ${c.req.param("id")}
  `);
  const rows = await db.all<schema.SiteBannerRow>(sql`
    SELECT * FROM site_banners WHERE id = ${c.req.param("id")} LIMIT 1
  `);
  await purgeContentCache(c);
  return c.json({ banner: rows[0] ?? null });
});

/**
 * DELETE /website/admin/banners/:id
 */
websiteRouter.delete("/admin/banners/:id", async (c) => {
  const db = c.get("db");
  await db.run(sql`DELETE FROM site_banners WHERE id = ${c.req.param("id")}`);
  await purgeContentCache(c);
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

  await db.run(sql`
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
  await purgeContentCache(c);
  return c.json({ seo: rows[0] ?? null });
});

/**
 * DELETE /website/admin/seo/:slug — remove SEO metadata for a page.
 */
websiteRouter.delete("/admin/seo/:slug", async (c) => {
  const db = c.get("db");
  await db.run(sql`DELETE FROM site_seo WHERE slug = ${c.req.param("slug")}`);
  await purgeContentCache(c);
  return c.json({ ok: true });
});

/**
 * GET /website/seo/:slug — SEO metadata for a single public page (404 if unset).
 */
websiteRouter.get("/seo/:slug", async (c) => {
  const db = c.get("db");
  const rows = await db.all<schema.SiteSeoRow>(sql`
    SELECT * FROM site_seo WHERE slug = ${c.req.param("slug")} LIMIT 1
  `);
  if (rows.length === 0) return c.json({ error: "SEO metadata not found" }, 404);
  return c.json({ seo: rows[0] });
});

/**
 * POST /website/admin/images — upload a site image to R2 (banners/pages).
 * Multipart form: `file` (image), optional `folder` (default `site`).
 * Returns the public URL path usable in sitePages.coverImageUrl / siteBanners.
 */
websiteRouter.post("/admin/images", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  const folder = ((form.get("folder") as string | null) ?? "site").replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  ) || "site";

  if (!(file instanceof File)) {
    return c.json({ error: "file field is required" }, 400);
  }
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (file.type && !allowed.includes(file.type)) {
    return c.json({ error: "only JPEG, PNG, WebP or GIF images are allowed" }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "image must be 5 MB or smaller" }, 400);
  }

  const key = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await c.env.DOCUMENTS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  return c.json(
    {
      key,
      url: `/site-images/${key}`,
      sizeBytes: file.size,
      mimeType: file.type || null,
    },
    201,
  );
});

/**
 * GET /site-images/* — serve a public site image from R2 (cacheable).
 */
websiteRouter.get("/site-images/*", async (c) => {
  const key = c.req.path.replace(/^\/website\/site-images\//, "");
  if (!key || key.includes("..")) return c.json({ error: "invalid key" }, 400);

  const object = await c.env.DOCUMENTS.get(key);
  if (!object) return c.json({ error: "image not found" }, 404);

  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": object.etag,
    },
  });
});

export default websiteRouter;

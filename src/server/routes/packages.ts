import { Hono } from "hono";
import { and, asc, desc, eq, like, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";
import { logAudit } from "../lib/audit";

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const packagesRouter = new Hono<{ Variables: Variables }>();

// GET /packages — list + search/filter.
// Query: q (name/destination), destination, status (publishStatus),
//        sort (name|price|created), order (asc|desc), limit, offset.
packagesRouter.get("/packages", async (c) => {
  const db = c.get("db");
  const q = c.req.query("q");
  const destination = c.req.query("destination");
  const status = c.req.query("status") as
    | schema.PackageRow["publishStatus"]
    | undefined;
  const sort = c.req.query("sort") ?? "created";
  const order = c.req.query("order") === "asc" ? "asc" : "desc";
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 100);
  const offset = Math.max(Number(c.req.query("offset") ?? 0), 0);

  const conditions = [];
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        like(schema.packages.name, pattern),
        like(schema.packages.destination, pattern),
      ),
    );
  }
  if (destination) {
    conditions.push(eq(schema.packages.destination, destination));
  }
  if (status) {
    conditions.push(eq(schema.packages.publishStatus, status));
  }

  const orderBy =
    sort === "name"
      ? schema.packages.name
      : sort === "price"
        ? schema.packages.adultPrice
        : schema.packages.createdAt;

  const rows = await db
    .select()
    .from(schema.packages)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(order === "asc" ? asc(orderBy) : desc(orderBy))
    .limit(limit)
    .offset(offset)
    .all();

  return c.json({ success: true, packages: rows });
});

// GET /packages/:id — single package with pricing, itinerary, and media.
packagesRouter.get("/packages/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const pkg = await db
    .select()
    .from(schema.packages)
    .where(eq(schema.packages.id, id))
    .get();
  if (!pkg) {
    return c.json({ success: false, error: "Package not found" }, 404);
  }

  const [pricing, itinerary, media, departureDates] = await Promise.all([
    db
      .select()
      .from(schema.packagePricing)
      .where(eq(schema.packagePricing.packageId, id))
      .all(),
    db
      .select()
      .from(schema.packageItineraryItems)
      .where(eq(schema.packageItineraryItems.packageId, id))
      .orderBy(asc(schema.packageItineraryItems.dayNumber))
      .all(),
    db
      .select()
      .from(schema.packageMedia)
      .where(eq(schema.packageMedia.packageId, id))
      .orderBy(asc(schema.packageMedia.sortOrder))
      .all(),
    db
      .select()
      .from(schema.packageDepartureDates)
      .where(eq(schema.packageDepartureDates.packageId, id))
      .orderBy(asc(schema.packageDepartureDates.departureDate))
      .all(),
  ]);

  return c.json({
    success: true,
    package: pkg,
    pricing,
    itinerary,
    media,
    departureDates,
  });
});

// POST /packages — create (sales/management/super_admin).
packagesRouter.post(
  "/packages",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const destination =
      typeof body.destination === "string" ? body.destination.trim() : "";
    if (!name || !destination) {
      return c.json(
        { success: false, error: "name and destination are required" },
        400,
      );
    }

    const publishStatus = (
      ["draft", "published", "archived"] as const
    ).includes(body.publishStatus as never)
      ? (body.publishStatus as schema.PackageRow["publishStatus"])
      : "draft";

    const row: schema.NewPackageRow = {
      id: crypto.randomUUID(),
      name,
      destination,
      durationDays: Number(body.durationDays ?? 0) || 0,
      description: (body.description as string) ?? null,
      highlights: (body.highlights as string[]) ?? [],
      itinerary: (body.itinerary as string[]) ?? [],
      inclusions: (body.inclusions as string[]) ?? [],
      exclusions: (body.exclusions as string[]) ?? [],
      adultPrice: Number(body.adultPrice ?? 0) || 0,
      childPrice: Number(body.childPrice ?? 0) || 0,
      infantPrice: Number(body.infantPrice ?? 0) || 0,
      coverImageUrl: (body.coverImageUrl as string) ?? null,
      images: (body.images as string[]) ?? [],
      pdfUrl: (body.pdfUrl as string) ?? null,
      publishStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insert(schema.packages).values(row).run();
    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package.created",
      entityType: "package",
      entityId: row.id,
      detail: `${name} (${destination})`,
    });

    return c.json({ success: true, package: row }, 201);
  },
);

// PATCH /packages/:id — update (sales/management/super_admin).
packagesRouter.patch(
  "/packages/:id",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const existing = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, id))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const patch: Partial<schema.NewPackageRow> = {};
    if (typeof body.name === "string" && body.name.trim())
      patch.name = body.name.trim();
    if (typeof body.destination === "string" && body.destination.trim())
      patch.destination = body.destination.trim();
    if (body.durationDays !== undefined)
      patch.durationDays = Number(body.durationDays) || 0;
    if (body.description !== undefined)
      patch.description = (body.description as string) ?? null;
    if (body.highlights !== undefined)
      patch.highlights = (body.highlights as string[]) ?? [];
    if (body.itinerary !== undefined)
      patch.itinerary = (body.itinerary as string[]) ?? [];
    if (body.inclusions !== undefined)
      patch.inclusions = (body.inclusions as string[]) ?? [];
    if (body.exclusions !== undefined)
      patch.exclusions = (body.exclusions as string[]) ?? [];
    if (body.adultPrice !== undefined)
      patch.adultPrice = Number(body.adultPrice) || 0;
    if (body.childPrice !== undefined)
      patch.childPrice = Number(body.childPrice) || 0;
    if (body.infantPrice !== undefined)
      patch.infantPrice = Number(body.infantPrice) || 0;
    if (body.coverImageUrl !== undefined)
      patch.coverImageUrl = (body.coverImageUrl as string) ?? null;
    if (body.images !== undefined)
      patch.images = (body.images as string[]) ?? [];
    if (body.pdfUrl !== undefined)
      patch.pdfUrl = (body.pdfUrl as string) ?? null;
    if (
      ["draft", "published", "archived"].includes(
        body.publishStatus as string,
      )
    ) {
      patch.publishStatus = body.publishStatus as schema.PackageRow["publishStatus"];
    }
    patch.updatedAt = new Date().toISOString();

    await db
      .update(schema.packages)
      .set(patch)
      .where(eq(schema.packages.id, id))
      .run();

    const updated = await db
      .select()
      .from(schema.packages)
      .where(eq(schema.packages.id, id))
      .get();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package.updated",
      entityType: "package",
      entityId: id,
      detail: `updated fields: ${Object.keys(patch).join(", ")}`,
    });

    return c.json({ success: true, package: updated });
  },
);

// POST /packages/:id/duplicate — duplicate a package (new id, draft status).
packagesRouter.post(
  "/packages/:id/duplicate",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const existing = await db
      .select()
      .from(schema.packages)
      .where(eq(schema.packages.id, id))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    const copy: schema.NewPackageRow = {
      ...existing,
      id: crypto.randomUUID(),
      name: `${existing.name} (Copy)`,
      publishStatus: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insert(schema.packages).values(copy).run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package.duplicated",
      entityType: "package",
      entityId: copy.id,
      detail: `duplicated from ${id}`,
    });

    return c.json({ success: true, package: copy }, 201);
  },
);

// DELETE /packages/:id — archive (soft archive, not hard delete).
packagesRouter.delete(
  "/packages/:id",
  requireRole("super_admin", "management"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const existing = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, id))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    await db
      .update(schema.packages)
      .set({ publishStatus: "archived", updatedAt: new Date().toISOString() })
      .where(eq(schema.packages.id, id))
      .run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package.archived",
      entityType: "package",
      entityId: id,
    });

    return c.json({ success: true });
  },
);

export default packagesRouter;

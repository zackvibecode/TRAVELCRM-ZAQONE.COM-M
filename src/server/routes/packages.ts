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

// POST /packages/:id/duplicate — duplicate a package (new id, draft status),
// including its pricing tiers, itinerary, media, and departure dates.
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

    const copyId = crypto.randomUUID();
    const now = new Date().toISOString();
    const copy: schema.NewPackageRow = {
      ...existing,
      id: copyId,
      name: `${existing.name} (Copy)`,
      publishStatus: "draft",
      createdAt: now,
      updatedAt: now,
    };

    // Copy the package plus all child records in one atomic batch.
    const [pricingRows, itineraryRows, mediaRows, dateRows] = await Promise.all([
      db
        .select()
        .from(schema.packagePricing)
        .where(eq(schema.packagePricing.packageId, id))
        .all(),
      db
        .select()
        .from(schema.packageItineraryItems)
        .where(eq(schema.packageItineraryItems.packageId, id))
        .all(),
      db
        .select()
        .from(schema.packageMedia)
        .where(eq(schema.packageMedia.packageId, id))
        .all(),
      db
        .select()
        .from(schema.packageDepartureDates)
        .where(eq(schema.packageDepartureDates.packageId, id))
        .all(),
    ]);

    await db.batch([
      db.insert(schema.packages).values(copy),
      ...pricingRows.map((row) =>
        db
          .insert(schema.packagePricing)
          .values({
            ...row,
            id: crypto.randomUUID(),
            packageId: copyId,
            createdAt: now,
            updatedAt: now,
          }),
      ),
      ...itineraryRows.map((row) =>
        db
          .insert(schema.packageItineraryItems)
          .values({ ...row, id: crypto.randomUUID(), packageId: copyId, createdAt: now }),
      ),
      ...mediaRows.map((row) =>
        db
          .insert(schema.packageMedia)
          .values({ ...row, id: crypto.randomUUID(), packageId: copyId, createdAt: now }),
      ),
      ...dateRows.map((row) =>
        db
          .insert(schema.packageDepartureDates)
          .values({
            ...row,
            id: crypto.randomUUID(),
            packageId: copyId,
            createdAt: now,
            updatedAt: now,
          }),
      ),
    ]);

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package.duplicated",
      entityType: "package",
      entityId: copyId,
      detail: `duplicated from ${id} with ${pricingRows.length} pricing, ${itineraryRows.length} itinerary, ${mediaRows.length} media, ${dateRows.length} departure date(s)`,
    });

    return c.json(
      {
        success: true,
        package: copy,
        copied: {
          pricing: pricingRows.length,
          itinerary: itineraryRows.length,
          media: mediaRows.length,
          departureDates: dateRows.length,
        },
      },
      201,
    );
  },
);

// DELETE /packages/:id — archive (soft archive, not hard delete).
// Pass ?restore=true to unarchive back to draft.
packagesRouter.delete(
  "/packages/:id",
  requireRole("super_admin", "management"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const restore = c.req.query("restore") === "true";

    const existing = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, id))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    const newStatus: schema.PackageRow["publishStatus"] = restore
      ? "draft"
      : "archived";

    await db
      .update(schema.packages)
      .set({ publishStatus: newStatus, updatedAt: new Date().toISOString() })
      .where(eq(schema.packages.id, id))
      .run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: restore ? "package.restored" : "package.archived",
      entityType: "package",
      entityId: id,
    });

    return c.json({ success: true, publishStatus: newStatus });
  },
);

// ---- Package pricing tiers ----

// GET /packages/:id/pricing — list pricing tiers for a package.
packagesRouter.get("/packages/:id/pricing", async (c) => {
  const db = c.get("db");
  const packageId = c.req.param("id");

  const pkg = await db
    .select({ id: schema.packages.id })
    .from(schema.packages)
    .where(eq(schema.packages.id, packageId))
    .get();
  if (!pkg) {
    return c.json({ success: false, error: "Package not found" }, 404);
  }

  const rows = await db
    .select()
    .from(schema.packagePricing)
    .where(eq(schema.packagePricing.packageId, packageId))
    .orderBy(desc(schema.packagePricing.isDefault))
    .all();

  return c.json({ success: true, pricing: rows });
});

// POST /packages/:id/pricing — add a pricing tier.
packagesRouter.post(
  "/packages/:id/pricing",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const packageId = c.req.param("id");

    const pkg = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, packageId))
      .get();
    if (!pkg) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const label = typeof body.label === "string" ? body.label.trim() : "";
    if (!label) {
      return c.json({ success: false, error: "label is required" }, 400);
    }

    const pricingType = (
      ["per_person", "per_package", "per_room"] as const
    ).includes(body.pricingType as never)
      ? (body.pricingType as schema.PackagePricingRow["pricingType"])
      : "per_person";

    const isDefault = body.isDefault === true;

    // Only one default tier per package: clear the flag on others first.
    if (isDefault) {
      await db
        .update(schema.packagePricing)
        .set({ isDefault: false })
        .where(eq(schema.packagePricing.packageId, packageId))
        .run();
    }

    const row: schema.NewPackagePricingRow = {
      id: crypto.randomUUID(),
      packageId,
      label,
      pricingType,
      adultPrice: Number(body.adultPrice ?? 0) || 0,
      childPrice: Number(body.childPrice ?? 0) || 0,
      infantPrice: Number(body.infantPrice ?? 0) || 0,
      validFrom: (body.validFrom as string) ?? null,
      validTo: (body.validTo as string) ?? null,
      isDefault,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insert(schema.packagePricing).values(row).run();
    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_pricing.created",
      entityType: "package_pricing",
      entityId: row.id,
      detail: `${label} for package ${packageId}`,
    });

    return c.json({ success: true, pricing: row }, 201);
  },
);

// PATCH /pricing/:pricingId — update a pricing tier.
packagesRouter.patch(
  "/pricing/:pricingId",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const pricingId = c.req.param("pricingId");

    const existing = await db
      .select()
      .from(schema.packagePricing)
      .where(eq(schema.packagePricing.id, pricingId))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Pricing tier not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const patch: Partial<schema.NewPackagePricingRow> = {};
    if (typeof body.label === "string" && body.label.trim())
      patch.label = body.label.trim();
    if (body.adultPrice !== undefined)
      patch.adultPrice = Number(body.adultPrice) || 0;
    if (body.childPrice !== undefined)
      patch.childPrice = Number(body.childPrice) || 0;
    if (body.infantPrice !== undefined)
      patch.infantPrice = Number(body.infantPrice) || 0;
    if (body.validFrom !== undefined)
      patch.validFrom = (body.validFrom as string) ?? null;
    if (body.validTo !== undefined)
      patch.validTo = (body.validTo as string) ?? null;
    if (body.isDefault === true) {
      // Only one default tier per package.
      await db
        .update(schema.packagePricing)
        .set({ isDefault: false })
        .where(eq(schema.packagePricing.packageId, existing.packageId))
        .run();
      patch.isDefault = true;
    } else if (body.isDefault === false) {
      patch.isDefault = false;
    }
    if (
      ["per_person", "per_package", "per_room"].includes(
        body.pricingType as string,
      )
    ) {
      patch.pricingType = body.pricingType as schema.PackagePricingRow["pricingType"];
    }
    patch.updatedAt = new Date().toISOString();

    await db
      .update(schema.packagePricing)
      .set(patch)
      .where(eq(schema.packagePricing.id, pricingId))
      .run();

    const updated = await db
      .select()
      .from(schema.packagePricing)
      .where(eq(schema.packagePricing.id, pricingId))
      .get();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_pricing.updated",
      entityType: "package_pricing",
      entityId: pricingId,
      detail: `updated fields: ${Object.keys(patch).join(", ")}`,
    });

    return c.json({ success: true, pricing: updated });
  },
);

// DELETE /pricing/:pricingId — remove a pricing tier.
packagesRouter.delete(
  "/pricing/:pricingId",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const pricingId = c.req.param("pricingId");

    const existing = await db
      .select({ id: schema.packagePricing.id })
      .from(schema.packagePricing)
      .where(eq(schema.packagePricing.id, pricingId))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Pricing tier not found" }, 404);
    }

    await db
      .delete(schema.packagePricing)
      .where(eq(schema.packagePricing.id, pricingId))
      .run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_pricing.deleted",
      entityType: "package_pricing",
      entityId: pricingId,
    });

    return c.json({ success: true });
  },
);

// ---- Package inclusions / exclusions ----

// PUT /packages/:id/inclusions — replace the inclusions list.
packagesRouter.put(
  "/packages/:id/inclusions",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const pkg = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, id))
      .get();
    if (!pkg) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    if (!Array.isArray(body.inclusions)) {
      return c.json(
        { success: false, error: "inclusions must be an array of strings" },
        400,
      );
    }

    await db
      .update(schema.packages)
      .set({
        inclusions: (body.inclusions as string[]).map((s) => String(s)),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.packages.id, id))
      .run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package.inclusions_updated",
      entityType: "package",
      entityId: id,
      detail: `${(body.inclusions as string[]).length} inclusion(s)`,
    });

    return c.json({ success: true, inclusions: body.inclusions });
  },
);

// PUT /packages/:id/exclusions — replace the exclusions list.
packagesRouter.put(
  "/packages/:id/exclusions",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const pkg = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, id))
      .get();
    if (!pkg) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    if (!Array.isArray(body.exclusions)) {
      return c.json(
        { success: false, error: "exclusions must be an array of strings" },
        400,
      );
    }

    await db
      .update(schema.packages)
      .set({
        exclusions: (body.exclusions as string[]).map((s) => String(s)),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.packages.id, id))
      .run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package.exclusions_updated",
      entityType: "package",
      entityId: id,
      detail: `${(body.exclusions as string[]).length} exclusion(s)`,
    });

    return c.json({ success: true, exclusions: body.exclusions });
  },
);

// ---- Package highlights & structured itinerary ----

// PUT /packages/:id/highlights — replace the highlights list.
packagesRouter.put(
  "/packages/:id/highlights",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");

    const pkg = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, id))
      .get();
    if (!pkg) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    if (!Array.isArray(body.highlights)) {
      return c.json(
        { success: false, error: "highlights must be an array of strings" },
        400,
      );
    }

    await db
      .update(schema.packages)
      .set({
        highlights: (body.highlights as string[]).map((s) => String(s)),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.packages.id, id))
      .run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package.highlights_updated",
      entityType: "package",
      entityId: id,
      detail: `${(body.highlights as string[]).length} highlight(s)`,
    });

    return c.json({ success: true, highlights: body.highlights });
  },
);

// GET /packages/:id/itinerary — list structured itinerary items.
packagesRouter.get("/packages/:id/itinerary", async (c) => {
  const db = c.get("db");
  const packageId = c.req.param("id");

  const pkg = await db
    .select({ id: schema.packages.id })
    .from(schema.packages)
    .where(eq(schema.packages.id, packageId))
    .get();
  if (!pkg) {
    return c.json({ success: false, error: "Package not found" }, 404);
  }

  const rows = await db
    .select()
    .from(schema.packageItineraryItems)
    .where(eq(schema.packageItineraryItems.packageId, packageId))
    .orderBy(asc(schema.packageItineraryItems.dayNumber))
    .all();

  return c.json({ success: true, itinerary: rows });
});

// POST /packages/:id/itinerary — add an itinerary day.
packagesRouter.post(
  "/packages/:id/itinerary",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const packageId = c.req.param("id");

    const pkg = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, packageId))
      .get();
    if (!pkg) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const dayNumber = Number(body.dayNumber ?? 0);
    if (!Number.isInteger(dayNumber) || dayNumber < 1) {
      return c.json(
        { success: false, error: "dayNumber must be a positive integer" },
        400,
      );
    }

    const row: schema.NewPackageItineraryItemRow = {
      id: crypto.randomUUID(),
      packageId,
      dayNumber,
      title: (body.title as string) ?? null,
      description: (body.description as string) ?? null,
      mealIncluded: (body.mealIncluded as string[]) ?? [],
      sortOrder: Number(body.sortOrder ?? dayNumber) || dayNumber,
      createdAt: new Date().toISOString(),
    };

    await db.insert(schema.packageItineraryItems).values(row).run();
    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_itinerary.created",
      entityType: "package_itinerary_item",
      entityId: row.id,
      detail: `day ${dayNumber} for package ${packageId}`,
    });

    return c.json({ success: true, item: row }, 201);
  },
);

// PATCH /itinerary/:itemId — update an itinerary day.
packagesRouter.patch(
  "/itinerary/:itemId",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const itemId = c.req.param("itemId");

    const existing = await db
      .select()
      .from(schema.packageItineraryItems)
      .where(eq(schema.packageItineraryItems.id, itemId))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Itinerary item not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const patch: Partial<schema.NewPackageItineraryItemRow> = {};
    if (body.dayNumber !== undefined) {
      const dayNumber = Number(body.dayNumber);
      if (!Number.isInteger(dayNumber) || dayNumber < 1) {
        return c.json(
          { success: false, error: "dayNumber must be a positive integer" },
          400,
        );
      }
      patch.dayNumber = dayNumber;
    }
    if (body.title !== undefined) patch.title = (body.title as string) ?? null;
    if (body.description !== undefined)
      patch.description = (body.description as string) ?? null;
    if (body.mealIncluded !== undefined)
      patch.mealIncluded = (body.mealIncluded as string[]) ?? [];
    if (body.sortOrder !== undefined)
      patch.sortOrder = Number(body.sortOrder) || 0;

    await db
      .update(schema.packageItineraryItems)
      .set(patch)
      .where(eq(schema.packageItineraryItems.id, itemId))
      .run();

    const updated = await db
      .select()
      .from(schema.packageItineraryItems)
      .where(eq(schema.packageItineraryItems.id, itemId))
      .get();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_itinerary.updated",
      entityType: "package_itinerary_item",
      entityId: itemId,
      detail: `updated fields: ${Object.keys(patch).join(", ")}`,
    });

    return c.json({ success: true, item: updated });
  },
);

// DELETE /itinerary/:itemId — remove an itinerary day.
packagesRouter.delete(
  "/itinerary/:itemId",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const itemId = c.req.param("itemId");

    const existing = await db
      .select({ id: schema.packageItineraryItems.id })
      .from(schema.packageItineraryItems)
      .where(eq(schema.packageItineraryItems.id, itemId))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Itinerary item not found" }, 404);
    }

    await db
      .delete(schema.packageItineraryItems)
      .where(eq(schema.packageItineraryItems.id, itemId))
      .run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_itinerary.deleted",
      entityType: "package_itinerary_item",
      entityId: itemId,
    });

    return c.json({ success: true });
  },
);

// ---- Package departure dates ----

// GET /packages/:id/departure-dates — list scheduled departures.
packagesRouter.get("/packages/:id/departure-dates", async (c) => {
  const db = c.get("db");
  const packageId = c.req.param("id");

  const pkg = await db
    .select({ id: schema.packages.id })
    .from(schema.packages)
    .where(eq(schema.packages.id, packageId))
    .get();
  if (!pkg) {
    return c.json({ success: false, error: "Package not found" }, 404);
  }

  const rows = await db
    .select()
    .from(schema.packageDepartureDates)
    .where(eq(schema.packageDepartureDates.packageId, packageId))
    .orderBy(asc(schema.packageDepartureDates.departureDate))
    .all();

  return c.json({ success: true, departureDates: rows });
});

// POST /packages/:id/departure-dates — add a departure date.
packagesRouter.post(
  "/packages/:id/departure-dates",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const packageId = c.req.param("id");

    const pkg = await db
      .select({ id: schema.packages.id })
      .from(schema.packages)
      .where(eq(schema.packages.id, packageId))
      .get();
    if (!pkg) {
      return c.json({ success: false, error: "Package not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const departureDate =
      typeof body.departureDate === "string" ? body.departureDate.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
      return c.json(
        { success: false, error: "departureDate must be YYYY-MM-DD" },
        400,
      );
    }

    const row: schema.NewPackageDepartureDateRow = {
      id: crypto.randomUUID(),
      packageId,
      departureDate,
      returnDate: (body.returnDate as string) ?? null,
      seatCapacity: Number(body.seatCapacity ?? 0) || 0,
      adultPrice: Number(body.adultPrice ?? 0) || 0,
      childPrice: Number(body.childPrice ?? 0) || 0,
      infantPrice: Number(body.infantPrice ?? 0) || 0,
      status: "scheduled",
      published: body.published === true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insert(schema.packageDepartureDates).values(row).run();
    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_departure_date.created",
      entityType: "package_departure_date",
      entityId: row.id,
      detail: `${departureDate} for package ${packageId}`,
    });

    return c.json({ success: true, departureDate: row }, 201);
  },
);

// PATCH /departure-dates/:dateId — update a departure date.
packagesRouter.patch(
  "/departure-dates/:dateId",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const dateId = c.req.param("dateId");

    const existing = await db
      .select()
      .from(schema.packageDepartureDates)
      .where(eq(schema.packageDepartureDates.id, dateId))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Departure date not found" }, 404);
    }

    let body: Record<string, unknown>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: "Invalid JSON body" }, 400);
    }

    const patch: Partial<schema.NewPackageDepartureDateRow> = {};
    if (body.departureDate !== undefined) {
      const departureDate = String(body.departureDate).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
        return c.json(
          { success: false, error: "departureDate must be YYYY-MM-DD" },
          400,
        );
      }
      patch.departureDate = departureDate;
    }
    if (body.returnDate !== undefined)
      patch.returnDate = (body.returnDate as string) ?? null;
    if (body.seatCapacity !== undefined)
      patch.seatCapacity = Number(body.seatCapacity) || 0;
    if (body.adultPrice !== undefined)
      patch.adultPrice = Number(body.adultPrice) || 0;
    if (body.childPrice !== undefined)
      patch.childPrice = Number(body.childPrice) || 0;
    if (body.infantPrice !== undefined)
      patch.infantPrice = Number(body.infantPrice) || 0;
    if (
      ["scheduled", "open", "almost_full", "full", "closed", "cancelled"].includes(
        body.status as string,
      )
    ) {
      patch.status = body.status as schema.PackageDepartureDateRow["status"];
    }
    if (body.published !== undefined) patch.published = body.published === true;
    patch.updatedAt = new Date().toISOString();

    await db
      .update(schema.packageDepartureDates)
      .set(patch)
      .where(eq(schema.packageDepartureDates.id, dateId))
      .run();

    const updated = await db
      .select()
      .from(schema.packageDepartureDates)
      .where(eq(schema.packageDepartureDates.id, dateId))
      .get();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_departure_date.updated",
      entityType: "package_departure_date",
      entityId: dateId,
      detail: `updated fields: ${Object.keys(patch).join(", ")}`,
    });

    return c.json({ success: true, departureDate: updated });
  },
);

// DELETE /departure-dates/:dateId — remove a departure date.
packagesRouter.delete(
  "/departure-dates/:dateId",
  requireRole("super_admin", "management", "sales"),
  async (c) => {
    const db = c.get("db");
    const dateId = c.req.param("dateId");

    const existing = await db
      .select({ id: schema.packageDepartureDates.id })
      .from(schema.packageDepartureDates)
      .where(eq(schema.packageDepartureDates.id, dateId))
      .get();
    if (!existing) {
      return c.json({ success: false, error: "Departure date not found" }, 404);
    }

    await db
      .delete(schema.packageDepartureDates)
      .where(eq(schema.packageDepartureDates.id, dateId))
      .run();

    await logAudit(db, {
      actor: c.req.header("x-user-id") ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "package_departure_date.deleted",
      entityType: "package_departure_date",
      entityId: dateId,
    });

    return c.json({ success: true });
  },
);

export default packagesRouter;

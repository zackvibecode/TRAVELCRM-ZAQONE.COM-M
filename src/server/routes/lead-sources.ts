import { Hono } from "hono";
import { asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { requireRole } from "../middleware/auth";

export type LeadSourcesEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const leadSourcesRouter = new Hono<{
  Bindings: LeadSourcesEnv;
  Variables: Variables;
}>();

interface CreateSourceInput {
  id?: string;
  name: string;
  description?: string;
  active?: boolean;
  createdBy?: string;
}

interface UpdateSourceInput {
  name?: string;
  description?: string | null;
  active?: boolean;
  updatedBy?: string;
}

// GET /lead-sources — list all sources (campaigns).
leadSourcesRouter.get(
  "/",
  requireRole("sales", "management", "finance", "operations"),
  async (c) => {
  const db = c.get("db");

  const includeInactive = c.req.query("includeInactive") === "true";
  const rows = await db
    .select()
    .from(schema.leadSources)
    .orderBy(asc(schema.leadSources.name))
    .all();

  const data = includeInactive ? rows : rows.filter((r) => r.active);

  return c.json({ success: true, data });
  },
);

// GET /lead-sources/summary — lead counts, pipeline value, win rate per source.
leadSourcesRouter.get(
  "/summary",
  requireRole("sales", "management", "finance"),
  async (c) => {
  const db = c.get("db");

  const [sources, leads] = await Promise.all([
    db.select().from(schema.leadSources).all(),
    db.select().from(schema.leads).all(),
  ]);

  const summary = sources.map((source) => {
    const sourceLeads = leads.filter((l) => l.sourceId === source.id);
    const won = sourceLeads.filter((l) => l.stage === "won").length;
    const lost = sourceLeads.filter((l) => l.stage === "lost").length;
    const decided = won + lost;
    return {
      id: source.id,
      name: source.name,
      description: source.description,
      active: source.active,
      totalLeads: sourceLeads.length,
      openLeads: sourceLeads.filter(
        (l) => !["won", "lost"].includes(l.stage),
      ).length,
      won,
      lost,
      winRate: decided > 0 ? Math.round((won / decided) * 100) : 0,
      pipelineValue: sourceLeads
        .filter((l) => !["won", "lost"].includes(l.stage))
        .reduce((s, l) => s + l.budget, 0),
    };
  });

  // Sort by total leads desc — the source summary chips order.
  summary.sort((a, b) => b.totalLeads - a.totalLeads);

  return c.json({ success: true, data: summary });
  },
);

// POST /lead-sources — create a campaign source.
leadSourcesRouter.post(
  "/",
  requireRole("management"),
  async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<CreateSourceInput>()) as CreateSourceInput;

  if (!body.name?.trim()) {
    return c.json({ success: false, error: "name is required" }, 400);
  }

  const [dupe] = await db
    .select({ id: schema.leadSources.id })
    .from(schema.leadSources)
    .where(eq(schema.leadSources.name, body.name.trim()))
    .all();
  if (dupe) {
    return c.json(
      { success: false, error: "A source with this name already exists" },
      409,
    );
  }

  const source: schema.NewLeadSourceRow = {
    id: body.id ?? crypto.randomUUID(),
    name: body.name.trim(),
    description: body.description ?? null,
    active: body.active ?? true,
  };
  await db.insert(schema.leadSources).values(source).run();
  await logAudit(db, {
    actor: body.createdBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "lead_source.create",
    entityType: "lead_source",
    entityId: source.id,
    detail: `Lead source ${source.name} created`,
  });

  return c.json({ success: true, data: source }, 201);
  },
);

// PATCH /lead-sources/:id — update name/description/active.
leadSourcesRouter.patch("/:id", requireRole("management"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json<UpdateSourceInput>()) as UpdateSourceInput;

  const [existing] = await db
    .select()
    .from(schema.leadSources)
    .where(eq(schema.leadSources.id, id))
    .all();
  if (!existing) {
    return c.json({ success: false, error: "Source not found" }, 404);
  }

  const patch: Partial<schema.NewLeadSourceRow> = {};
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.description !== undefined) patch.description = body.description;
  if (body.active !== undefined) patch.active = body.active;

  await db
    .update(schema.leadSources)
    .set(patch)
    .where(eq(schema.leadSources.id, id))
    .run();
  await logAudit(db, {
    actor: body.updatedBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "lead_source.update",
    entityType: "lead_source",
    entityId: id,
    detail: `Lead source ${existing.name} updated`,
  });

  const [updated] = await db
    .select()
    .from(schema.leadSources)
    .where(eq(schema.leadSources.id, id))
    .all();
  return c.json({ success: true, data: updated });
});

// DELETE /lead-sources/:id — blocked when leads reference it.
leadSourcesRouter.delete("/:id", requireRole("management"), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(schema.leadSources)
    .where(eq(schema.leadSources.id, id))
    .all();
  if (!existing) {
    return c.json({ success: false, error: "Source not found" }, 404);
  }

  const referencing = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(eq(schema.leads.sourceId, id))
    .all();
  if (referencing.length > 0) {
    return c.json(
      {
        success: false,
        error: "Cannot delete a source referenced by existing leads — deactivate it instead",
      },
      409,
    );
  }

  await db.delete(schema.leadSources).where(eq(schema.leadSources.id, id)).run();
  await logAudit(db, {
    actor: c.req.query("by") ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "lead_source.delete",
    entityType: "lead_source",
    entityId: id,
    detail: `Lead source ${existing.name} deleted`,
  });

  return c.json({ success: true, data: { id } });
});

export default leadSourcesRouter;

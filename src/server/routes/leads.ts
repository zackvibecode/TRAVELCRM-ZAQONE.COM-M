import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { and, asc, desc, eq, gte, like, or } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { requireRole } from "../middleware/auth";
import { normalizePhone, whatsappLink } from "../lib/phone";
import { followupAccessRole } from "../lib/owned-lead";
import { firstFollowupAt } from "../lib/followup-schedule";
export type LeadsEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
  staff?: { id: string; name: string; email: string; role: string };
  lead?: schema.LeadRow;
};

const leadsRouter = new Hono<{
  Bindings: LeadsEnv;
  Variables: Variables;
}>();

/**
 * Ownership guard for every lead-scoped route: SALES may only touch their
 * own leads (owner_user_id), ADMIN (super_admin/management) passes, and
 * anything else — missing lead, other roles, someone else's lead — answers
 * a neutral 404 so data existence never leaks. Loads the lead into
 * c.var.lead for the handler.
 */
const ownedLead: MiddlewareHandler<{
  Bindings: LeadsEnv;
  Variables: Variables;
}> = async (c, next) => {
  const db = c.get("db");
  const id = c.req.param("id") ?? "";
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, id))
    .all();

  const staff = c.get("staff");
  const access = staff
    ? followupAccessRole(staff.role as Parameters<typeof followupAccessRole>[0])
    : null;
  const callerId = staff?.id ?? c.req.header("x-user-id");

  if (
    !lead ||
    access === null ||
    (access === "SALES" && lead.ownerUserId !== callerId)
  ) {
    return c.json({ success: false, error: "Lead not found" }, 404);
  }

  c.set("lead", lead);
  await next();
};

const LEAD_STAGES = [
  "new",
  "contacted",
  "qualified",
  "quotation",
  "won",
  "lost",
] as const;
type LeadStage = (typeof LEAD_STAGES)[number];

const ACTIVITY_TYPES = [
  "note",
  "call",
  "whatsapp",
  "email",
  "stage_change",
] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

interface CreateLeadInput {
  id?: string;
  name: string;
  phone: string;
  email?: string;
  destination?: string;
  pax?: number;
  budget?: number;
  stage?: LeadStage;
  sourceId?: string;
  assignedTo?: string;
  /** Optional explicit owner; defaults to the creating staff member. */
  ownerUserId?: string;
  nextFollowUp?: string;
  notes?: string;
  createdBy?: string;
}

interface UpdateLeadInput {
  name?: string;
  phone?: string;
  email?: string | null;
  destination?: string | null;
  pax?: number;
  budget?: number;
  stage?: LeadStage;
  sourceId?: string | null;
  assignedTo?: string | null;
  nextFollowUp?: string | null;
  notes?: string | null;
  updatedBy?: string;
}

function isLeadStage(value: unknown): value is LeadStage {
  return (
    typeof value === "string" && (LEAD_STAGES as readonly string[]).includes(value)
  );
}

// GET /leads — list with filters, search, pagination.
leadsRouter.get(
  "/",
  requireRole("sales", "management", "finance", "operations"),
  async (c) => {
  const db = c.get("db");

  const stage = c.req.query("stage");
  const sourceId = c.req.query("sourceId");
  const assignedTo = c.req.query("assignedTo");
  const q = c.req.query("q")?.trim();
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "50"), 1), 200);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

  const conditions = [];
  if (stage && isLeadStage(stage)) {
    conditions.push(eq(schema.leads.stage, stage));
  }
  if (sourceId) conditions.push(eq(schema.leads.sourceId, sourceId));
  if (assignedTo) conditions.push(eq(schema.leads.assignedTo, assignedTo));
  if (q) {
    conditions.push(
      or(
        like(schema.leads.name, `%${q}%`),
        like(schema.leads.phone, `%${q}%`),
        like(schema.leads.destination, `%${q}%`),
      )!,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Ownership filter: SALES only ever see their own leads in the list.
  const staff = c.get("staff");
  const access = staff
    ? followupAccessRole(staff.role as Parameters<typeof followupAccessRole>[0])
    : null;
  const ownerWhere =
    access === "SALES"
      ? where
        ? and(where, eq(schema.leads.ownerUserId, staff!.id))
        : eq(schema.leads.ownerUserId, staff!.id)
      : where;

  const [rows, total] = await Promise.all([
    db
      .select()
      .from(schema.leads)
      .where(ownerWhere)
      .orderBy(desc(schema.leads.lastActivityAt))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select({ count: schema.leads.id })
      .from(schema.leads)
      .where(ownerWhere)
      .all(),
  ]);

  return c.json({
    success: true,
    data: rows,
    pagination: {
      total: total.length,
      limit,
      offset,
    },
  });
});

// GET /leads/stages — stage constants for the frontend pipeline.
leadsRouter.get("/stages", (c) =>
  c.json({ success: true, data: LEAD_STAGES }),
);

// GET /leads/stats — pipeline summary KPIs.
leadsRouter.get(
  "/stats",
  requireRole("sales", "management", "finance"),
  async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(schema.leads).all();

  const total = rows.length;
  const pipelineValue = rows
    .filter((r) => !["won", "lost"].includes(r.stage))
    .reduce((s, r) => s + r.budget, 0);
  const won = rows.filter((r) => r.stage === "won").length;
  const lost = rows.filter((r) => r.stage === "lost").length;
  const decided = won + lost;
  const now = new Date().toISOString();
  const upcomingFollowUps = rows.filter(
    (r) => r.nextFollowUp && r.nextFollowUp >= now.slice(0, 10),
  ).length;

  return c.json({
    success: true,
    data: {
      total,
      pipelineValue,
      winRate: decided > 0 ? Math.round((won / decided) * 100) : 0,
      upcomingFollowUps,
    },
  });
});

// GET /leads/upcoming-follow-ups — reminder queue across agents.
leadsRouter.get(
  "/upcoming-follow-ups",
  requireRole("sales", "management"),
  async (c) => {
  const db = c.get("db");
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(schema.leads)
    .where(
      and(
        gte(schema.leads.nextFollowUp, today),
        or(
          eq(schema.leads.stage, "new"),
          eq(schema.leads.stage, "contacted"),
          eq(schema.leads.stage, "qualified"),
          eq(schema.leads.stage, "quotation"),
        )!,
      ),
    )
    .orderBy(asc(schema.leads.nextFollowUp))
    .limit(100)
    .all();

  return c.json({ success: true, data: rows });
});

// GET /leads/:id — single lead with activities and follow-ups.
leadsRouter.get(
  "/:id",
  requireRole("sales", "management", "finance", "operations"),
  ownedLead,
  async (c) => {
  const db = c.get("db");
  const lead = c.get("lead")!;
  const id = lead.id;

  const [activities, followUps] = await Promise.all([
    db
      .select()
      .from(schema.leadActivities)
      .where(eq(schema.leadActivities.leadId, id))
      .orderBy(desc(schema.leadActivities.at))
      .limit(100)
      .all(),
    db
      .select()
      .from(schema.leadFollowUps)
      .where(eq(schema.leadFollowUps.leadId, id))
      .orderBy(asc(schema.leadFollowUps.dueAt))
      .limit(50)
      .all(),
  ]);

  return c.json({
    success: true,
    data: {
      ...lead,
      whatsapp: whatsappLink(
        lead.phone,
        `Halo ${lead.name}, ini dari ZAQONE TRAVEL CRM.`,
      ),
      activities,
      followUps,
    },
  });
});

// POST /leads — create a new lead.
leadsRouter.post("/", requireRole("sales", "management"), async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<CreateLeadInput>()) as CreateLeadInput;
  const staff = c.get("staff");

  if (!body.name?.trim() || !body.phone?.trim()) {
    return c.json(
      { success: false, error: "name and phone are required" },
      400,
    );
  }
  if (body.stage && !isLeadStage(body.stage)) {
    return c.json({ success: false, error: "Invalid stage" }, 400);
  }

  const phone = normalizePhone(body.phone);
  if (!phone) {
    return c.json(
      { success: false, error: "phone must contain at least one digit" },
      400,
    );
  }

  // Mandatory owner: explicit body value wins, else the creating staff,
  // else assignedTo (admin creating on behalf of a salesperson).
  const ownerId =
    body.ownerUserId ??
    staff?.id ??
    body.assignedTo ??
    null;
  if (!ownerId) {
    return c.json(
      {
        success: false,
        error: "owner is required: sign in or pass ownerUserId",
      },
      400,
    );
  }

  const lead: schema.NewLeadRow = {
    id: body.id ?? crypto.randomUUID(),
    name: body.name.trim(),
    phone,
    email: body.email ?? null,
    destination: body.destination ?? null,
    pax: body.pax ?? 1,
    budget: body.budget ?? 0,
    stage: body.stage ?? "new",
    sourceId: body.sourceId ?? null,
    assignedTo: body.assignedTo ?? null,
    nextFollowUp: body.nextFollowUp ?? null,
    notes: body.notes ?? null,
    customerId: null,
    ownerUserId: ownerId,
    followupStatus: "new",
    followupState: "active",
    followupStage: "FU1",
    followupStageAt: new Date().toISOString(),
    // FU1 is scheduled from the admin-editable followup_stages config, snapped
    // to KL business hours (unless the caller pinned an exact time).
    nextFollowupAt:
      body.nextFollowUp ?? (await firstFollowupAt(db)).toISOString(),
  };

  await db.insert(schema.leads).values(lead).run();
  await logAudit(db, {
    actor: body.createdBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "lead.create",
    entityType: "lead",
    entityId: lead.id,
    detail: `Lead ${lead.name} created at stage ${lead.stage}`,
  });

  return c.json({ success: true, data: lead }, 201);
});

// PATCH /leads/:id — update lead fields (incl. assignment).
leadsRouter.patch(
  "/:id",
  requireRole("sales", "management"),
  ownedLead,
  async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const existing = c.get("lead")!;
  const body = (await c.req.json<UpdateLeadInput>()) as UpdateLeadInput;

  const patch: Partial<schema.NewLeadRow> = {
    updatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
  if (body.name !== undefined) patch.name = body.name.trim();
  if (body.phone !== undefined) patch.phone = body.phone.trim();
  if (body.email !== undefined) patch.email = body.email;
  if (body.destination !== undefined) patch.destination = body.destination;
  if (body.pax !== undefined) patch.pax = Math.max(1, body.pax);
  if (body.budget !== undefined) patch.budget = Math.max(0, body.budget);
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.nextFollowUp !== undefined) patch.nextFollowUp = body.nextFollowUp;
  if (body.sourceId !== undefined) patch.sourceId = body.sourceId;
  if (body.assignedTo !== undefined) patch.assignedTo = body.assignedTo;

  if (body.stage !== undefined) {
    if (!isLeadStage(body.stage)) {
      return c.json({ success: false, error: "Invalid stage" }, 400);
    }
    patch.stage = body.stage;
    patch.lastActivityAt = new Date().toISOString().replace("T", " ").slice(0, 19);
  }

  await db.update(schema.leads).set(patch).where(eq(schema.leads.id, id)).run();

  if (body.stage !== undefined && body.stage !== existing.stage) {
    await db.insert(schema.leadActivities).values({
      id: crypto.randomUUID(),
      leadId: id,
      type: "stage_change",
      text: `Stage: ${existing.stage} → ${body.stage}`,
      user: body.updatedBy ?? "system",
    }).run();
  }
  if (body.assignedTo !== undefined && body.assignedTo !== existing.assignedTo) {
    await logAudit(db, {
      actor: body.updatedBy ?? null,
      role: c.req.header("x-user-role") ?? null,
      action: "lead.assign",
      entityType: "lead",
      entityId: id,
      detail: `Lead ${existing.name} reassigned to ${body.assignedTo ?? "unassigned"}`,
    });
  }
  await logAudit(db, {
    actor: body.updatedBy ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "lead.update",
    entityType: "lead",
    entityId: id,
    detail: `Lead ${existing.name} updated`,
  });

  const [updated] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, id))
    .all();
  return c.json({ success: true, data: updated });
},
);

// POST /leads/:id/stage — dedicated stage transition endpoint.
leadsRouter.post(
  "/:id/stage",
  requireRole("sales", "management"),
  ownedLead,
  async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const existing = c.get("lead")!;
  const body = (await c.req.json<{ stage: LeadStage; by?: string }>());

  if (!isLeadStage(body.stage)) {
    return c.json({ success: false, error: "Invalid stage" }, 400);
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .update(schema.leads)
    .set({ stage: body.stage, lastActivityAt: now, updatedAt: now })
    .where(eq(schema.leads.id, id))
    .run();

  await db.insert(schema.leadActivities).values({
    id: crypto.randomUUID(),
    leadId: id,
    type: "stage_change",
    text: `Stage: ${existing.stage} → ${body.stage}`,
    user: body.by ?? "system",
  }).run();
  await logAudit(db, {
    actor: body.by ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "lead.stage_change",
    entityType: "lead",
    entityId: id,
    detail: `Stage ${existing.stage} → ${body.stage}`,
  });

  return c.json({ success: true, data: { id, stage: body.stage } });
});

// POST /leads/:id/activities — record a call/whatsapp/email/note.
leadsRouter.post(
  "/:id/activities",
  requireRole("sales", "management"),
  ownedLead,
  async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json<{
    type: ActivityType;
    text: string;
    user?: string;
  }>());

  if (!ACTIVITY_TYPES.includes(body.type) || body.type === "stage_change") {
    return c.json(
      { success: false, error: "Invalid activity type" },
      400,
    );
  }
  if (!body.text?.trim()) {
    return c.json({ success: false, error: "text is required" }, 400);
  }

  const activity: schema.NewLeadActivityRow = {
    id: crypto.randomUUID(),
    leadId: id,
    type: body.type,
    text: body.text.trim(),
    user: body.user ?? "system",
  };
  await db.insert(schema.leadActivities).values(activity).run();

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .update(schema.leads)
    .set({ lastActivityAt: now, updatedAt: now })
    .where(eq(schema.leads.id, id))
    .run();

  return c.json({ success: true, data: activity }, 201);
});

// GET /leads/:id/activities — list activity history.
leadsRouter.get(
  "/:id/activities",
  requireRole("sales", "management", "finance", "operations"),
  ownedLead,
  async (c) => {
  const db = c.get("db");
  const id = c.get("lead")!.id;

  const rows = await db
    .select()
    .from(schema.leadActivities)
    .where(eq(schema.leadActivities.leadId, id))
    .orderBy(desc(schema.leadActivities.at))
    .limit(100)
    .all();

  return c.json({ success: true, data: rows });
});

// Follow-up CRUD — scheduled reminders per lead.
leadsRouter.post(
  "/:id/follow-ups",
  requireRole("sales", "management"),
  ownedLead,
  async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json<{
    dueAt: string;
    channel?: "whatsapp" | "email" | "call" | "in_person";
    note?: string;
    createdBy?: string;
  }>());

  if (!body.dueAt) {
    return c.json({ success: false, error: "dueAt is required" }, 400);
  }

  const followUp: schema.NewLeadFollowUpRow = {
    id: crypto.randomUUID(),
    leadId: id,
    dueAt: body.dueAt,
    channel: body.channel ?? "whatsapp",
    note: body.note ?? null,
    createdBy: body.createdBy ?? "system",
  };
  await db.insert(schema.leadFollowUps).values(followUp).run();

  // Keep the lead's next follow-up pointer in sync (earliest open reminder).
  await db
    .update(schema.leads)
    .set({ nextFollowUp: body.dueAt })
    .where(eq(schema.leads.id, id))
    .run();

  return c.json({ success: true, data: followUp }, 201);
  },
);

leadsRouter.get(
  "/:id/follow-ups",
  requireRole("sales", "management", "finance", "operations"),
  ownedLead,
  async (c) => {
  const db = c.get("db");
  const id = c.get("lead")!.id;

  const rows = await db
    .select()
    .from(schema.leadFollowUps)
    .where(eq(schema.leadFollowUps.leadId, id))
    .orderBy(asc(schema.leadFollowUps.dueAt))
    .limit(50)
    .all();

  return c.json({ success: true, data: rows });
});

leadsRouter.post(
  "/follow-ups/:followUpId/complete",
  requireRole("sales", "management"),
  async (c) => {
  const db = c.get("db");
  const followUpId = c.req.param("followUpId");
  const body = (await c.req.json<{ doneBy?: string }>());

  const [existing] = await db
    .select()
    .from(schema.leadFollowUps)
    .where(eq(schema.leadFollowUps.id, followUpId))
    .all();
  if (!existing) {
    return c.json({ success: false, error: "Follow-up not found" }, 404);
  }

  // Ownership: the follow-up's parent lead must belong to the caller
  // (SALES) or the caller must be ADMIN — neutral 404 otherwise.
  const [parentLead] = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.id, existing.leadId))
    .all();
  const staff = c.get("staff");
  const access = staff
    ? followupAccessRole(staff.role as Parameters<typeof followupAccessRole>[0])
    : null;
  const callerId = staff?.id ?? c.req.header("x-user-id");
  if (
    !parentLead ||
    access === null ||
    (access === "SALES" && parentLead.ownerUserId !== callerId)
  ) {
    return c.json({ success: false, error: "Follow-up not found" }, 404);
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  await db
    .update(schema.leadFollowUps)
    .set({ done: true, doneAt: now, doneBy: body.doneBy ?? "system" })
    .where(eq(schema.leadFollowUps.id, followUpId))
    .run();

  return c.json({ success: true, data: { id: followUpId, done: true } });
  },
);

// DELETE /leads/:id — hard delete (audit logged). ADMIN-only route, still
// routed through ownedLead for the uniform 404 contract on missing leads.
leadsRouter.delete(
  "/:id",
  requireRole("management"),
  ownedLead,
  async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const existing = c.get("lead")!;

  await db.delete(schema.leads).where(eq(schema.leads.id, id)).run();
  await db
    .delete(schema.leadActivities)
    .where(eq(schema.leadActivities.leadId, id))
    .run();
  await db
    .delete(schema.leadFollowUps)
    .where(eq(schema.leadFollowUps.leadId, id))
    .run();
  await db
    .delete(schema.followupActivities)
    .where(eq(schema.followupActivities.leadId, id))
    .run();
  await db
    .delete(schema.customerNotes)
    .where(eq(schema.customerNotes.leadId, id))
    .run();
  await logAudit(db, {
    actor: c.req.query("by") ?? null,
    role: c.req.header("x-user-role") ?? null,
    action: "lead.delete",
    entityType: "lead",
    entityId: id,
    detail: `Lead ${existing.name} deleted`,
  });

  return c.json({ success: true, data: { id } });
},
);

export default leadsRouter;

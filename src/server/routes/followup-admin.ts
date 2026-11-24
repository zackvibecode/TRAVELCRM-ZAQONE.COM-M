import { Hono } from "hono";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireFollowupAdmin } from "../middleware/followup-admin";
import type { StaffIdentity } from "../lib/auth-context";
import { logAudit } from "../lib/audit";

export type AdminEnv = {
  Bindings: { DB: D1Database };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: StaffIdentity;
  };
};

const adminRouter = new Hono<AdminEnv>();

/**
 * /api/followup/admin — Admin Console API. ADMIN only (super_admin /
 * management); every other role gets 403 and anonymous gets 401.
 */
adminRouter.use("*", requireFollowupAdmin());

/** A stage rule as the console edits it. */
export interface StageRule {
  stage: "FU1" | "FU2" | "FU3";
  daysAfterPrevious: number;
  dueHourKL: number;
  active: boolean;
}

/** DB row → API shape. */
function toRule(row: schema.FollowupStageRow): StageRule {
  return {
    stage: row.code as StageRule["stage"],
    daysAfterPrevious: row.offsetDays,
    dueHourKL: row.dueHourKl,
    active: row.active,
  };
}

async function loadRules(db: DrizzleD1Database<typeof schema>): Promise<StageRule[]> {
  const rows = await db
    .select()
    .from(schema.followupStages)
    .orderBy(asc(schema.followupStages.order));
  return rows.map(toRule);
}

// ---------------------------------------------------------------------------
// Stage settings
// ---------------------------------------------------------------------------

/**
 * GET /api/followup/admin/stages — the follow-up schedule rules.
 */
adminRouter.get("/stages", async (c) => {
  const rules = await loadRules(c.get("db"));
  return c.json({ success: true, data: rules });
});

/**
 * PUT /api/followup/admin/stages — replace the full schedule.
 * Body: StageRule[] (all three stages, in order).
 * FU1 must stay active: without a first stage the engine never starts a
 * lead. Returns the saved rules.
 */
adminRouter.put("/stages", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  const body = (await c.req.json().catch(() => null)) as StageRule[] | null;
  if (!Array.isArray(body) || body.length !== 3) {
    return c.json({ success: false, error: "Provide all three stage rules" }, 400);
  }

  // Validate the whole payload before writing anything.
  for (const r of body) {
    if (!r || !["FU1", "FU2", "FU3"].includes(r.stage)) {
      return c.json({ success: false, error: "stage must be FU1, FU2 or FU3" }, 400);
    }
    if (!Number.isInteger(r.daysAfterPrevious) || r.daysAfterPrevious < 0 || r.daysAfterPrevious > 90) {
      return c.json({ success: false, error: `${r.stage}: daysAfterPrevious must be 0-90` }, 400);
    }
    if (!Number.isInteger(r.dueHourKL) || r.dueHourKL < 0 || r.dueHourKL > 23) {
      return c.json({ success: false, error: `${r.stage}: dueHourKL must be 0-23` }, 400);
    }
    if (typeof r.active !== "boolean") {
      return c.json({ success: false, error: `${r.stage}: active must be a boolean` }, 400);
    }
  }
  const codes = new Set(body.map((r) => r.stage));
  if (codes.size !== 3) {
    return c.json({ success: false, error: "Each of FU1, FU2, FU3 must appear exactly once" }, 400);
  }
  if (!body.find((r) => r.stage === "FU1")!.active) {
    return c.json({ success: false, error: "FU1 must stay active — it is the entry stage" }, 400);
  }

  const now = new Date().toISOString();
  for (const r of body) {
    await db
      .update(schema.followupStages)
      .set({ offsetDays: r.daysAfterPrevious, dueHourKl: r.dueHourKL, active: r.active, updatedAt: now })
      .where(eq(schema.followupStages.code, r.stage));
  }

  await logAudit(db, {
    action: "followup_stage.update",
    entityType: "followup_stage",
    entityId: "FU1-FU3",
    actor: staff.email,
    role: staff.role,
    detail: JSON.stringify(body),
  });

  return c.json({ success: true, data: await loadRules(db) });
});

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

/** A staff account as the console lists it. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "management" | "sales" | "finance" | "operations";
  active: boolean;
  /** Leads currently assigned to this user in an open follow-up state. */
  openLeads: number;
}

const CRM_ROLES = ["super_admin", "management", "sales"] as const;
type CrmRole = (typeof CRM_ROLES)[number];

/**
 * GET /api/followup/admin/users — staff accounts with their CRM role and
 * open-lead count. Only CRM roles are listed (finance/operations are not
 * part of the follow-up CRM).
 */
adminRouter.get("/users", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      status: schema.user.status,
    })
    .from(schema.user)
    .orderBy(asc(schema.user.name));

  const openCounts = await db
    .select({
      owner: schema.leads.ownerUserId,
      n: sql<number>`count(*)`,
    })
    .from(schema.leads)
    .where(eq(schema.leads.followupState, "active"))
    .groupBy(schema.leads.ownerUserId);
  const openByOwner = new Map(openCounts.map((r) => [r.owner, Number(r.n)]));

  const users: AdminUser[] = rows
    .filter((r): r is typeof r & { role: CrmRole } => (CRM_ROLES as readonly string[]).includes(r.role))
    .map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      active: r.status === "active",
      openLeads: openByOwner.get(r.id) ?? 0,
    }));

  return c.json({ success: true, data: users });
});

/**
 * PATCH /api/followup/admin/users/:id — change a user's CRM role and/or
 * active status. Body: { role?: "super_admin"|"management"|"sales", active?: boolean }
 *
 * Safeguard: the last active super_admin cannot be demoted or deactivated,
 * otherwise nobody could reach the admin console anymore.
 */
adminRouter.patch("/users/:id", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const targetId = c.req.param("id");

  const body = (await c.req.json().catch(() => ({}))) as { role?: string; active?: boolean };
  if (body.role === undefined && body.active === undefined) {
    return c.json({ success: false, error: "Provide role and/or active" }, 400);
  }
  if (body.role !== undefined && !(CRM_ROLES as readonly string[]).includes(body.role)) {
    return c.json({ success: false, error: "role must be super_admin, management or sales" }, 400);
  }

  const [target] = await db
    .select({ id: schema.user.id, role: schema.user.role, status: schema.user.status })
    .from(schema.user)
    .where(eq(schema.user.id, targetId))
    .limit(1);
  if (!target) {
    return c.json({ success: false, error: "not_found" }, 404);
  }

  const nextRole = (body.role as CrmRole | undefined) ?? target.role;
  const nextActive = body.active ?? target.status === "active";

  // Last-active-super-admin protection.
  if (target.role === "super_admin" && target.status === "active") {
    const losesAdmin = nextRole !== "super_admin" || !nextActive;
    if (losesAdmin) {
      const [adminCount] = await db
        .select({ n: sql<number>`count(*)` })
        .from(schema.user)
        .where(and(eq(schema.user.role, "super_admin"), eq(schema.user.status, "active")));
      if (Number(adminCount.n) <= 1) {
        return c.json(
          { success: false, error: "Cannot remove the last active super admin" },
          409,
        );
      }
    }
  }

  await db
    .update(schema.user)
    .set({
      ...(body.role !== undefined ? { role: nextRole } : {}),
      ...(body.active !== undefined ? { status: nextActive ? "active" : "suspended" } : {}),
    })
    .where(eq(schema.user.id, targetId));

  await logAudit(db, {
    action: "followup_user.role_update",
    entityType: "user",
    entityId: targetId,
    actor: staff.email,
    role: staff.role,
    detail: JSON.stringify({ role: nextRole, active: nextActive }),
  });

  return c.json({
    success: true,
    data: { id: targetId, role: nextRole, active: nextActive },
  });
});

// ---------------------------------------------------------------------------
// Team import monitoring
// ---------------------------------------------------------------------------

/** One import batch as the admin console lists it. */
export interface AdminImportBatch {
  id: string;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  failedRows: number;
  createdAt: string;
  /** Who ran the import. */
  createdBy: string;
  createdByName: string;
  /** Rejected rows, newest batch first, rows in file order. */
  errors: { id: string; rowNumber: number; reason: string; raw: Record<string, unknown> }[];
}

function safeParse(raw: string | null): Record<string, unknown> {
  try {
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * GET /api/followup/admin/imports — every import batch across all sales
 * users, with the importer's display name and the rejected rows.
 * Query params:
 *   status — all | ok | partial | failed (default all)
 *            ok = no failed rows, partial = some failed, failed = none inserted
 *   limit  — 1..200 (default 50)
 */
adminRouter.get("/imports", async (c) => {
  const db = c.get("db");
  const status = (c.req.query("status") ?? "all").trim();
  const limit = Math.min(Math.max(Number.parseInt(c.req.query("limit") ?? "50", 10) || 50, 1), 200);

  const batches = await db
    .select()
    .from(schema.importBatches)
    .orderBy(desc(schema.importBatches.createdAt))
    .limit(limit);

  if (batches.length === 0) {
    return c.json({ success: true, data: [] });
  }

  // Importer names in one query (avoids N+1).
  const userIds = [...new Set(batches.map((b) => b.createdBy))];
  const users = await db
    .select({ id: schema.user.id, name: schema.user.name })
    .from(schema.user)
    .where(inArray(schema.user.id, userIds));
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  // Error rows for all listed batches in one query.
  const errors = await db
    .select()
    .from(schema.importErrors)
    .where(
      inArray(
        schema.importErrors.batchId,
        batches.map((b) => b.id),
      ),
    )
    .orderBy(asc(schema.importErrors.rowNumber));
  const errorsByBatch = new Map<string, typeof errors>();
  for (const e of errors) {
    const list = errorsByBatch.get(e.batchId) ?? [];
    list.push(e);
    errorsByBatch.set(e.batchId, list);
  }

  const out: AdminImportBatch[] = batches.map((b) => ({
    id: b.id,
    fileName: b.fileName,
    totalRows: b.totalRows,
    insertedRows: b.insertedRows,
    duplicateRows: b.duplicateRows,
    failedRows: b.failedRows,
    createdAt: b.createdAt,
    createdBy: b.createdBy,
    createdByName: nameById.get(b.createdBy) ?? b.createdBy,
    errors: (errorsByBatch.get(b.id) ?? []).map((e) => ({
      id: e.id,
      rowNumber: e.rowNumber,
      reason: e.reason,
      raw: safeParse(e.rawData),
    })),
  }));

  const filtered =
    status === "ok"
      ? out.filter((b) => b.failedRows === 0)
      : status === "partial"
        ? out.filter((b) => b.failedRows > 0 && b.insertedRows > 0)
        : status === "failed"
          ? out.filter((b) => b.insertedRows === 0)
          : out;

  return c.json({ success: true, data: filtered });
});

export default adminRouter;

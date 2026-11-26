import { Hono } from "hono";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireStaffSession } from "../middleware/auth";
import type { StaffIdentity } from "../lib/auth-context";
import { requireOwnedLead, followupAccessRole } from "../lib/owned-lead";
import { firstFollowupAt, nextStageFollowupAt, nextStageOf } from "../lib/followup-schedule";
import { klTodayWindow, klWindow, KL_TIMEZONE } from "../lib/kl-time";
import { parseOwnerFilter, parsePeriodParam, periodRangeKL, previousRangeKL } from "../lib/dashboard-filter";
import { pipelineSummary } from "../lib/pipeline-summary";
import { salesScores, teamTotals, dailyTrend } from "../lib/leaderboard-stats";
import { logAudit } from "../lib/audit";
import {
  parseCsvText,
  autoMapColumns,
  applyMappingValidate,
  validateMapping,
  normalizeMyPhone,
  type ImportColumnRole,
} from "../lib/import-parse";

export type FollowupEnv = {
  Bindings: { DB: D1Database };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: StaffIdentity;
  };
};

const followupRouter = new Hono<FollowupEnv>();

/**
 * Domain /api/followup/* — the WhatsApp Follow-Up CRM backend.
 * Every lead-scoped handler goes through requireOwnedLead() which answers
 * 404 (not 403) for leads the caller does not own, so data existence
 * never leaks.
 */
followupRouter.use("*", requireStaffSession);

// ---------------------------------------------------------------------------
// Lead endpoints (ownership-guarded)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Identity & access mapping
// ---------------------------------------------------------------------------

/**
 * GET /api/followup/me — resolves the caller's CRM access role
 * (super_admin/management → ADMIN, sales → SALES) plus display info.
 * The frontend uses this as the single source of truth for ownership rules.
 */
followupRouter.get("/me", async (c) => {
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);

  if (!access) {
    // Roles outside the follow-up CRM see a neutral 404, same contract
    // as lead access — existence of CRM data never leaks.
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  return c.json({
    success: true,
    data: {
      access,
      staff: { id: staff.id, name: staff.name, email: staff.email, role: staff.role },
    },
  });
});

/**
 * GET /api/followup/me/summary — the signed-in rep's personal pipeline
 * (My Pipeline cards): lead counts per pipeline stage plus the two action
 * queues (due today / overdue) measured on the KL day. ADMIN may pass
 * ?owner=<userId> to view another rep's summary; SALES are always self.
 */
followupRouter.get("/me/summary", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const scope = parseOwnerFilter(c.req.query("owner"), access, staff.id);
  const ownerUserId = scope.ownerUserId ?? staff.id;

  const summary = await pipelineSummary(db, ownerUserId);
  const { startMs, endMs } = klTodayWindow();

  return c.json({
    success: true,
    data: {
      ...summary,
      ownerUserId,
      /** KL day boundary the due-today / overdue split is measured on. */
      window: { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() },
      timezone: KL_TIMEZONE,
    },
  });
});

/**
 * GET /api/followup/leaderboard — team ranking by UNIQUE follow-up activity.
 * Query params:
 *   period — week | month | all (default month; KL calendar windows)
 *   owner  — ADMIN may narrow to one rep; SALES are always scoped to self.
 * Returns per-rep scores (completed / uniqueLeads / activeDays / won), the
 * team totals for the summary cards, the KL window used, and the previous
 * period totals for the period-over-period comparison.
 */
followupRouter.get("/leaderboard", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const period = parsePeriodParam(c.req.query("period"));
  // Leaderboard is team-wide for everyone: SALES may pass any owner to inspect
  // a colleague, ADMIN keeps the team view. No owner filter pins the caller.
  const requestedOwner = (c.req.query("owner") ?? "").trim();
  const scope = requestedOwner && requestedOwner.toLowerCase() !== "all"
    ? { scoped: true, ownerUserId: requestedOwner }
    : { scoped: false, ownerUserId: null };
  const range = periodRangeKL(period);
  const prevRange = previousRangeKL(period);

  // Current + previous period run in parallel; both are index-bounded.
  const [scores, previousScores] = await Promise.all([
    salesScores(db, range, scope),
    prevRange ? salesScores(db, prevRange, scope) : Promise.resolve([]),
  ]);
  const totals = teamTotals(scores);
  const previous = prevRange ? teamTotals(previousScores) : null;

  // Rank by confirmed follow-up volume (FU1+FU2+FU3), then unique leads, then
  // deals won. No composite score — the board answers "who followed up most".
  const ranked = scores
    .sort((a, b) => b.completed - a.completed || b.uniqueLeads - a.uniqueLeads || b.won - a.won)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  return c.json({
    success: true,
    data: {
      period,
      scores: ranked,
      totals,
      previous,
      /** KL calendar windows (ISO instants); `to` is exclusive. */
      window: range ? { from: range.fromIso, to: range.toIso } : null,
      previousWindow: prevRange ? { from: prevRange.fromIso, to: prevRange.toIso } : null,
      /** Today's KL day, so the client can label "so far" periods. */
      today: klWindow(),
      timezone: KL_TIMEZONE,
      scope: { scoped: scope.scoped, ownerUserId: scope.ownerUserId },
    },
  });
});

/**
 * GET /api/followup/leaderboard/trend — daily confirmed follow-ups and
 * unique leads for the last `days` KL days (default 7, max 90). Honours the
 * same period/owner params as /leaderboard for consistency.
 */
followupRouter.get("/leaderboard/trend", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const days = Math.min(Math.max(Number.parseInt(c.req.query("days") ?? "7", 10) || 7, 1), 90);
  const scope = parseOwnerFilter(c.req.query("owner"), access, staff.id);
  const trend = await dailyTrend(db, days, scope);

  return c.json({
    success: true,
    data: {
      days,
      trend,
      /** Bucket `date` values are KL calendar dates (yyyy-MM-dd). */
      timezone: KL_TIMEZONE,
      window: { from: trend[0]?.date ?? null, to: trend[trend.length - 1]?.date ?? null },
      scope: { scoped: scope.scoped, ownerUserId: scope.ownerUserId },
    },
  });
});

// ---------------------------------------------------------------------------
// Task list endpoints (Follow-Up Center)
// ---------------------------------------------------------------------------

/**
 * GET /api/followup/today — leads whose next_followup_at falls due today
 * (Asia/Kuala_Lumpur working day), oldest schedule first.
 * SALES see only their own leads; ADMIN sees all.
 */
followupRouter.get("/today", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);

  const { startMs, endMs } = klTodayWindow();

  const conditions = [
    isNotNull(schema.leads.nextFollowupAt),
    // Due today or earlier (overdue leads are still today's work — they
    // must not disappear from the sales queue until completed).
  ];
  if (access === "SALES") {
    conditions.push(eq(schema.leads.ownerUserId, staff.id));
  }

  // Active sequences only — paused/done/escalated leads leave the queue.
  if (access === "SALES" || access === "ADMIN") {
    conditions.push(eq(schema.leads.followupState, "active"));
  }

  const rows = await db
    .select()
    .from(schema.leads)
    .where(and(...conditions))
    .orderBy(asc(schema.leads.nextFollowupAt))
    .all();

  // Window filtering after fetch: nextFollowupAt is a text column holding
  // ISO-ish strings; compare as instants, then split today vs overdue.
  const due = rows.filter((r) => {
    const t = r.nextFollowupAt ? Date.parse(r.nextFollowupAt) : NaN;
    return !Number.isNaN(t) && t < endMs;
  });

  const today = due.filter((r) => {
    const t = Date.parse(r.nextFollowupAt!);
    return t >= startMs;
  });
  const overdue = due.filter((r) => {
    const t = Date.parse(r.nextFollowupAt!);
    return t < startMs;
  });

  return c.json({
    success: true,
    data: {
      today,
      overdue,
      /** KL day boundary used for the split, for client display. */
      window: klWindow(),
      timezone: KL_TIMEZONE,
    },
  });
});

/**
 * GET /api/followup/overdue — the overdue queue: active follow-ups whose
 * nextFollowupAt is before the start of today (KL), grouped by how many
 * days late they are (mirrors the frontend day-bucket panel).
 */
followupRouter.get("/overdue", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);

  const { startMs } = klTodayWindow();
  const startIso = new Date(startMs).toISOString();

  const conditions = [
    isNotNull(schema.leads.nextFollowupAt),
    eq(schema.leads.followupState, "active"),
  ];
  if (access === "SALES") {
    conditions.push(eq(schema.leads.ownerUserId, staff.id));
  }

  const rows = await db
    .select()
    .from(schema.leads)
    .where(and(...conditions))
    .orderBy(asc(schema.leads.nextFollowupAt))
    .all();

  // Keep only past-schedule rows, then bucket by whole days late (KL).
  const buckets = new Map<number, schema.LeadRow[]>();
  for (const row of rows) {
    const t = row.nextFollowupAt ? Date.parse(row.nextFollowupAt) : NaN;
    if (Number.isNaN(t) || t >= startMs) continue;
    const daysLate = Math.floor((startMs - t) / 86_400_000);
    const list = buckets.get(daysLate) ?? [];
    list.push(row);
    buckets.set(daysLate, list);
  }

  // Oldest (most days late) bucket first, leads chronological inside.
  const queue = [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([daysLate, leads]) => ({
      daysLate,
      count: leads.length,
      leads,
    }));

  return c.json({
    success: true,
    data: {
      queue,
      totalOverdue: queue.reduce((s, b) => s + b.count, 0),
      /** Start of today KL — the boundary the queue is measured against. */
      boundary: startIso,
      /** KL day window + timezone, for consistent client-side labelling. */
      window: klWindow(),
      timezone: KL_TIMEZONE,
    },
  });
});

/** GET /api/followup/leads — list leads visible to the caller. */
/**
 * GET /api/followup/leads — multi-column search + combined filters.
 * Query params:
 *   q      — free text across name, phone, phone_normalized, destination
 *   status — followup_status exact match
 *   owner  — owner_user_id exact match (ADMIN only; SALES are always scoped
 *            to themselves regardless of this param)
 *   stage  — legacy stage column exact match
 *   limit  — page size (default 50, max 200)
 *   offset — page offset (default 0)
 * SALES always see only their own leads; ADMIN sees all (optionally narrowed
 * by owner).
 */
followupRouter.get("/leads", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const q = (c.req.query("q") ?? "").trim();
  const status = (c.req.query("status") ?? "").trim();
  const owner = (c.req.query("owner") ?? "").trim();
  const stage = (c.req.query("stage") ?? "").trim();
  // Engine stage filter (FU1/FU2/FU3) — distinct from `stage`, which is the
  // sales-pipeline stage (new/contacted/qualified/…).
  const fu = (c.req.query("fu") ?? "").trim();
  const state = (c.req.query("state") ?? "").trim();
  const limit = Math.min(
    Math.max(Number.parseInt(c.req.query("limit") ?? "50", 10) || 50, 1),
    200,
  );
  const offset = Math.max(Number.parseInt(c.req.query("offset") ?? "0", 10) || 0, 0);

  const conditions = [];
  // Ownership scope first: SALES only ever see their own leads.
  if (access === "SALES") {
    conditions.push(eq(schema.leads.ownerUserId, staff.id));
  } else if (owner !== "") {
    conditions.push(eq(schema.leads.ownerUserId, owner));
  }

  // Multi-column free-text search: name, phone, normalized phone, destination.
  if (q !== "") {
    const like = `%${q.toLowerCase()}%`;
    conditions.push(
      or(
        likeLower(schema.leads.name, like),
        likeLower(schema.leads.phone, like),
        likeLower(schema.leads.phoneNormalized, like),
        likeLower(schema.leads.destination, like),
      )!,
    );
  }
  if (status !== "") {
    conditions.push(eq(schema.leads.followupStatus, status as "new" | "responded" | "won" | "lost" | "paused"));
  }
  if (stage !== "") {
    conditions.push(eq(schema.leads.stage, stage as "new" | "contacted" | "qualified" | "quotation" | "won" | "lost"));
  }
  if (fu !== "") {
    conditions.push(
      eq(schema.leads.followupStage, fu as "FU1" | "FU2" | "FU3"),
    );
  }
  if (state !== "") {
    conditions.push(
      eq(schema.leads.followupState, state as "active" | "paused" | "done" | "escalated"),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(schema.leads)
    .where(where)
    .orderBy(desc(schema.leads.updatedAt))
    .limit(limit)
    .offset(offset)
    .all();

  // Total matching the same filters (for "select all" bulk flows) — one
  // cheap count query kept separate from the page of rows.
  const [totalRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.leads)
    .where(where);

  return c.json({ success: true, data: rows, paging: { limit, offset, count: rows.length, total: Number(totalRow?.n ?? rows.length) } });
});

/**
 * GET /api/followup/leads/all-ids — every visible lead id matching the same
 * filters as GET /leads, capped at 5000. Powers the "select all" checkbox in
 * the lead list so bulk actions can target more than the current page.
 */
followupRouter.get("/leads/all-ids", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const q = (c.req.query("q") ?? "").trim();
  const status = (c.req.query("status") ?? "").trim();
  const owner = (c.req.query("owner") ?? "").trim();
  const stage = (c.req.query("stage") ?? "").trim();
  const fu = (c.req.query("fu") ?? "").trim();
  const state = (c.req.query("state") ?? "").trim();

  const conditions = [];
  if (access === "SALES") {
    conditions.push(eq(schema.leads.ownerUserId, staff.id));
  } else if (owner !== "") {
    conditions.push(eq(schema.leads.ownerUserId, owner));
  }
  if (q !== "") {
    const like = `%${q.toLowerCase()}%`;
    conditions.push(
      or(
        likeLower(schema.leads.name, like),
        likeLower(schema.leads.phone, like),
        likeLower(schema.leads.phoneNormalized, like),
        likeLower(schema.leads.destination, like),
      )!,
    );
  }
  if (status !== "") {
    conditions.push(eq(schema.leads.followupStatus, status as "new" | "responded" | "won" | "lost" | "paused"));
  }
  if (stage !== "") {
    conditions.push(eq(schema.leads.stage, stage as "new" | "contacted" | "qualified" | "quotation" | "won" | "lost"));
  }
  if (fu !== "") {
    conditions.push(eq(schema.leads.followupStage, fu as "FU1" | "FU2" | "FU3"));
  }
  if (state !== "") {
    conditions.push(eq(schema.leads.followupState, state as "active" | "paused" | "done" | "escalated"));
  }

  const ids = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.leads.updatedAt))
    .limit(50000)
    .all();

  return c.json({ success: true, data: ids.map((r) => r.id), count: ids.length });
});

/** Case-insensitive LIKE helper (SQLite lower() only handles ASCII). */
function likeLower(column: AnySQLiteColumn, pattern: string) {
  return sql`lower(coalesce(${column}, '')) like ${pattern}`;
}

/**
 * GET /api/followup/leads/facets — combined-filter counts. Returns, within
 * the caller's visible scope (SALES = own leads, ADMIN = all or ?owner=…):
 *   total          — total visible leads
 *   byFollowupStatus — count per followup_status value
 *   byStage        — count per legacy stage value
 *   byOwner        — count + display name per owner (ADMIN view)
 * Mirrors the filters accepted by GET /leads so chips/metrics and result
 * rows always agree.
 */
followupRouter.get("/leads/facets", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const owner = (c.req.query("owner") ?? "").trim();
  const scope =
    access === "SALES"
      ? eq(schema.leads.ownerUserId, staff.id)
      : owner !== ""
        ? eq(schema.leads.ownerUserId, owner)
        : undefined;

  const rows = await db
    .select({
      followupStatus: schema.leads.followupStatus,
      stage: schema.leads.stage,
      ownerUserId: schema.leads.ownerUserId,
    })
    .from(schema.leads)
    .where(scope)
    .all();

  // Owner display names for ADMIN (single small query, SALES scope has one owner).
  const ownerNames = new Map<string, string>();
  if (access === "ADMIN") {
    const users = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .all();
    for (const u of users) ownerNames.set(u.id, u.name);
  }

  const byFollowupStatus: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const byOwner: Record<string, { count: number; name: string }> = {};
  for (const row of rows) {
    const fs = row.followupStatus ?? "new";
    byFollowupStatus[fs] = (byFollowupStatus[fs] ?? 0) + 1;
    const st = row.stage ?? "new";
    byStage[st] = (byStage[st] ?? 0) + 1;
    const own = row.ownerUserId;
    const entry = byOwner[own] ?? { count: 0, name: ownerNames.get(own) ?? own };
    entry.count += 1;
    byOwner[own] = entry;
  }

  return c.json({
    success: true,
    data: {
      total: rows.length,
      byFollowupStatus,
      byStage,
      byOwner,
    },
  });
});

/** GET /api/followup/report/fu — confirmed follow-ups completed per stage per staff. */
followupRouter.get("/report/fu", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const scope =
    access === "SALES"
      ? eq(schema.followupActivities.user, staff.id)
      : undefined;

  const rows = await db
    .select({
      stage: schema.followupActivities.stage,
      user: schema.followupActivities.user,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(schema.followupActivities)
    .where(and(eq(schema.followupActivities.confirmed, true), scope))
    .groupBy(schema.followupActivities.stage, schema.followupActivities.user)
    .all();

  const userIds = [...new Set(rows.map((r) => r.user))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const users = await db
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(inArray(schema.user.id, userIds))
      .all();
    for (const u of users) names.set(u.id, u.name);
  }

  return c.json({
    success: true,
    data: rows.map((r) => ({
      userId: r.user,
      name: names.get(r.user) ?? r.user,
      stage: r.stage,
      count: r.count,
    })),
  });
});

/** GET /api/followup/leads/:id — ownership-guarded detail (404 contract). */
followupRouter.get("/leads/:id", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  const result = await requireOwnedLead(db, c.req.param("id"), staff);
  if (!result.ok) return result.response;

  // Activity history and customer notes for the detail panel.
  const [activities, notes] = await Promise.all([
    db
      .select()
      .from(schema.followupActivities)
      .where(eq(schema.followupActivities.leadId, result.lead.id))
      .orderBy(desc(schema.followupActivities.at))
      .all(),
    db
      .select()
      .from(schema.customerNotes)
      .where(eq(schema.customerNotes.leadId, result.lead.id))
      .orderBy(desc(schema.customerNotes.createdAt))
      .all(),
  ]);

  return c.json({
    success: true,
    data: { lead: result.lead, activities, notes },
  });
});

// ---------------------------------------------------------------------------
// Quick-action endpoints (guarded by requireOwnedLead — 404 contract)
// ---------------------------------------------------------------------------

/** Advances FU1→FU2→FU3; after FU3 the lead is escalated for admin review. */
followupRouter.post("/leads/:id/complete", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  const result = await requireOwnedLead(db, c.req.param("id"), staff);
  if (!result.ok) return result.response;
  const lead = result.lead;

  const body = (await c.req.json().catch(() => ({}))) as { note?: string };

  // A closed-out sequence can no longer be advanced: "done" leads are won /
  // lost, and "escalated" leads await admin review. Completing either would
  // rewrite escalatedAt and erase the audit trail.
  if (lead.followupState === "done" || lead.followupState === "escalated") {
    return c.json(
      {
        error: "conflict",
        message:
          lead.followupState === "escalated"
            ? "Lead is awaiting admin review and cannot be advanced"
            : "Follow-up sequence is already closed",
      },
      { status: 409 },
    );
  }

  // Current stage comes from the lead row, which the engine keeps in sync
  // with confirmed activities only. (Deriving it from every activity row
  // would let an unconfirmed `stage_change` entry skip a stage.)
  const currentStage: "FU1" | "FU2" | "FU3" = lead.followupStage ?? "FU1";

  const now = new Date().toISOString();

  // Record the manual confirmation for this stage. The (lead, stage) slot
  // may already hold the unconfirmed `stage_change` row written when the
  // previous stage advanced — the confirmation must REPLACE it, otherwise
  // the unique index would silently drop the confirmation and the history
  // would lose the proof that FU2/FU3 were manually confirmed.
  await db
    .insert(schema.followupActivities)
    .values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      stage: currentStage,
      type: "whatsapp",
      text: body.note?.trim() || `Follow-up ${currentStage} completed (manual confirmation).`,
      confirmed: true,
      user: staff.id,
      at: now,
    })
    .onConflictDoUpdate({
      target: [
        schema.followupActivities.leadId,
        schema.followupActivities.stage,
      ],
      set: {
        type: "whatsapp",
        text: body.note?.trim() || `Follow-up ${currentStage} completed (manual confirmation).`,
        confirmed: true,
        user: staff.id,
        at: now,
      },
      // Only override a row that has not been confirmed yet; a previously
      // confirmed stage is never rewritten by a duplicate request.
      where: eq(schema.followupActivities.confirmed, false),
    });

  if (currentStage === "FU3") {
    // Escalation after FU3 — flagged for admin review, sequence leaves queue.
    await db
      .update(schema.leads)
      .set({
        followupState: "escalated",
        followupStage: currentStage,
        followupStageAt: now,
        escalatedAt: now,
        lastContactedAt: now,
        nextFollowupAt: null,
        updatedAt: now,
      })
      .where(eq(schema.leads.id, lead.id));

    // Free-form timeline entry: the escalation itself is a review marker,
    // not a stage confirmation, so it goes to lead_activities (the FU3
    // confirmation above already holds the per-stage slot).
    await db.insert(schema.leadActivities).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      type: "escalation",
      text: "All 3 follow-up stages completed without a response — escalated for admin review.",
      user: staff.id,
      at: now,
    });
  } else {
    // Schedule the next stage `offset_days(next)` after this confirmation,
    // reading the gap from the admin-editable followup_stages config.
    const nextStage = nextStageOf(currentStage);
    if (!nextStage) {
      // Defensive: currentStage is validated above, but never advance past FU3.
      return c.json({ error: "bad_request", message: "Sequence already complete" }, { status: 400 });
    }
    const nextAtDate = await nextStageFollowupAt(db, nextStage);
    const nextAt = nextAtDate.toISOString();

    // Advance the denormalised stage so per-stage queries stay accurate.
    await db
      .update(schema.leads)
      .set({
        followupStage: nextStage,
        followupStageAt: now,
        lastContactedAt: now,
        nextFollowupAt: nextAt,
        updatedAt: now,
      })
      .where(eq(schema.leads.id, lead.id));

    await db
      .insert(schema.followupActivities)
      .values({
        id: crypto.randomUUID(),
        leadId: lead.id,
        stage: nextStage,
        type: "stage_change",
        text: `Scheduled to the next stage.`,
        confirmed: false,
        user: staff.id,
        at: now,
      })
      .onConflictDoNothing({
        target: [
          schema.followupActivities.leadId,
          schema.followupActivities.stage,
        ],
      });
  }

  await logAudit(db, {
    action: `followup.${currentStage}.complete`,
    entityType: "lead",
    entityId: lead.id,
    actor: staff.email,
    role: staff.role,
  });

  return c.json({ success: true, data: { leadId: lead.id, stage: currentStage } });
});

/** POST /api/followup/leads/:id/postpone — push nextFollowupAt by hours. */
followupRouter.post("/leads/:id/postpone", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  const result = await requireOwnedLead(db, c.req.param("id"), staff);
  if (!result.ok) return result.response;
  const lead = result.lead;

  const body = (await c.req.json().catch(() => ({}))) as { hours?: number };
  const hours = Math.min(Math.max(Number(body.hours ?? 4), 1), 24 * 30);
  if (Number.isNaN(hours)) {
    return c.json({ success: false, error: "hours must be a number" }, 400);
  }

  const now = new Date().toISOString();
  const base = lead.nextFollowupAt && !Number.isNaN(Date.parse(lead.nextFollowupAt))
    ? Date.parse(lead.nextFollowupAt)
    : Date.now();
  const nextAt = new Date(Math.max(base, Date.now()) + hours * 3_600_000).toISOString();

  await db
    .update(schema.leads)
    .set({ nextFollowupAt: nextAt, updatedAt: now })
    .where(eq(schema.leads.id, lead.id));

  // Record the postponement in the lead's free-form activity timeline so
  // the history shows why a follow-up moved. It is bookkeeping, not a stage
  // confirmation, so it does not use the per-stage followup slot.
  await db.insert(schema.leadActivities).values({
    id: crypto.randomUUID(),
    leadId: lead.id,
    type: "postpone",
    text: `Follow-up postponed by ${hours}h.`,
    user: staff.id,
    at: now,
  });

  await logAudit(db, {
    action: "followup.postpone",
    entityType: "lead",
    entityId: lead.id,
    actor: staff.email,
    role: staff.role,
    detail: `+${hours}h`,
  });

  return c.json({ success: true, data: { leadId: lead.id, nextFollowupAt: nextAt } });
});

/** POST /api/followup/leads/:id/pause — pause/resume the sequence. */
followupRouter.post("/leads/:id/pause", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  const result = await requireOwnedLead(db, c.req.param("id"), staff);
  if (!result.ok) return result.response;
  const lead = result.lead;

  const now = new Date().toISOString();
  const pausing = lead.followupState !== "paused";

  // When RESUMING, a schedule left in the past (typical for an auto-paused
  // lead) would instantly read as overdue and get auto-paused again on the
  // next cron run. Re-schedule it into the future in that case.
  const nowMs = Date.now();
  const scheduleIsPast =
    !!lead.nextFollowupAt && Date.parse(lead.nextFollowupAt) <= nowMs;
  const resumedAt = !pausing && scheduleIsPast
    ? (await nextStageFollowupAt(db, lead.followupStage ?? "FU1", nowMs)).toISOString()
    : null;

  await db
    .update(schema.leads)
    .set({
      followupState: pausing ? "paused" : "active",
      pausedAt: pausing ? now : null,
      // An auto-pause reason must not outlive the pause.
      pauseReason: pausing ? lead.pauseReason ?? null : null,
      ...(resumedAt ? { nextFollowupAt: resumedAt } : {}),
      updatedAt: now,
    })
    .where(eq(schema.leads.id, lead.id));

  // Pause/resume is bookkeeping, not a stage confirmation: it goes to the
  // free-form lead_activities timeline so it is always recorded and never
  // competes for the per-stage confirmation slot.
  await db.insert(schema.leadActivities).values({
    id: crypto.randomUUID(),
    leadId: lead.id,
    type: pausing ? "pause" : "resume",
    text: pausing
      ? "Follow-up sequence paused."
      : resumedAt
        ? "Follow-up sequence resumed and rescheduled."
        : "Follow-up sequence resumed.",
    user: staff.id,
    at: now,
  });

  await logAudit(db, {
    action: pausing ? "followup.pause" : "followup.resume",
    entityType: "lead",
    entityId: lead.id,
    actor: staff.email,
    role: staff.role,
  });

  return c.json({
    success: true,
    data: { leadId: lead.id, followupState: pausing ? "paused" : "active" },
  });
});

/**
 * GET /api/followup/leads/:id/history — follow-up activity history plus
 * customer notes for the open lead, newest first, paginated.
 */
followupRouter.get("/leads/:id/history", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  const result = await requireOwnedLead(db, c.req.param("id"), staff);
  if (!result.ok) return result.response;
  const lead = result.lead;

  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "30"), 1), 100);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

  const [activities, notes, timeline] = await Promise.all([
    db
      .select()
      .from(schema.followupActivities)
      .where(eq(schema.followupActivities.leadId, lead.id))
      .orderBy(desc(schema.followupActivities.at))
      .limit(limit)
      .offset(offset)
      .all(),
    db
      .select()
      .from(schema.customerNotes)
      .where(eq(schema.customerNotes.leadId, lead.id))
      .orderBy(desc(schema.customerNotes.createdAt))
      .limit(limit)
      .offset(offset)
      .all(),
    // Free-form engine events (pause/resume, postpone, transfer) — kept
    // separate from the per-stage rows so nothing competes for the
    // (lead, stage) confirmation slot.
    db
      .select()
      .from(schema.leadActivities)
      .where(eq(schema.leadActivities.leadId, lead.id))
      .orderBy(desc(schema.leadActivities.at))
      .limit(limit)
      .offset(offset)
      .all(),
  ]);

  return c.json({
    success: true,
    data: { activities, notes, timeline },
    pagination: { limit, offset },
  });
});

// ---------------------------------------------------------------------------
// Admin-only actions
// ---------------------------------------------------------------------------

/**
 * POST /api/followup/leads/:id/transfer — ADMIN-only ownership transfer.
 * Moves the lead to a new owner (sales user id), re-activates a paused
 * sequence, and logs the transfer. SALES callers get a neutral 404.
 */
followupRouter.post("/leads/:id/transfer", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  // Guard first: keeps the 404 contract even for non-admins.
  const result = await requireOwnedLead(db, c.req.param("id"), staff);
  if (!result.ok) return result.response;

  if (followupAccessRole(staff.role) !== "ADMIN") {
    return c.json(
      { error: "not_found", message: "Lead not found" },
      404,
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    ownerUserId?: string;
    /** Optional audit reason, shown in the activity timeline. */
    reason?: string;
  };
  const newOwner = body.ownerUserId?.trim();
  if (!newOwner) {
    return c.json(
      { success: false, error: "ownerUserId is required" },
      400,
    );
  }
  const reason = body.reason?.trim().slice(0, 500) || "";

  // The new owner must be an existing active user with a CRM role.
  const [target] = await db
    .select({ id: schema.user.id, role: schema.user.role, status: schema.user.status })
    .from(schema.user)
    .where(eq(schema.user.id, newOwner))
    .limit(1);
  if (!target || target.status !== "active" || !followupAccessRole(target.role)) {
    return c.json(
      { success: false, error: "Target user is not an active CRM user" },
      400,
    );
  }

  // Transferring to the current owner is a no-op; reject so the console
  // can show a clear error instead of writing a misleading audit row.
  if (newOwner === result.lead.ownerUserId) {
    return c.json(
      { success: false, error: "Lead is already owned by this user" },
      409,
    );
  }

  const now = new Date().toISOString();
  await db
    .update(schema.leads)
    .set({
      ownerUserId: newOwner,
      // Transferred leads resume their sequence for the new owner.
      followupState: result.lead.followupState === "paused" ? "active" : result.lead.followupState,
      updatedAt: now,
    })
    .where(eq(schema.leads.id, result.lead.id));

  // A transfer is bookkeeping, NOT a stage confirmation. It goes to the
  // free-form lead_activities timeline (no per-stage unique slot) so it can
  // never occupy FU1 as a fake confirmation, nor be dropped when that slot
  // is already taken by another event.
  await db.insert(schema.leadActivities).values({
    id: crypto.randomUUID(),
    leadId: result.lead.id,
    type: "transfer",
    text: reason
      ? `Ownership transferred to user ${newOwner}. Reason: ${reason}`
      : `Ownership transferred to user ${newOwner}.`,
    user: staff.id,
    at: now,
  });

  await logAudit(db, {
    action: "followup.lead.transfer",
    entityType: "lead",
    entityId: result.lead.id,
    actor: staff.email,
    role: staff.role,
    detail: JSON.stringify({ from: result.lead.ownerUserId, to: newOwner, reason }),
  });

  return c.json({
    success: true,
    data: { leadId: result.lead.id, ownerUserId: newOwner },
  });
});

/**
 * POST /api/followup/leads/:id/review — ADMIN-only closure of an escalated
 * lead. After FU3 a lead sits in `followup_state = "escalated"` until an
 * admin decides what happens to it. Body:
 *   { outcome: "won" | "lost" | "handover", note?: string }
 *   won      → status won,  sequence done, schedule cleared.
 *   lost     → status lost, sequence done, schedule cleared (archived).
 *   handover → sequence paused, awaiting reassignment to another sales rep.
 * SALES callers get a neutral 404; a lead that is not awaiting review
 * answers 409 so a stale dialog cannot rewrite a live sequence.
 */
followupRouter.post("/leads/:id/review", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  // Guard first: keeps the 404 contract even for non-admins.
  const result = await requireOwnedLead(db, c.req.param("id"), staff);
  if (!result.ok) return result.response;

  if (followupAccessRole(staff.role) !== "ADMIN") {
    return c.json(
      { error: "not_found", message: "Lead not found" },
      404,
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    outcome?: string;
    note?: string;
  };
  if (body.outcome !== "won" && body.outcome !== "lost" && body.outcome !== "handover") {
    return c.json(
      { success: false, error: "outcome must be 'won', 'lost' or 'handover'" },
      422,
    );
  }
  const outcome = body.outcome;
  const note = body.note?.trim() ?? "";

  // Only a lead that is actually awaiting review can be closed. Closing an
  // active / paused / already-closed lead here would bypass the engine.
  if (result.lead.followupState !== "escalated") {
    return c.json(
      {
        error: "conflict",
        message: "Lead is not awaiting admin review",
        currentState: result.lead.followupState,
      },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const closesSequence = outcome === "won" || outcome === "lost";
  const outcomeLabel =
    outcome === "won" ? "Won" : outcome === "lost" ? "Lost" : "Hand over";

  await db
    .update(schema.leads)
    .set({
      ...(closesSequence
        ? {
            followupStatus: outcome as "won" | "lost",
            followupState: "done" as const,
            followupCompletedAt: now,
            nextFollowupAt: null,
          }
        : {
            // Handover: the sequence keeps its place but is parked until an
            // admin transfers the lead (POST /transfer re-activates it).
            followupState: "paused" as const,
            pausedAt: now,
            pauseReason: "handover: awaiting reassignment after admin review",
          }),
      updatedAt: now,
    })
    .where(eq(schema.leads.id, result.lead.id));

  await db.insert(schema.leadActivities).values({
    id: crypto.randomUUID(),
    leadId: result.lead.id,
    type: "review",
    text: note
      ? `Admin review: ${outcomeLabel} — ${note}`
      : `Admin review: ${outcomeLabel}`,
    user: staff.id,
    at: now,
  });

  await logAudit(db, {
    action: `followup.review.${outcome}`,
    entityType: "lead",
    entityId: result.lead.id,
    actor: staff.email,
    role: staff.role,
    detail: note ? note.slice(0, 200) : null,
  });

  return c.json({
    success: true,
    data: {
      leadId: result.lead.id,
      outcome,
      followupState: closesSequence ? "done" : "paused",
    },
  });
});

/** POST /api/followup/leads/:id/notes — append a customer note (owner/admin). */
followupRouter.post("/leads/:id/notes", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");

  const result = await requireOwnedLead(db, c.req.param("id"), staff);
  if (!result.ok) return result.response;

  const body = (await c.req.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return c.json(
      { success: false, error: "Note text is required" },
      400,
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.customerNotes).values({
    id,
    leadId: result.lead.id,
    text,
    createdBy: staff.id,
    createdAt: now,
  });

  await logAudit(db, {
    action: "followup.note.create",
    entityType: "lead",
    entityId: result.lead.id,
    actor: staff.email,
    role: staff.role,
  });

  return c.json({
    success: true,
    data: { id, leadId: result.lead.id, text, createdBy: staff.id, createdAt: now },
  }, 201);
});

/**
 * DELETE /api/followup/leads/:id — hard delete one lead and all its child
 * rows (activities, follow-ups, follow-up activities, customer notes).
 * ADMIN may delete any lead; SALES may delete only leads they own. Missing
 * or foreign ids answer 404 so existence never leaks.
 */
followupRouter.delete("/leads/:id", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const id = c.req.param("id");
  const owned = await requireOwnedLead(db, id, staff);
  if (!owned.ok) return owned.response;

  await db.delete(schema.leadActivities).where(eq(schema.leadActivities.leadId, id)).run();
  await db.delete(schema.leadFollowUps).where(eq(schema.leadFollowUps.leadId, id)).run();
  await db.delete(schema.followupActivities).where(eq(schema.followupActivities.leadId, id)).run();
  await db.delete(schema.customerNotes).where(eq(schema.customerNotes.leadId, id)).run();
  await db.delete(schema.leads).where(eq(schema.leads.id, id)).run();

  await logAudit(db, {
    actor: staff.id,
    role: staff.role,
    action: "lead_delete",
    entityType: "lead",
    entityId: id,
    detail: `name=${owned.lead.name}`,
  });

  return c.json({ success: true, data: { id } });
});

// ---------------------------------------------------------------------------
// Import: file parsing + mapping validation (Impor Lead backend)
// ---------------------------------------------------------------------------

/**
 * POST /api/followup/import/parse — parse an uploaded CSV file and validate
 * its column mapping. Accepts multipart/form-data with a `file` field and an
 * optional `mapping` JSON field ({ name, phone, destination, pax } → column
 * indexes). Returns headers, auto-mapping, per-row validation, and duplicate
 * hints against existing leads (by phone_normalized).
 *
 * The response never inserts anything — insertion is a separate commit step
 * so the user can fix the mapping first.
 */
followupRouter.post("/import/parse", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json(
      { error: "bad_request", message: "Expected multipart/form-data with a 'file' field" },
      { status: 400 },
    );
  }

  let file: File | null = null;
  let mappingRaw: string | null = null;
  try {
    const form = await c.req.parseBody();
    const candidate = form["file"];
    if (candidate instanceof File) file = candidate;
    const mapCandidate = form["mapping"];
    if (typeof mapCandidate === "string") mappingRaw = mapCandidate;
  } catch {
    return Response.json(
      { error: "bad_request", message: "Invalid multipart body" },
      { status: 400 },
    );
  }
  if (!file) {
    return Response.json(
      { error: "bad_request", message: "Missing 'file' field" },
      { status: 400 },
    );
  }

  // Size guard: cap uploads at 5 MB.
  if (file.size > 5 * 1024 * 1024) {
    return Response.json(
      { error: "payload_too_large", message: "File exceeds the 5 MB limit" },
      { status: 413 },
    );
  }

  const lowerName = file.name.toLowerCase();
  const isCsv = lowerName.endsWith(".csv") || lowerName.endsWith(".txt") || lowerName.endsWith(".tsv");
  if (!isCsv) {
    return Response.json(
      {
        error: "unsupported_file",
        message:
          "Only .csv/.tsv/.txt can be parsed. Excel files must be saved as CSV first.",
      },
      { status: 415 },
    );
  }

  const text = await file.text();
  const parsed = parseCsvText(text);
  if (!parsed) {
    return Response.json(
      { error: "empty_file", message: "File has no data rows" },
      { status: 422 },
    );
  }

  const auto = autoMapColumns(parsed.headers);
  let mapping: Partial<Record<ImportColumnRole, number>> = auto;
  if (mappingRaw) {
    try {
      const supplied = JSON.parse(mappingRaw) as Partial<Record<ImportColumnRole, number>>;
      if (supplied && typeof supplied === "object") mapping = supplied;
    } catch {
      // Fall back to the auto-mapping if the supplied JSON is malformed.
    }
  }

  const check = validateMapping(mapping);
  const rows = applyMappingValidate(parsed, mapping);

  // Duplicate hints: match against existing leads by normalized phone.
  const phoneSet = new Set(
    rows.filter((r) => r.phoneNormalized !== "").map((r) => r.phoneNormalized),
  );
  const duplicates: Record<string, boolean> = {};
  if (phoneSet.size > 0) {
    const existing = await db
      .select({ phone: schema.leads.phoneNormalized })
      .from(schema.leads);
    const existingSet = new Set(existing.map((e) => e.phone).filter((p): p is string => !!p));
    for (const r of rows) {
      if (r.phoneNormalized && existingSet.has(r.phoneNormalized)) {
        duplicates[r.rowNo] = true;
      }
    }
  }

  return c.json({
    success: true,
    data: {
      fileName: file.name,
      totalRows: rows.length,
      headers: parsed.headers,
      autoMapping: auto,
      mapping,
      mappingValid: check.ok,
      missingColumns: check.ok ? [] : check.missing,
      rows: rows.map((r) => ({
        rowNo: r.rowNo,
        name: r.name,
        phoneRaw: r.phoneRaw,
        phoneNormalized: r.phoneNormalized,
        destination: r.destination,
        pax: r.pax,
        problems: r.problems,
        duplicate: duplicates[r.rowNo] === true,
      })),
    },
  });
});

// ---------------------------------------------------------------------------
// Import: commit (execution) + batch summary
// ---------------------------------------------------------------------------

/**
 * POST /api/followup/import/commit — execute a validated import. Accepts
 * multipart/form-data: `file` (re-parsed server-side), optional `mapping`
 * JSON, and optional `ownerUserId` (ADMIN can assign to a sales user;
 * default is the importer). Inserts clean rows, skips duplicates (vs DB
 * and in-file), records every failure in import_errors, and writes the
 * import_batches summary row — all in one response.
 */
followupRouter.post("/import/commit", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  let file: File | null = null;
  let mappingRaw: string | null = null;
  let ownerUserId: string | null = null;
  try {
    const form = await c.req.parseBody();
    const candidate = form["file"];
    if (candidate instanceof File) file = candidate;
    const mapCandidate = form["mapping"];
    if (typeof mapCandidate === "string") mappingRaw = mapCandidate;
    const ownerCandidate = form["ownerUserId"];
    if (typeof ownerCandidate === "string" && ownerCandidate !== "") ownerUserId = ownerCandidate;
  } catch {
    return Response.json(
      { error: "bad_request", message: "Invalid multipart body" },
      { status: 400 },
    );
  }
  if (!file) {
    return Response.json(
      { error: "bad_request", message: "Missing 'file' field" },
      { status: 400 },
    );
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json(
      { error: "payload_too_large", message: "File exceeds the 5 MB limit" },
      { status: 413 },
    );
  }

  // Ownership: only ADMIN may import on behalf of another user.
  const finalOwner = access === "ADMIN" && ownerUserId ? ownerUserId : staff.id;

  const text = await file.text();
  const parsed = parseCsvText(text);
  if (!parsed) {
    return Response.json(
      { error: "empty_file", message: "File has no data rows" },
      { status: 422 },
    );
  }

  let mapping: Partial<Record<ImportColumnRole, number>> = autoMapColumns(parsed.headers);
  if (mappingRaw) {
    try {
      const supplied = JSON.parse(mappingRaw) as Partial<Record<ImportColumnRole, number>>;
      if (supplied && typeof supplied === "object") mapping = supplied;
    } catch {
      // keep auto-mapping
    }
  }

  const check = validateMapping(mapping);
  if (!check.ok) {
    return Response.json(
      {
        error: "mapping_invalid",
        message: `Missing required column mapping: ${check.missing.join(", ")}`,
        missingColumns: check.missing,
      },
      { status: 422 },
    );
  }

  const rows = applyMappingValidate(parsed, mapping);

  // Existing phones in DB (duplicate detection) — one query.
  const existing = await db
    .select({ phone: schema.leads.phoneNormalized })
    .from(schema.leads);
  const existingSet = new Set(existing.map((e) => e.phone).filter((p): p is string => !!p));

  const batchId = crypto.randomUUID();
  const inserted: typeof rows = [];
  const duplicates: { rowNo: number; reason: "duplicate_db" | "duplicate_in_file" }[] = [];
  const failed: { rowNo: number; reason: string; name: string; phoneRaw: string }[] = [];
  const inFileSeen = new Set<string>();

  for (const row of rows) {
    // Failed rows: any validation problem blocks insertion.
    const blocking = row.problems.filter((p) => p !== "duplicate_in_file");
    if (blocking.length > 0) {
      failed.push({
        rowNo: row.rowNo,
        reason: blocking.join(","),
        name: row.name,
        phoneRaw: row.phoneRaw,
      });
      continue;
    }
    // Duplicate vs DB.
    if (row.phoneNormalized !== "" && existingSet.has(row.phoneNormalized)) {
      duplicates.push({ rowNo: row.rowNo, reason: "duplicate_db" });
      continue;
    }
    // Duplicate within the file (first occurrence wins).
    if (row.phoneNormalized !== "" && inFileSeen.has(row.phoneNormalized)) {
      duplicates.push({ rowNo: row.rowNo, reason: "duplicate_in_file" });
      continue;
    }
    inFileSeen.add(row.phoneNormalized);
    inserted.push(row);
  }

  // Insert clean rows + schedule the first follow-up (FU1) from config.
  const nowIso = new Date().toISOString();
  const nextFu = (await firstFollowupAt(db)).toISOString();
  for (const row of inserted) {
    await db.insert(schema.leads).values({
      id: crypto.randomUUID(),
      name: row.name,
      phone: row.phoneRaw,
      phoneNormalized: row.phoneNormalized || null,
      destination: row.destination || null,
      pax: row.pax,
      stage: "new",
      ownerUserId: finalOwner,
      followupStatus: "new",
      followupState: "active",
      followupStage: "FU1",
      followupStageAt: nowIso,
      nextFollowupAt: nextFu,
      createdAt: nowIso,
      updatedAt: nowIso,
    }).run();
  }

  // Persist failed rows for the correction & re-import flow.
  for (const fail of failed) {
    await db.insert(schema.importErrors).values({
      id: crypto.randomUUID(),
      batchId,
      rowNumber: fail.rowNo,
      rawData: JSON.stringify({ name: fail.name, phone: fail.phoneRaw }),
      reason: fail.reason,
    }).run();
  }

  // Batch summary row.
  await db.insert(schema.importBatches).values({
    id: batchId,
    fileName: file.name,
    totalRows: rows.length,
    insertedRows: inserted.length,
    duplicateRows: duplicates.length,
    failedRows: failed.length,
    createdBy: staff.id,
  }).run();

  await logAudit(db, {
    actor: staff.id,
    role: staff.role,
    action: "import_commit",
    entityType: "import_batches",
    entityId: batchId,
    detail: `file=${file.name} total=${rows.length} inserted=${inserted.length} dup=${duplicates.length} failed=${failed.length} owner=${finalOwner}`,
  });

  return c.json(
    {
      success: true,
      data: {
        batchId,
        fileName: file.name,
        totalRows: rows.length,
        insertedRows: inserted.length,
        duplicateRows: duplicates.length,
        failedRows: failed.length,
        ownerUserId: finalOwner,
        duplicates,
        failed,
      },
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// Import: batch history
// ---------------------------------------------------------------------------

/**
 * GET /api/followup/import/batches — the importer's batch history with
 * per-batch error rows (for correction & re-import). ADMIN sees all
 * batches; SALES sees their own.
 */
followupRouter.get("/import/batches", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const batches = await db
    .select()
    .from(schema.importBatches)
    .where(access === "SALES" ? eq(schema.importBatches.createdBy, staff.id) : undefined)
    .orderBy(desc(schema.importBatches.createdAt))
    .limit(50);

  const errorsByBatch = new Map<string, (typeof schema.importErrors.$inferSelect)[]>();
  for (const batch of batches) {
    const errors = await db
      .select()
      .from(schema.importErrors)
      .where(eq(schema.importErrors.batchId, batch.id))
      .orderBy(asc(schema.importErrors.rowNumber));
    errorsByBatch.set(batch.id, errors);
  }

  return c.json({
    success: true,
    data: batches.map((batch) => ({
      ...batch,
      errors: (errorsByBatch.get(batch.id) ?? []).map((e) => ({
        rowNumber: e.rowNumber,
        reason: e.reason,
        raw: JSON.parse(e.rawData ?? "{}") as { name?: string; phone?: string },
      })),
    })),
  });
});

/**
 * GET /api/followup/import/batches/:id — full detail of one import batch,
 * including its error rows. SALES only see their own batches (neutral 404
 * otherwise); ADMIN sees everything.
 */
followupRouter.get("/import/batches/:id", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const batchId = c.req.param("id") ?? "";
  const [batch] = await db
    .select()
    .from(schema.importBatches)
    .where(eq(schema.importBatches.id, batchId))
    .limit(1);

  // Neutral 404 for missing batches AND for batches the caller does not own.
  if (!batch || (access === "SALES" && batch.createdBy !== staff.id)) {
    return Response.json(
      { error: "not_found", message: "Import batch not found" },
      { status: 404 },
    );
  }

  const errors = await db
    .select()
    .from(schema.importErrors)
    .where(eq(schema.importErrors.batchId, batch.id))
    .orderBy(asc(schema.importErrors.rowNumber));

  return c.json({
    success: true,
    data: {
      ...batch,
      errors: errors.map((e) => ({
        id: e.id,
        rowNumber: e.rowNumber,
        reason: e.reason,
        raw: JSON.parse(e.rawData ?? "{}") as Record<string, unknown>,
        createdAt: e.createdAt,
      })),
    },
  });
});

/**
 * DELETE /api/followup/import/batches/:id — remove an import batch and its
 * error rows. SALES may only delete their own batches (neutral 404
 * otherwise); ADMIN may delete any batch.
 */
followupRouter.delete("/import/batches/:id", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const batchId = c.req.param("id") ?? "";
  const [batch] = await db
    .select()
    .from(schema.importBatches)
    .where(eq(schema.importBatches.id, batchId))
    .limit(1);

  // Neutral 404 for missing batches AND batches the caller does not own.
  if (!batch || (access === "SALES" && batch.createdBy !== staff.id)) {
    return Response.json(
      { error: "not_found", message: "Import batch not found" },
      { status: 404 },
    );
  }

  await db.delete(schema.importErrors).where(eq(schema.importErrors.batchId, batchId)).run();
  await db.delete(schema.importBatches).where(eq(schema.importBatches.id, batchId)).run();

  await logAudit(db, {
    actor: staff.id,
    role: staff.role,
    action: "import_batch.delete",
    entityType: "import_batches",
    entityId: batchId,
    detail: `file=${batch.fileName}`,
  });

  return c.json({ success: true, data: { id: batchId } });
});

/**
 * POST /api/followup/import/batches/:id/retry — re-import corrected rows from
 * a failed batch. Body: { rows: [{ rowNumber, name, phone }] }. Each row is
 * re-validated (normalization + duplicate checks); rows that pass are
 * inserted as new leads, the batch counters are updated, and their
 * import_errors entries are removed. Rows still failing stay in
 * import_errors with the updated reason.
 */
followupRouter.post("/import/batches/:id/retry", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const batchId = c.req.param("id") ?? "";
  const [batch] = await db
    .select()
    .from(schema.importBatches)
    .where(eq(schema.importBatches.id, batchId))
    .limit(1);

  // Neutral 404 for missing batches AND for batches the caller does not own.
  if (!batch || (access === "SALES" && batch.createdBy !== staff.id)) {
    return Response.json(
      { error: "not_found", message: "Import batch not found" },
      { status: 404 },
    );
  }

  let body: { rows?: { rowNumber: number; name: string; phone: string }[] };
  try {
    body = await c.req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (rows.length === 0) {
    return Response.json(
      { error: "bad_request", message: "No rows supplied" },
      { status: 400 },
    );
  }

  // Existing error rows for this batch — only those can be retried.
  const errorRows = await db
    .select()
    .from(schema.importErrors)
    .where(eq(schema.importErrors.batchId, batch.id));
  const errorByRow = new Map(errorRows.map((e) => [e.rowNumber, e]));
  const known = rows.filter((r) => errorByRow.has(r.rowNumber));
  if (known.length === 0) {
    return Response.json(
      { error: "bad_request", message: "None of the rows belong to this batch's failed rows" },
      { status: 422 },
    );
  }

  // Existing phones for duplicate detection.
  const existing = await db
    .select({ phone: schema.leads.phoneNormalized })
    .from(schema.leads);
  const existingSet = new Set(existing.map((e) => e.phone).filter((p): p is string => !!p));

  const nowIso = new Date().toISOString();
  const nextFu = (await firstFollowupAt(db)).toISOString();
  const inserted: number[] = [];
  const stillFailing: { rowNumber: number; reason: string }[] = [];
  const inFileSeen = new Set<string>();

  for (const row of known) {
    const name = (row.name ?? "").trim();
    const phoneRaw = (row.phone ?? "").trim();
    const phoneNormalized = normalizeMyPhone(phoneRaw);
    const digits = phoneRaw.replace(/\D/g, "");

    // Re-run the same validation rules as the original import.
    if (name === "") {
      stillFailing.push({ rowNumber: row.rowNumber, reason: "empty_name" });
      continue;
    }
    if (digits === "") {
      stillFailing.push({ rowNumber: row.rowNumber, reason: "empty_phone" });
      continue;
    }
    if (digits.length < 7 || digits.length > 15) {
      stillFailing.push({ rowNumber: row.rowNumber, reason: "invalid_phone" });
      continue;
    }
    if (existingSet.has(phoneNormalized)) {
      stillFailing.push({ rowNumber: row.rowNumber, reason: "duplicate_db" });
      continue;
    }
    if (inFileSeen.has(phoneNormalized)) {
      stillFailing.push({ rowNumber: row.rowNumber, reason: "duplicate_in_file" });
      continue;
    }
    inFileSeen.add(phoneNormalized);

    await db.insert(schema.leads).values({
      id: crypto.randomUUID(),
      name,
      phone: phoneRaw,
      phoneNormalized: phoneNormalized || null,
      destination: null,
      pax: 1,
      stage: "new",
      // Batch owner keeps ownership of retried rows (same team context).
      ownerUserId: batch.createdBy,
      followupStatus: "new",
      followupState: "active",
      followupStage: "FU1",
      followupStageAt: nowIso,
      nextFollowupAt: nextFu,
      createdAt: nowIso,
      updatedAt: nowIso,
    }).run();
    inserted.push(row.rowNumber);
  }

  // Remove resolved error rows; update reasons for still-failing ones.
  for (const rowNo of inserted) {
    const err = errorByRow.get(rowNo);
    if (err) {
      await db.delete(schema.importErrors).where(eq(schema.importErrors.id, err.id)).run();
    }
  }
  for (const fail of stillFailing) {
    const err = errorByRow.get(fail.rowNumber);
    if (err) {
      await db
        .update(schema.importErrors)
        .set({
          reason: fail.reason,
          rawData: JSON.stringify({
            name: known.find((r) => r.rowNumber === fail.rowNumber)?.name ?? "",
            phone: known.find((r) => r.rowNumber === fail.rowNumber)?.phone ?? "",
          }),
        })
        .where(eq(schema.importErrors.id, err.id))
        .run();
    }
  }

  // Refresh the batch summary counters.
  await db
    .update(schema.importBatches)
    .set({
      insertedRows: batch.insertedRows + inserted.length,
      failedRows: Math.max(0, batch.failedRows - inserted.length),
    })
    .where(eq(schema.importBatches.id, batch.id))
    .run();

  await logAudit(db, {
    actor: staff.id,
    role: staff.role,
    action: "import_retry",
    entityType: "import_batches",
    entityId: batch.id,
    detail: `retried=${known.length} inserted=${inserted.length} still_failing=${stillFailing.length}`,
  });

  return c.json({
    success: true,
    data: {
      batchId: batch.id,
      retried: known.length,
      inserted: inserted.length,
      stillFailing,
    },
  });
});

/**
 * POST /api/followup/leads/bulk — bulk status/archive action.
 * Body: { ids: string[], action: "status" | "archive", status?: string }
 *   - action "status"  → sets followup_status (new/responded/won/lost/paused)
 *   - action "archive" → sets stage "lost" + followup_state "done" (archived:
 *                        the lead leaves the active follow-up queue)
 * Ownership: SALES may only touch their own leads (foreign ids are silently
 * counted as skipped — no existence leak); ADMIN may touch any.
 * Returns updated/skipped counts for the result-summary panel.
 */
followupRouter.post("/leads/bulk", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  let body: { ids?: unknown; action?: unknown; status?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && v !== "")
    : [];
  const action = body.action;
  if (ids.length === 0) {
    return Response.json(
      { error: "bad_request", message: "No lead ids supplied" },
      { status: 400 },
    );
  }
  if (ids.length > 500) {
    return Response.json(
      { error: "bad_request", message: "Bulk actions are capped at 500 leads per call" },
      { status: 422 },
    );
  }
  if (action !== "status" && action !== "archive") {
    return Response.json(
      { error: "bad_request", message: "action must be 'status' or 'archive'" },
      { status: 422 },
    );
  }

  const VALID_STATUSES = ["new", "responded", "won", "lost", "paused"] as const;
  type FollowupStatusValue = (typeof VALID_STATUSES)[number];
  let nextStatus: FollowupStatusValue | null = null;
  if (action === "status") {
    const status = body.status;
    if (typeof status !== "string" || !VALID_STATUSES.includes(status as FollowupStatusValue)) {
      return Response.json(
        {
          error: "bad_request",
          message: `status must be one of: ${VALID_STATUSES.join(", ")}`,
        },
        { status: 422 },
      );
    }
    nextStatus = status as FollowupStatusValue;
  }

  const nowIso = new Date().toISOString();
  let updated = 0;
  let skipped = 0;

  for (const id of ids) {
    // Per-lead ownership guard — same 404 contract as requireOwnedLead(),
    // but here foreign/missing ids are just skipped so one bad id cannot
    // abort the whole batch.
    const [lead] = await db
      .select({ id: schema.leads.id, owner: schema.leads.ownerUserId })
      .from(schema.leads)
      .where(eq(schema.leads.id, id))
      .limit(1);
    if (!lead || (access === "SALES" && lead.owner !== staff.id)) {
      skipped++;
      continue;
    }

    if (action === "archive") {
      await db
        .update(schema.leads)
        .set({
          stage: "lost",
          followupState: "done",
          followupCompletedAt: nowIso,
          nextFollowupAt: null,
          updatedAt: nowIso,
        })
        .where(eq(schema.leads.id, id))
        .run();
    } else if (nextStatus) {
      // A status change must keep the schedule coherent:
      //  - won / lost  → sequence finished, no more follow-ups due.
      //  - paused      → keep next_followup_at, engine state is "paused".
      //  - new/responded → (re)activate; a missing schedule gets a fresh FU1.
      const closesSequence = nextStatus === "won" || nextStatus === "lost";
      const [current] = await db
        .select({
          state: schema.leads.followupState,
          nextAt: schema.leads.nextFollowupAt,
          stage: schema.leads.followupStage,
        })
        .from(schema.leads)
        .where(eq(schema.leads.id, id))
        .limit(1);
      const reactivating = nextStatus === "new" || nextStatus === "responded";
      const needsFreshSchedule =
        reactivating && !current?.nextAt && current?.state !== "escalated";
      const freshAt = needsFreshSchedule
        ? (await nextStageFollowupAt(db, current?.stage ?? "FU1")).toISOString()
        : null;

      // Never silently downgrade an escalated lead; "paused" is a sales
      // action, escalation is an admin-review state that must survive it.
      const nextState = closesSequence
        ? "done"
        : current?.state === "escalated"
          ? "escalated"
          : nextStatus === "paused"
            ? "paused"
            : "active";

      await db
        .update(schema.leads)
        .set({
          followupStatus: nextStatus,
          followupState: nextState,
          followupCompletedAt: closesSequence ? nowIso : null,
          pausedAt: nextStatus === "paused" ? nowIso : null,
          nextFollowupAt: closesSequence ? null : (freshAt ?? current?.nextAt ?? null),
          updatedAt: nowIso,
        })
        .where(eq(schema.leads.id, id))
        .run();
    }
    updated++;
  }

  await logAudit(db, {
    actor: staff.id,
    role: staff.role,
    action: action === "archive" ? "leads_bulk_archive" : "leads_bulk_status",
    entityType: "leads",
    entityId: ids[0],
    detail: `ids=${ids.length} updated=${updated} skipped=${skipped} status=${nextStatus ?? "-"}`,
  });

  return c.json({
    success: true,
    data: {
      requested: ids.length,
      updated,
      skipped,
      action,
      status: nextStatus,
    },
  });
});

/**
 * POST /api/followup/leads/bulk-delete — hard delete many leads at once.
 * ADMIN may delete any lead; SALES only leads they own (foreign ids are
 * silently skipped, mirroring /leads/bulk). Body: { ids: string[] } (max 2000).
 * Deletes each lead plus its activities, follow-ups, followup activities and
 * customer notes — the same cascades as DELETE /leads/:id.
 */
followupRouter.post("/leads/bulk-delete", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  let body: { ids?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return Response.json(
      { error: "bad_request", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((v): v is string => typeof v === "string" && v !== ""))]
    : [];
  if (ids.length === 0) {
    return Response.json(
      { error: "bad_request", message: "No lead ids supplied" },
      { status: 400 },
    );
  }
  if (ids.length > 2000) {
    return Response.json(
      { error: "bad_request", message: "Bulk delete is capped at 2000 leads per call" },
      { status: 422 },
    );
  }

  // D1 limits bound parameters per statement, so run every query in small
  // chunks. We first resolve which of the requested ids actually exist, then
  // cascade-delete each chunk across all child tables before removing the
  // leads themselves.
  const chunk = 100; // D1 variable limit safety per statement
  const found: string[] = [];
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    // SALES may only delete their own leads — foreign ids are filtered out.
    const rows = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(
        access === "SALES"
          ? and(inArray(schema.leads.id, part), eq(schema.leads.ownerUserId, staff.id))
          : inArray(schema.leads.id, part),
      );
    for (const r of rows) found.push(r.id);
  }
  if (found.length === 0) {
    return c.json({ success: true, data: { requested: ids.length, deleted: 0 } });
  }

  for (let i = 0; i < found.length; i += chunk) {
    const part = found.slice(i, i + chunk);
    await db.delete(schema.leadActivities).where(inArray(schema.leadActivities.leadId, part)).run();
    await db.delete(schema.leadFollowUps).where(inArray(schema.leadFollowUps.leadId, part)).run();
    await db.delete(schema.followupActivities).where(inArray(schema.followupActivities.leadId, part)).run();
    await db.delete(schema.customerNotes).where(inArray(schema.customerNotes.leadId, part)).run();
    await db.delete(schema.leads).where(inArray(schema.leads.id, part)).run();
  }

  await logAudit(db, {
    actor: staff.id,
    role: staff.role,
    action: "leads_bulk_delete",
    entityType: "leads",
    entityId: found[0],
    detail: `requested=${ids.length} deleted=${found.length}`,
  });

  return c.json({
    success: true,
    data: { requested: ids.length, deleted: found.length },
  });
});

/**
 * GET /api/followup/leads/export — CSV/XLSX export with formula-injection
 * guard. Query params mirror GET /leads (q/status/owner/stage) plus:
 *   format — "csv" (default) or "xlsx" (SpreadsheetML 2003 .xls)
 * Every cell value starting with = + - @ or tab is prefixed with an
 * apostrophe so Excel/Sheets never evaluate it as a formula.
 */
followupRouter.get("/leads/export", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }

  const format = c.req.query("format") === "xlsx" ? "xlsx" : "csv";
  const q = (c.req.query("q") ?? "").trim();
  const status = (c.req.query("status") ?? "").trim();
  const owner = (c.req.query("owner") ?? "").trim();
  const stage = (c.req.query("stage") ?? "").trim();

  const conditions = [];
  if (access === "SALES") {
    conditions.push(eq(schema.leads.ownerUserId, staff.id));
  } else if (owner !== "") {
    conditions.push(eq(schema.leads.ownerUserId, owner));
  }
  if (q !== "") {
    const like = `%${q.toLowerCase()}%`;
    conditions.push(
      or(
        likeLower(schema.leads.name, like),
        likeLower(schema.leads.phone, like),
        likeLower(schema.leads.phoneNormalized, like),
        likeLower(schema.leads.destination, like),
      )!,
    );
  }
  if (status !== "") {
    conditions.push(eq(schema.leads.followupStatus, status as "new" | "responded" | "won" | "lost" | "paused"));
  }
  if (stage !== "") {
    conditions.push(eq(schema.leads.stage, stage as "new" | "contacted" | "qualified" | "quotation" | "won" | "lost"));
  }

  const rows = await db
    .select()
    .from(schema.leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.leads.updatedAt))
    .limit(5000)
    .all();

  // Formula-injection guard: dangerous leading chars get an apostrophe.
  const sanitize = (value: unknown): string => {
    const s = String(value ?? "");
    return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  };

  const columns: { key: keyof typeof schema.leads.$inferSelect; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "phoneNormalized", label: "Phone (Normalized)" },
    { key: "destination", label: "Destination" },
    { key: "pax", label: "Pax" },
    { key: "stage", label: "Stage" },
    { key: "followupStatus", label: "Follow-up Status" },
    { key: "followupState", label: "Follow-up State" },
    { key: "nextFollowupAt", label: "Next Follow-up At" },
    { key: "ownerUserId", label: "Owner ID" },
    { key: "createdAt", label: "Created At" },
  ];

  const stamp = new Date().toISOString().slice(0, 10);
  await logAudit(db, {
    actor: staff.id,
    role: staff.role,
    action: "leads_export",
    entityType: "leads",
    entityId: "-",
    detail: `format=${format} rows=${rows.length} filters=q:${q} status:${status} owner:${owner} stage:${stage}`,
  });

  if (format === "csv") {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      columns.map((c) => esc(c.label)).join(","),
      ...rows.map((row) =>
        columns.map((c) => esc(sanitize(row[c.key]))).join(","),
      ),
    ];
    return new Response("\ufeff" + lines.join("\r\n"), {
      headers: {
        "content-type": "text/csv;charset=utf-8",
        "content-disposition": `attachment; filename="leads-${stamp}.csv"`,
      },
    });
  }

  // SpreadsheetML 2003 (.xls) — opens natively in Excel, no library needed.
  const escXml = (v: string) =>
    v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const cell = (v: string) =>
    `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell>`;
  const xml =
    `<?xml version="1.0"?>\n` +
    `<?mso-application progid="Excel.Sheet"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n` +
    `<Worksheet ss:Name="Leads">\n<Table>\n` +
    `<Row>${columns.map((c) => cell(c.label)).join("")}</Row>\n` +
    rows.map((row) => `<Row>${columns.map((c) => cell(sanitize(row[c.key]))).join("")}</Row>`).join("\n") +
    `\n</Table>\n</Worksheet>\n</Workbook>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/vnd.ms-excel",
      "content-disposition": `attachment; filename="leads-${stamp}.xls"`,
    },
  });
});

export default followupRouter;

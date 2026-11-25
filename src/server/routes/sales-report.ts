import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";
import { followupAccessRole } from "../lib/owned-lead";

/**
 * Sales Report API — per-month numbers for the Report Sales page.
 *
 * Scoping follows the follow-up CRM pattern: SALES always sees their own
 * numbers (owner_user_id), ADMIN (super_admin/management) may pass
 * ?owner=<id> for one rep or omit it for team-wide totals.
 */

type Env = {
  Bindings: { DB: D1Database };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: import("../lib/auth-context").StaffIdentity;
  };
};

const salesReportRouter = new Hono<Env>();

const READ_ROLES = ["super_admin", "management", "sales"] as const;
const WRITE_ROLES = ["super_admin", "management"] as const;

/** Month key guard: YYYY-MM only. */
function isMonthKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Current KL month key (YYYY-MM). */
function currentMonth(): string {
  const kl = new Date(Date.now() + 8 * 3600 * 1000);
  return kl.toISOString().slice(0, 7);
}

/** First/last day of a YYYY-MM month as YYYY-MM-DD strings. */
function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, end: nextMonth };
}

/** Previous month key of a YYYY-MM string. */
function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

interface Overview {
  month: string;
  ownerUserId: string | null;
  customers: number;
  bookings: number;
  revenue: number;
  newLeads: number;
  wonLeads: number;
  followups: number;
  sources: Array<{ sourceId: string | null; sourceName: string; count: number }>;
  daily: Array<{ day: string; leads: number; followups: number }>;
  previous: {
    customers: number;
    bookings: number;
    revenue: number;
    newLeads: number;
    wonLeads: number;
    followups: number;
  };
}

/** Build the owner filter fragment — team-wide when ownerUserId is null. */
function ownerCondition(ownerUserId: string | null) {
  return ownerUserId ? eq(schema.leads.ownerUserId, ownerUserId) : sql`1=1`;
}

/** Count rows owned by this scope created inside the month. */
async function countLeadsCreated(
  db: DrizzleD1Database<typeof schema>,
  ownerUserId: string | null,
  range: { start: string; end: string },
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.leads)
    .where(
      and(
        ownerCondition(ownerUserId),
        sql`${schema.leads.createdAt} >= ${range.start}`,
        sql`${schema.leads.createdAt} < ${range.end}`,
      ),
    );
  return Number(row?.n ?? 0);
}

/** Count leads that entered "won" inside the month. */
async function countLeadsWon(
  db: DrizzleD1Database<typeof schema>,
  ownerUserId: string | null,
  range: { start: string; end: string },
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.leads)
    .where(
      and(
        ownerCondition(ownerUserId),
        eq(schema.leads.followupStatus, "won"),
        sql`${schema.leads.followupCompletedAt} >= ${range.start}`,
        sql`${schema.leads.followupCompletedAt} < ${range.end}`,
      ),
    );
  return Number(row?.n ?? 0);
}

/** Confirmed follow-up activities inside the month for the scope. */
async function countFollowups(
  db: DrizzleD1Database<typeof schema>,
  ownerUserId: string | null,
  range: { start: string; end: string },
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.followupActivities)
    .innerJoin(schema.leads, eq(schema.followupActivities.leadId, schema.leads.id))
    .where(
      and(
        ownerCondition(ownerUserId),
        eq(schema.followupActivities.confirmed, true),
        sql`${schema.followupActivities.at} >= ${range.start}`,
        sql`${schema.followupActivities.at} < ${range.end}`,
      ),
    );
  return Number(row?.n ?? 0);
}

/** Customers linked to leads owned by this scope, created in the month. */
async function countCustomers(
  db: DrizzleD1Database<typeof schema>,
  ownerUserId: string | null,
  range: { start: string; end: string },
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.customers)
    .innerJoin(schema.leads, eq(schema.customers.leadId, schema.leads.id))
    .where(
      and(
        ownerCondition(ownerUserId),
        sql`${schema.customers.createdAt} >= ${range.start}`,
        sql`${schema.customers.createdAt} < ${range.end}`,
      ),
    );
  return Number(row?.n ?? 0);
}

/** Bookings + revenue for the scope inside the month (created_at window). */
async function bookingsAndRevenue(
  db: DrizzleD1Database<typeof schema>,
  ownerUserId: string | null,
  range: { start: string; end: string },
): Promise<{ bookings: number; revenue: number }> {
  const [row] = await db
    .select({
      n: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${schema.bookings.totalAmount}), 0)`,
    })
    .from(schema.bookings)
    .innerJoin(schema.customers, eq(schema.bookings.customerId, schema.customers.id))
    .innerJoin(schema.leads, eq(schema.customers.leadId, schema.leads.id))
    .where(
      and(
        ownerCondition(ownerUserId),
        sql`${schema.bookings.createdAt} >= ${range.start}`,
        sql`${schema.bookings.createdAt} < ${range.end}`,
      ),
    );
  return { bookings: Number(row?.n ?? 0), revenue: Number(row?.total ?? 0) };
}

/** Lead count per source for the scope inside the month. */
async function leadsPerSource(
  db: DrizzleD1Database<typeof schema>,
  ownerUserId: string | null,
  range: { start: string; end: string },
): Promise<Overview["sources"]> {
  const rows = await db
    .select({
      sourceId: schema.leads.sourceId,
      sourceName: schema.leadSources.name,
      count: sql<number>`count(*)`,
    })
    .from(schema.leads)
    .leftJoin(schema.leadSources, eq(schema.leads.sourceId, schema.leadSources.id))
    .where(
      and(
        ownerCondition(ownerUserId),
        sql`${schema.leads.createdAt} >= ${range.start}`,
        sql`${schema.leads.createdAt} < ${range.end}`,
      ),
    )
    .groupBy(schema.leads.sourceId, schema.leadSources.name)
    .orderBy(sql`count(*) desc`)
    .limit(12);
  return rows.map((r) => ({
    sourceId: r.sourceId,
    sourceName: r.sourceName ?? "Tiada sumber",
    count: Number(r.count),
  }));
}

/** Daily lead + follow-up counts for the month (trend chart). */
async function dailyTrend(
  db: DrizzleD1Database<typeof schema>,
  ownerUserId: string | null,
  month: string,
  range: { start: string; end: string },
): Promise<Overview["daily"]> {
  const leadRows = await db
    .select({
      day: sql<string>`substr(${schema.leads.createdAt}, 1, 10)`,
      n: sql<number>`count(*)`,
    })
    .from(schema.leads)
    .where(
      and(
        ownerCondition(ownerUserId),
        sql`${schema.leads.createdAt} >= ${range.start}`,
        sql`${schema.leads.createdAt} < ${range.end}`,
      ),
    )
    .groupBy(sql`substr(${schema.leads.createdAt}, 1, 10)`);

  const fuRows = await db
    .select({
      day: sql<string>`substr(${schema.followupActivities.at}, 1, 10)`,
      n: sql<number>`count(*)`,
    })
    .from(schema.followupActivities)
    .innerJoin(schema.leads, eq(schema.followupActivities.leadId, schema.leads.id))
    .where(
      and(
        ownerCondition(ownerUserId),
        eq(schema.followupActivities.confirmed, true),
        sql`${schema.followupActivities.at} >= ${range.start}`,
        sql`${schema.followupActivities.at} < ${range.end}`,
      ),
    )
    .groupBy(sql`substr(${schema.followupActivities.at}, 1, 10)`);

  const leadMap = new Map(leadRows.map((r) => [r.day, Number(r.n)]));
  const fuMap = new Map(fuRows.map((r) => [r.day, Number(r.n)]));

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daily: Overview["daily"] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${month}-${String(d).padStart(2, "0")}`;
    daily.push({ day, leads: leadMap.get(day) ?? 0, followups: fuMap.get(day) ?? 0 });
  }
  return daily;
}

/** GET /overview?month=YYYY-MM&owner=<id> */
salesReportRouter.get("/overview", requireRole(...READ_ROLES), async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return c.json({ error: "not_found", message: "Report sales not available for this role" }, 404);
  }

  const monthParam = c.req.query("month");
  const month = isMonthKey(monthParam) ? monthParam : currentMonth();
  const range = monthRange(month);
  const prevRange = monthRange(previousMonth(month));

  // SALES is pinned to their own numbers; ADMIN may filter or go team-wide.
  const ownerQuery = c.req.query("owner");
  const ownerUserId: string | null =
    access === "SALES"
      ? staff.id
      : ownerQuery && ownerQuery !== "all"
        ? ownerQuery
        : null;

  const [
    customers,
    bookingsRevenue,
    newLeads,
    wonLeads,
    followups,
    sources,
    daily,
    prevCustomers,
    prevBookingsRevenue,
    prevNewLeads,
    prevWonLeads,
    prevFollowups,
  ] = await Promise.all([
    countCustomers(db, ownerUserId, range),
    bookingsAndRevenue(db, ownerUserId, range),
    countLeadsCreated(db, ownerUserId, range),
    countLeadsWon(db, ownerUserId, range),
    countFollowups(db, ownerUserId, range),
    leadsPerSource(db, ownerUserId, range),
    dailyTrend(db, ownerUserId, month, range),
    countCustomers(db, ownerUserId, prevRange),
    bookingsAndRevenue(db, ownerUserId, prevRange),
    countLeadsCreated(db, ownerUserId, prevRange),
    countLeadsWon(db, ownerUserId, prevRange),
    countFollowups(db, ownerUserId, prevRange),
  ]);

  const overview: Overview = {
    month,
    ownerUserId,
    customers,
    bookings: bookingsRevenue.bookings,
    revenue: bookingsRevenue.revenue,
    newLeads,
    wonLeads,
    followups,
    sources,
    daily,
    previous: {
      customers: prevCustomers,
      bookings: prevBookingsRevenue.bookings,
      revenue: prevBookingsRevenue.revenue,
      newLeads: prevNewLeads,
      wonLeads: prevWonLeads,
      followups: prevFollowups,
    },
  };
  return c.json({ success: true, overview });
});

// ---------------------------------------------------------------------------
// Targets ("Team Mission")
// ---------------------------------------------------------------------------

/** GET /targets?month=YYYY-MM — readable by every sales-facing role. */
salesReportRouter.get("/targets", requireRole(...READ_ROLES), async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return c.json({ error: "not_found", message: "Report sales not available for this role" }, 404);
  }
  const monthParam = c.req.query("month");
  const month = isMonthKey(monthParam) ? monthParam : currentMonth();

  // SALES sees team targets plus their own personal targets only.
  const rows = await db
    .select()
    .from(schema.salesTargets)
    .where(
      access === "SALES"
        ? and(
            eq(schema.salesTargets.month, month),
            sql`(${schema.salesTargets.userId} IS NULL OR ${schema.salesTargets.userId} = ${staff.id})`,
          )
        : eq(schema.salesTargets.month, month),
    )
    .orderBy(sql`${schema.salesTargets.userId} IS NOT NULL`, sql`${schema.salesTargets.metric}`);
  return c.json({ success: true, targets: rows, month });
});

interface TargetInput {
  month?: string;
  userId?: string | null;
  metric?: string;
  targetValue?: number;
}

/** POST /targets — create a monthly target (management only). */
salesReportRouter.post("/targets", requireRole(...WRITE_ROLES), async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const body = (await c.req.json<TargetInput>()) as TargetInput;

  if (!isMonthKey(body.month)) {
    return c.json({ success: false, error: "month must be YYYY-MM" }, 400);
  }
  const metric = body.metric;
  if (
    metric !== "leads" &&
    metric !== "followups" &&
    metric !== "won" &&
    metric !== "bookings" &&
    metric !== "revenue"
  ) {
    return c.json({ success: false, error: "invalid metric" }, 400);
  }
  const targetValue = Math.max(0, Math.round(Number(body.targetValue ?? 0)));
  const userId = body.userId ? String(body.userId) : null;

  const id = crypto.randomUUID();
  await db.insert(schema.salesTargets).values({
    id,
    month: body.month,
    userId,
    metric,
    targetValue,
    createdBy: staff.id,
  });
  const [row] = await db
    .select()
    .from(schema.salesTargets)
    .where(eq(schema.salesTargets.id, id))
    .limit(1);
  return c.json({ success: true, target: row });
});

/** PATCH /targets/:id — adjust value/metric (management only). */
salesReportRouter.patch("/targets/:id", requireRole(...WRITE_ROLES), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = (await c.req.json<TargetInput>()) as TargetInput;

  const [existing] = await db
    .select()
    .from(schema.salesTargets)
    .where(eq(schema.salesTargets.id, id))
    .limit(1);
  if (!existing) return c.json({ success: false, error: "not_found" }, 404);

  const metric =
    body.metric === "leads" ||
    body.metric === "followups" ||
    body.metric === "won" ||
    body.metric === "bookings" ||
    body.metric === "revenue"
      ? body.metric
      : existing.metric;
  const targetValue =
    body.targetValue !== undefined
      ? Math.max(0, Math.round(Number(body.targetValue)))
      : existing.targetValue;

  await db
    .update(schema.salesTargets)
    .set({ metric, targetValue })
    .where(eq(schema.salesTargets.id, id));
  const [row] = await db
    .select()
    .from(schema.salesTargets)
    .where(eq(schema.salesTargets.id, id))
    .limit(1);
  return c.json({ success: true, target: row });
});

/** DELETE /targets/:id (management only). */
salesReportRouter.delete("/targets/:id", requireRole(...WRITE_ROLES), async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await db.delete(schema.salesTargets).where(eq(schema.salesTargets.id, id));
  return c.json({ success: true });
});

export default salesReportRouter;

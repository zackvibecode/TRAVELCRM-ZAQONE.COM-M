import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";
import { followupAccessRole } from "../lib/owned-lead";

/**
 * Share Report API — sales submit their own report entries (customer name,
 * packs sold, where the lead came from). Dashboard numbers are computed from
 * this table, NOT from follow-up or bookings data.
 *
 * Scoping: sales see/submit only their own entries; management/super_admin
 * see the whole team and may filter by ?owner=<id>.
 */

type Env = {
  Bindings: { DB: D1Database };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: import("../lib/auth-context").StaffIdentity;
  };
};

const shareReportRouter = new Hono<Env>();

const READ_ROLES = ["super_admin", "management", "sales"] as const;
const ADMIN_ROLES = ["super_admin", "management"] as const;

/** GET /packages — the curated list of sellable packages for the report form. */
shareReportRouter.get("/packages", requireRole(...READ_ROLES), async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: schema.salesPackages.id,
      flag: schema.salesPackages.flag,
      name: schema.salesPackages.name,
    })
    .from(schema.salesPackages)
    .where(eq(schema.salesPackages.active, true))
    .orderBy(schema.salesPackages.sortOrder, schema.salesPackages.name);
  return c.json({ success: true, packages: rows });
});

/** POST /packages — admin adds a package to the list. */
shareReportRouter.post("/packages", requireRole(...ADMIN_ROLES), async (c) => {
  const db = c.get("db");
  const body = (await c.req.json<{ flag?: string; name?: string }>()) as {
    flag?: string;
    name?: string;
  };
  const name = (body.name ?? "").trim().slice(0, 80);
  if (!name) return c.json({ success: false, error: "Nama pakej diperlukan" }, 400);
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(schema.salesPackages)
    .values({
      id,
      flag: (body.flag ?? "").trim().slice(0, 12),
      name,
    })
    .returning();
  return c.json({ success: true, package: row });
});

/** PATCH /packages/:id — admin renames / toggles a package. */
shareReportRouter.patch(
  "/packages/:id",
  requireRole(...ADMIN_ROLES),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = (await c.req.json<{
      flag?: string;
      name?: string;
      active?: boolean;
    }>()) as { flag?: string; name?: string; active?: boolean };
    const [existing] = await db
      .select()
      .from(schema.salesPackages)
      .where(eq(schema.salesPackages.id, id))
      .limit(1);
    if (!existing) return c.json({ success: false, error: "not_found" }, 404);
    await db
      .update(schema.salesPackages)
      .set({
        flag: body.flag !== undefined ? body.flag.trim().slice(0, 12) : existing.flag,
        name: body.name !== undefined ? body.name.trim().slice(0, 80) : existing.name,
        active: body.active !== undefined ? body.active : existing.active,
      })
      .where(eq(schema.salesPackages.id, id));
    const [row] = await db
      .select()
      .from(schema.salesPackages)
      .where(eq(schema.salesPackages.id, id))
      .limit(1);
    return c.json({ success: true, package: row });
  },
);

/** DELETE /packages/:id — admin removes a package. */
shareReportRouter.delete("/packages/:id", requireRole(...ADMIN_ROLES), async (c) => {
  const db = c.get("db");
  await db.delete(schema.salesPackages).where(eq(schema.salesPackages.id, c.req.param("id")));
  return c.json({ success: true });
});

/** Month key guard: YYYY-MM only. */
function isMonthKey(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Current KL month key (YYYY-MM). */
function currentMonth(): string {
  const kl = new Date(Date.now() + 8 * 3600 * 1000);
  return kl.toISOString().slice(0, 7);
}

/** Sanitise a non-negative money amount (MYR); invalid → 0. */
function parseAmount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

/** Previous month key of a YYYY-MM string. */
function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Deal status values accepted from the client. */
const STATUSES = ["confirm", "partial", "cancel"] as const;
type DealStatus = (typeof STATUSES)[number];

/** Coerce an incoming status; anything unknown falls back to "confirm". */
function parseStatus(value: unknown): DealStatus {
  const v = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (STATUSES as readonly string[]).includes(v) ? (v as DealStatus) : "confirm";
}

interface ShareDashboard {
  month: string;
  ownerUserId: string | null;
  customers: number;
  packs: number;
  invoiceTotal: number;
  previous: { customers: number; packs: number; invoiceTotal: number };
  sources: Array<{ source: string; count: number }>;
  daily: Array<{ day: string; entries: number; packs: number; invoiceTotal: number }>;
  reps: Array<{ userId: string; userName: string; customers: number; packs: number; invoiceTotal: number }>;
}

/** Resolve scope: sales pinned to self; admin may filter or team-wide. */
function resolveOwner(
  access: "ADMIN" | "SALES",
  staffId: string,
  ownerQuery: string | undefined,
): string | null {
  if (access === "SALES") return staffId;
  return ownerQuery && ownerQuery !== "all" ? ownerQuery : null;
}

function ownerCondition(ownerUserId: string | null) {
  return ownerUserId ? eq(schema.shareReports.userId, ownerUserId) : sql`1=1`;
}

/** GET /dashboard?month=YYYY-MM&owner=<id> — one call for the whole page. */
shareReportRouter.get("/dashboard", requireRole(...READ_ROLES), async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return c.json(
      { error: "not_found", message: "Share report not available for this role" },
      404,
    );
  }
  const monthParam = c.req.query("month");
  const month = isMonthKey(monthParam) ? monthParam : currentMonth();
  const owner = resolveOwner(access, staff.id, c.req.query("owner"));
  const prev = previousMonth(month);

  // Team-wide totals + previous-month comparison.
  const [totalsRows, prevRows, sourceRows, dailyRows, repRows] = await Promise.all([
    db
      .select({
        customers: sql<number>`count(*)`,
        packs: sql<number>`coalesce(sum(${schema.shareReports.packs}), 0)`,
        invoiceTotal: sql<number>`coalesce(sum(${schema.shareReports.invoiceTotal}), 0)`,
      })
      .from(schema.shareReports)
      .where(and(ownerCondition(owner), eq(schema.shareReports.month, month))),
    db
      .select({
        customers: sql<number>`count(*)`,
        packs: sql<number>`coalesce(sum(${schema.shareReports.packs}), 0)`,
        invoiceTotal: sql<number>`coalesce(sum(${schema.shareReports.invoiceTotal}), 0)`,
      })
      .from(schema.shareReports)
      .where(and(ownerCondition(owner), eq(schema.shareReports.month, prev))),
    db
      .select({
        source: schema.shareReports.source,
        count: sql<number>`count(*)`,
      })
      .from(schema.shareReports)
      .where(and(ownerCondition(owner), eq(schema.shareReports.month, month)))
      .groupBy(schema.shareReports.source)
      .orderBy(sql`count(*) desc`)
      .limit(12),
    db
      .select({
        day: sql<string>`substr(${schema.shareReports.createdAt}, 1, 10)`,
        entries: sql<number>`count(*)`,
        packs: sql<number>`coalesce(sum(${schema.shareReports.packs}), 0)`,
        invoiceTotal: sql<number>`coalesce(sum(${schema.shareReports.invoiceTotal}), 0)`,
      })
      .from(schema.shareReports)
      .where(and(ownerCondition(owner), eq(schema.shareReports.month, month)))
      .groupBy(sql`substr(${schema.shareReports.createdAt}, 1, 10)`),
    db
      .select({
        userId: schema.shareReports.userId,
        userName: schema.user.name,
        customers: sql<number>`count(*)`,
        packs: sql<number>`coalesce(sum(${schema.shareReports.packs}), 0)`,
        invoiceTotal: sql<number>`coalesce(sum(${schema.shareReports.invoiceTotal}), 0)`,
      })
      .from(schema.shareReports)
      .leftJoin(schema.user, eq(schema.shareReports.userId, schema.user.id))
      .where(eq(schema.shareReports.month, month))
      .groupBy(schema.shareReports.userId, schema.user.name)
      .orderBy(sql`count(*) desc`),
  ]);

  const totals = totalsRows[0] ?? { customers: 0, packs: 0, invoiceTotal: 0 };
  const prevTotals = prevRows[0] ?? { customers: 0, packs: 0, invoiceTotal: 0 };

  // Fill all days of the month for the daily trend chart.
  const entryMap = new Map(dailyRows.map((r) => [r.day, r]));
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daily: ShareDashboard["daily"] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const day = `${month}-${String(d).padStart(2, "0")}`;
    const row = entryMap.get(day);
    daily.push({
      day,
      entries: Number(row?.entries ?? 0),
      packs: Number(row?.packs ?? 0),
      invoiceTotal: Number(row?.invoiceTotal ?? 0),
    });
  }

  const dashboard: ShareDashboard = {
    month,
    ownerUserId: owner,
    customers: Number(totals.customers),
    packs: Number(totals.packs),
    invoiceTotal: Number(totals.invoiceTotal),
    previous: {
      customers: Number(prevTotals.customers),
      packs: Number(prevTotals.packs),
      invoiceTotal: Number(prevTotals.invoiceTotal),
    },
    sources: sourceRows.map((r) => ({ source: r.source || "Tiada sumber", count: Number(r.count) })),
    daily,
    reps: repRows.map((r) => ({
      userId: r.userId,
      userName: r.userName ?? r.userId,
      customers: Number(r.customers),
      packs: Number(r.packs),
      invoiceTotal: Number(r.invoiceTotal),
    })),
  };
  return c.json({ success: true, dashboard });
});

/** GET /entries?month=YYYY-MM — list entries for the scope. */
shareReportRouter.get("/entries", requireRole(...READ_ROLES), async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) {
    return c.json({ error: "not_found" }, 404);
  }
  const monthParam = c.req.query("month");
  const month = isMonthKey(monthParam) ? monthParam : currentMonth();
  const owner = resolveOwner(access, staff.id, c.req.query("owner"));

  const rows = await db
    .select({
      id: schema.shareReports.id,
      month: schema.shareReports.month,
      userId: schema.shareReports.userId,
      userName: schema.user.name,
      customerName: schema.shareReports.customerName,
      packs: schema.shareReports.packs,
      source: schema.shareReports.source,
      invoiceTotal: schema.shareReports.invoiceTotal,
      invoiceNo: schema.shareReports.invoiceNo,
      status: schema.shareReports.status,
      packageName: schema.shareReports.packageName,
      notes: schema.shareReports.notes,
      createdAt: schema.shareReports.createdAt,
    })
    .from(schema.shareReports)
    .leftJoin(schema.user, eq(schema.shareReports.userId, schema.user.id))
    .where(and(ownerCondition(owner), eq(schema.shareReports.month, month)))
    .orderBy(sql`${schema.shareReports.createdAt} desc`)
    .limit(500);

  return c.json({
    success: true,
    entries: rows.map((r) => ({ ...r, userName: r.userName ?? r.userId })),
  });
});

interface EntryInput {
  month?: string;
  customerName?: string;
  packs?: number;
  source?: string;
  invoiceTotal?: number;
  invoiceNo?: string;
  status?: string;
  packageName?: string;
  notes?: string;
}

/** POST /entries — sales submit a report entry (own entries only). */
shareReportRouter.post("/entries", requireRole(...READ_ROLES), async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const body = (await c.req.json<EntryInput>()) as EntryInput;

  const customerName = (body.customerName ?? "").trim();
  if (!customerName) {
    return c.json({ success: false, error: "Nama customer diperlukan" }, 400);
  }
  const month = isMonthKey(body.month) ? body.month : currentMonth();
  const packs = Math.max(1, Math.round(Number(body.packs ?? 1)));

  const id = crypto.randomUUID();
  await db.insert(schema.shareReports).values({
    id,
    month,
    userId: staff.id,
    customerName,
    packs,
    source: (body.source ?? "").trim(),
    invoiceTotal: parseAmount(body.invoiceTotal),
    invoiceNo: (body.invoiceNo ?? "").trim().slice(0, 60),
    status: parseStatus(body.status),
    packageName: (body.packageName ?? "").trim().slice(0, 80),
    notes: body.notes?.trim() || null,
  });

  const [row] = await db
    .select()
    .from(schema.shareReports)
    .where(eq(schema.shareReports.id, id))
    .limit(1);
  return c.json({ success: true, entry: row });
});

/** PATCH /entries/:id — edit own entry; admin may edit any. */
shareReportRouter.patch("/entries/:id", requireRole(...READ_ROLES), async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) return c.json({ error: "not_found" }, 404);
  const id = c.req.param("id");
  const body = (await c.req.json<EntryInput>()) as EntryInput;

  const [existing] = await db
    .select()
    .from(schema.shareReports)
    .where(eq(schema.shareReports.id, id))
    .limit(1);
  if (!existing) return c.json({ success: false, error: "not_found" }, 404);
  // SALES may only edit their own entries.
  if (access === "SALES" && existing.userId !== staff.id) {
    return c.json({ success: false, error: "forbidden" }, 403);
  }

  await db
    .update(schema.shareReports)
    .set({
      customerName: body.customerName?.trim() || existing.customerName,
      packs:
        body.packs !== undefined ? Math.max(1, Math.round(Number(body.packs))) : existing.packs,
      source: body.source !== undefined ? body.source.trim() : existing.source,
      invoiceTotal:
        body.invoiceTotal !== undefined ? parseAmount(body.invoiceTotal) : existing.invoiceTotal,
      invoiceNo: body.invoiceNo !== undefined ? body.invoiceNo.trim().slice(0, 60) : existing.invoiceNo,
      status: body.status !== undefined ? parseStatus(body.status) : existing.status,
      packageName:
        body.packageName !== undefined ? body.packageName.trim().slice(0, 80) : existing.packageName,
      notes: body.notes !== undefined ? body.notes.trim() || null : existing.notes,
      updatedAt: sql`(datetime('now'))`,
    })
    .where(eq(schema.shareReports.id, id));

  const [row] = await db
    .select()
    .from(schema.shareReports)
    .where(eq(schema.shareReports.id, id))
    .limit(1);
  return c.json({ success: true, entry: row });
});

/** DELETE /entries/:id — delete own entry; admin may delete any. */
shareReportRouter.delete("/entries/:id", requireRole(...READ_ROLES), async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const access = followupAccessRole(staff.role);
  if (!access) return c.json({ error: "not_found" }, 404);
  const id = c.req.param("id");

  const [existing] = await db
    .select()
    .from(schema.shareReports)
    .where(eq(schema.shareReports.id, id))
    .limit(1);
  if (!existing) return c.json({ success: true });
  if (access === "SALES" && existing.userId !== staff.id) {
    return c.json({ success: false, error: "forbidden" }, 403);
  }
  await db.delete(schema.shareReports).where(eq(schema.shareReports.id, id));
  return c.json({ success: true });
});

export default shareReportRouter;

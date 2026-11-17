import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
  };
};

const dashboardRouter = new Hono<Env>();

/**
 * GET /dashboard/kpi
 *
 * Aggregated KPIs for the admin dashboard overview:
 * - Lead counts (open / total / win rate)
 * - Customer total
 * - Booking counts (active / confirmed)
 * - Collected & outstanding revenue
 * - Overdue invoices (count + amount)
 */
dashboardRouter.get("/kpi", async (c) => {
  const db = c.get("db");

  // Leads: open = not yet won/lost; winRate = won / decided.
  const leadRows = await db.all<{
    total: number;
    open: number;
    won: number;
    lost: number;
  }>(sql`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN stage NOT IN ('won', 'lost') THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN stage = 'won' THEN 1 ELSE 0 END) AS won,
      SUM(CASE WHEN stage = 'lost' THEN 1 ELSE 0 END) AS lost
    FROM leads
  `);

  const customerRows = await db.all<{ total: number }>(sql`
    SELECT COUNT(*) AS total FROM customers
  `);

  // Bookings: active excludes cancelled; collected sums verified payments.
  const bookingRows = await db.all<{
    active: number;
    confirmed: number;
    collected: number;
    outstanding: number;
  }>(sql`
    SELECT
      SUM(CASE WHEN status != 'cancelled' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
      SUM(CASE WHEN status != 'cancelled' THEN paid_amount ELSE 0 END) AS collected,
      SUM(CASE WHEN status != 'cancelled' THEN balance_due ELSE 0 END) AS outstanding
    FROM bookings
  `);

  // Overdue invoices: outstanding balance and due date in the past.
  const overdueRows = await db.all<{ count: number; amount: number }>(sql`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(balance_due), 0) AS amount
    FROM invoices
    WHERE balance_due > 0
      AND status NOT IN ('void', 'draft')
      AND due_date IS NOT NULL
      AND due_date < date('now')
  `);

  const leads = leadRows[0] ?? { total: 0, open: 0, won: 0, lost: 0 };
  const customers = customerRows[0] ?? { total: 0 };
  const bookings = bookingRows[0] ?? {
    active: 0,
    confirmed: 0,
    collected: 0,
    outstanding: 0,
  };
  const overdue = overdueRows[0] ?? { count: 0, amount: 0 };

  const decided = Number(leads.won) + Number(leads.lost);
  const winRate = decided > 0 ? Math.round((Number(leads.won) / decided) * 100) : 0;

  return c.json({
    leads: {
      total: Number(leads.total),
      open: Number(leads.open),
      winRate,
    },
    customers: {
      total: Number(customers.total),
    },
    bookings: {
      active: Number(bookings.active),
      confirmed: Number(bookings.confirmed),
      collected: Number(bookings.collected),
      outstanding: Number(bookings.outstanding),
    },
    invoices: {
      overdueCount: Number(overdue.count),
      overdueAmount: Number(overdue.amount),
    },
  });
});

/**
 * GET /dashboard/monthly-revenue
 *
 * Verified (paid) revenue per month for the last 12 months,
 * derived from booking payments — mirrors the dashboard bar chart.
 */
dashboardRouter.get("/monthly-revenue", async (c) => {
  const db = c.get("db");

  const rows = await db.all<{ month: string; revenue: number; count: number }>(sql`
    SELECT
      strftime('%Y-%m', created_at) AS month,
      COALESCE(SUM(paid_amount), 0) AS revenue,
      COUNT(*) AS count
    FROM bookings
    WHERE status != 'cancelled'
      AND created_at >= date('now', '-11 months', 'start of month')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
  `);

  return c.json({
    months: rows.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      count: Number(r.count),
    })),
  });
});

export default dashboardRouter;

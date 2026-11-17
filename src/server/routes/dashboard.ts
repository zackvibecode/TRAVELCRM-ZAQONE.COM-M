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

  // Cash actually collected = verified payments only (pending/rejected excluded).
  const paymentRows = await db.all<{ collected: number }>(sql`
    SELECT COALESCE(SUM(amount), 0) AS collected
    FROM payments
    WHERE status = 'verified'
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
  const payments = paymentRows[0] ?? { collected: 0 };

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
    payments: {
      collected: Number(payments.collected),
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

/**
 * GET /dashboard/revenue-trends
 *
 * Revenue (verified payments) vs booking value per month for the last 12
 * months — feeds the dashboard combined revenue/booking trend chart.
 */
dashboardRouter.get("/revenue-trends", async (c) => {
  const db = c.get("db");

  const revenueRows = await db.all<{ month: string; revenue: number }>(sql`
    SELECT strftime('%Y-%m', paid_at) AS month,
           COALESCE(SUM(amount), 0) AS revenue
    FROM payments
    WHERE status = 'verified'
      AND paid_at >= date('now', '-11 months', 'start of month')
    GROUP BY strftime('%Y-%m', paid_at)
    ORDER BY month ASC
  `);

  const bookingRows = await db.all<{ month: string; bookings: number; value: number }>(sql`
    SELECT strftime('%Y-%m', created_at) AS month,
           COUNT(*) AS bookings,
           COALESCE(SUM(total_amount - discount), 0) AS value
    FROM bookings
    WHERE status NOT IN ('cancelled', 'draft')
      AND created_at >= date('now', '-11 months', 'start of month')
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
  `);

  const revenueMap = new Map(revenueRows.map((r) => [r.month, Number(r.revenue)]));
  const bookingMap = new Map(
    bookingRows.map((r) => [r.month, { bookings: Number(r.bookings), value: Number(r.value) }]),
  );
  const months = Array.from(new Set([...revenueMap.keys(), ...bookingMap.keys()])).sort();

  return c.json({
    trends: months.map((month) => ({
      month,
      revenue: revenueMap.get(month) ?? 0,
      bookings: bookingMap.get(month)?.bookings ?? 0,
      bookingValue: bookingMap.get(month)?.value ?? 0,
    })),
  });
});

/**
 * GET /dashboard/top-packages
 *
 * Top-selling packages by confirmed/completed booking value and pax count.
 * Feeds the dashboard "Top Packages" ranking.
 */
dashboardRouter.get("/top-packages", async (c) => {
  const db = c.get("db");

  const rows = await db.all<{
    packageId: string;
    name: string;
    destination: string;
    bookings: number;
    pax: number;
    revenue: number;
  }>(sql`
    SELECT
      p.id AS packageId,
      p.name AS name,
      p.destination AS destination,
      COUNT(b.id) AS bookings,
      COALESCE(SUM(b.pax_adult + b.pax_child + b.pax_infant), 0) AS pax,
      COALESCE(SUM(b.paid_amount), 0) AS revenue
    FROM bookings b
    JOIN packages p ON p.id = b.package_id
    WHERE b.status IN ('confirmed', 'completed')
    GROUP BY p.id, p.name, p.destination
    ORDER BY revenue DESC, bookings DESC
    LIMIT 5
  `);

  return c.json({
    packages: rows.map((r) => ({
      packageId: r.packageId,
      name: r.name,
      destination: r.destination,
      bookings: Number(r.bookings),
      pax: Number(r.pax),
      revenue: Number(r.revenue),
    })),
  });
});

export default dashboardRouter;

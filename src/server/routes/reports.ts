import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
  };
};

const reportsRouter = new Hono<Env>();

/** Escape a value for CSV output (quotes, commas, newlines). */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvResponse(rows: Record<string, unknown>[], filename: string): Response {
  if (rows.length === 0) rows = [{ message: "no data" }];
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ];
  return new Response("\uFEFF" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Clamp a query string to a safe date string (YYYY-MM-DD), or null. */
function safeDate(v: string | undefined): string | null {
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

/**
 * GET /reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv
 * Monthly bookings, transaction value, and collected payments.
 */
reportsRouter.get("/sales", async (c) => {
  const db = c.get("db");
  const from = safeDate(c.req.query("from"));
  const to = safeDate(c.req.query("to"));
  const format = c.req.query("format");

  const rows = await db.all<{ month: string; bookings: number; gross: number; paid: number }>(sql`
    SELECT
      strftime('%Y-%m', b.created_at) AS month,
      COUNT(*) AS bookings,
      COALESCE(SUM(b.total_amount - b.discount), 0) AS gross,
      COALESCE(SUM(b.paid_amount), 0) AS paid
    FROM bookings b
    WHERE b.status NOT IN ('cancelled', 'draft')
      ${from ? sql`AND b.created_at >= ${from}` : sql``}
      ${to ? sql`AND b.created_at <= ${to || ""} ` : sql``}
    GROUP BY strftime('%Y-%m', b.created_at)
    ORDER BY month ASC
  `);

  const data = rows.map((r) => ({
    month: r.month,
    bookings: Number(r.bookings),
    gross: Number(r.gross),
    paid: Number(r.paid),
  }));

  if (format === "csv") return csvResponse(data, "sales-report.csv");
  return c.json({ report: "sales", from, to, rows: data });
});

/**
 * GET /reports/finance?from=&to=&format=csv
 * Invoice totals, collections, and outstanding balances per month.
 */
reportsRouter.get("/finance", async (c) => {
  const db = c.get("db");
  const from = safeDate(c.req.query("from"));
  const to = safeDate(c.req.query("to"));
  const format = c.req.query("format");

  const rows = await db.all<{
    month: string;
    invoices: number;
    issued: number;
    collected: number;
    outstanding: number;
  }>(sql`
    SELECT
      strftime('%Y-%m', i.issue_date) AS month,
      COUNT(*) AS invoices,
      COALESCE(SUM(i.total), 0) AS issued,
      COALESCE(SUM(i.paid_amount), 0) AS collected,
      COALESCE(SUM(i.balance_due), 0) AS outstanding
    FROM invoices i
    WHERE i.status NOT IN ('draft', 'void')
      ${from ? sql`AND i.issue_date >= ${from}` : sql``}
      ${to ? sql`AND i.issue_date <= ${to || ""}` : sql``}
    GROUP BY strftime('%Y-%m', i.issue_date)
    ORDER BY month ASC
  `);

  const data = rows.map((r) => ({
    month: r.month,
    invoices: Number(r.invoices),
    issued: Number(r.issued),
    collected: Number(r.collected),
    outstanding: Number(r.outstanding),
  }));

  if (format === "csv") return csvResponse(data, "finance-report.csv");
  return c.json({ report: "finance", from, to, rows: data });
});

/**
 * GET /reports/occupancy?from=&to=&format=csv
 * Seats filled per departure vs capacity, with departure status.
 */
reportsRouter.get("/occupancy", async (c) => {
  const db = c.get("db");
  const from = safeDate(c.req.query("from"));
  const to = safeDate(c.req.query("to"));
  const format = c.req.query("format");

  const rows = await db.all<{
    departureId: string;
    packageName: string;
    departureDate: string;
    seatCapacity: number;
    seatsBooked: number;
    seatsHeld: number;
    status: string;
  }>(sql`
    SELECT
      d.id AS departureId,
      p.name AS packageName,
      d.departure_date AS departureDate,
      d.seat_capacity AS seatCapacity,
      d.seats_booked AS seatsBooked,
      d.seats_held AS seatsHeld,
      d.status
    FROM departures d
    JOIN packages p ON p.id = d.package_id
    WHERE 1 = 1
      ${from ? sql`AND d.departure_date >= ${from}` : sql``}
      ${to ? sql`AND d.departure_date <= ${to || ""}` : sql``}
    ORDER BY d.departure_date ASC
  `);

  const data = rows.map((r) => {
    const capacity = Number(r.seatCapacity) || 0;
    const booked = Number(r.seatsBooked);
    const held = Number(r.seatsHeld);
    return {
      departureId: r.departureId,
      packageName: r.packageName,
      departureDate: r.departureDate,
      capacity,
      booked,
      held,
      available: Math.max(0, capacity - booked - held),
      occupancyPct: capacity > 0 ? Math.round((booked / capacity) * 100) : 0,
      status: r.status,
    };
  });

  if (format === `csv`) return csvResponse(data, "occupancy-report.csv");
  return c.json({ report: "occupancy", from, to, rows: data });
});

/**
 * GET /reports/staff?from=&to=&format=csv
 * Per-agent contribution: assigned leads, won leads, bookings, collected value.
 */
reportsRouter.get("/staff", async (c) => {
  const db = c.get("db");
  const from = safeDate(c.req.query("from"));
  const to = safeDate(c.req.query("to"));
  const format = c.req.query("format");

  const rows = await db.all<{
    agent: string;
    leads: number;
    won: number;
    bookings: number;
    revenue: number;
  }>(sql`
    WITH agents AS (
      SELECT assigned_to AS agent FROM leads WHERE assigned_to IS NOT NULL
      UNION
      SELECT created_by AS agent FROM bookings WHERE created_by IS NOT NULL
    )
    SELECT
      a.agent AS agent,
      (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = a.agent) AS leads,
      (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = a.agent AND l.stage = 'won') AS won,
      (SELECT COUNT(*) FROM bookings b WHERE b.created_by = a.agent
         AND b.status NOT IN ('cancelled', 'draft')
         ${from ? sql`AND b.created_at >= ${from}` : sql``}
         ${to ? sql`AND b.created_at <= ${to || ""}` : sql``}) AS bookings,
      (SELECT COALESCE(SUM(p.amount), 0)
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         JOIN bookings b ON b.id = i.booking_id
        WHERE b.created_by = a.agent AND p.status = 'verified') AS revenue
    FROM agents a
    ORDER BY revenue DESC, won DESC
  `);

  const data = rows.map((r) => ({
    agent: r.agent,
    leads: Number(r.leads),
    won: Number(r.won),
    bookings: Number(r.bookings),
    revenue: Number(r.revenue),
  }));

  if (format === "csv") return csvResponse(data, "staff-report.csv");
  return c.json({ report: "staff", from, to, rows: data });
});

export default reportsRouter;

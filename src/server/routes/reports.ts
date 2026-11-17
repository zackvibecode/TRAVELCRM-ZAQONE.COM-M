import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

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

/** XML-escape a value for SpreadsheetML. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Excel export via SpreadsheetML 2003 (.xls XML) — opens natively in Excel
 * and LibreOffice, zero dependencies, Workers-compatible.
 */
function xlsResponse(
  rows: Record<string, unknown>[],
  sheetName: string,
  filename: string,
): Response {
  const headers = rows.length ? Object.keys(rows[0]) : ["message"];
  const headerCells = headers
    .map((h) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`)
    .join("");
  const bodyRows = rows.length
    ? rows
        .map(
          (r) =>
            `<Row>${headers
              .map((h) => {
                const v = r[h];
                if (typeof v === "number" && Number.isFinite(v))
                  return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
                return `<Cell><Data ss:Type="String">${xmlEscape(
                  v === null || v === undefined ? "" : String(v),
                )}</Data></Cell>`;
              })
              .join("")}</Row>`,
        )
        .join("")
    : `<Row><Cell><Data ss:Type="String">no data</Data></Cell></Row>`;

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="hdr">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${xmlEscape(sheetName)}">
  <Table>
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Shared export-format dispatch: json (default), csv, xlsx. */
function exportResponse(
  format: string | undefined,
  rows: Record<string, unknown>[],
  sheetName: string,
  csvName: string,
  jsonBody: Record<string, unknown>,
): Response {
  if (format === "csv") return csvResponse(rows, csvName);
  if (format === "xlsx") return xlsResponse(rows, sheetName, csvName.replace(".csv", ".xls"));
  return new Response(JSON.stringify(jsonBody), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
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

  if (format === "csv" || format === "xlsx")
    return exportResponse(format, data, "Sales", "sales-report.csv", {
      report: "sales",
      from,
      to,
      rows: data,
    });
  return c.json({ report: "sales", from, to, rows: data });
});

/**
 * GET /reports/finance?from=&to=&format=csv|xlsx
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

  if (format === "csv" || format === "xlsx")
    return exportResponse(format, data, "Finance", "finance-report.csv", {
      report: "finance",
      from,
      to,
      rows: data,
    });
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

  if (format === "csv" || format === "xlsx")
    return exportResponse(format, data, "Occupancy", "occupancy-report.csv", {
      report: "occupancy",
      from,
      to,
      rows: data,
    });
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

  if (format === "csv" || format === "xlsx")
    return exportResponse(format, data, "Staff", "staff-report.csv", {
      report: "staff",
      from,
      to,
      rows: data,
    });
  return c.json({ report: "staff", from, to, rows: data });
});

export default reportsRouter;

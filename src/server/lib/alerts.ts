import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

type DB = DrizzleD1Database<typeof schema>;

/**
 * Alert generation service.
 *
 * Scans live D1 data and persists alerts for:
 * - Low seat availability (departures <= 20% seats left)
 * - Overdue invoices (balance due past due_date)
 * - Upcoming departures (within 7 days)
 *
 * Each alert is deduplicated on (kind, entity_type, entity_id) so repeated
 * cron runs never create duplicates. Returns the number of new alerts.
 */
export async function generateAlerts(db: DB): Promise<number> {
  const candidates: schema.NewAlertRow[] = [];

  // Low seats: available = capacity - booked - held, threshold 20%.
  const seatRows = await db.all<{
    id: string;
    packageName: string;
    departureDate: string;
    capacity: number;
    booked: number;
    held: number;
  }>(sql`
    SELECT d.id, p.name AS packageName, d.departure_date AS departureDate,
           d.seat_capacity AS capacity,
           d.seats_booked AS booked, d.seats_held AS held
    FROM departures d
    JOIN packages p ON p.id = d.package_id
    WHERE d.status IN ('open', 'almost_full')
      AND d.seat_capacity > 0
      AND d.departure_date >= date('now')
  `);
  for (const d of seatRows) {
    const available = Number(d.capacity) - Number(d.booked) - Number(d.held);
    const ratio = available / Number(d.capacity);
    if (ratio <= 0.2) {
      candidates.push({
        id: `alert_low_seats_${d.id}`,
        kind: "low_seats",
        severity: ratio <= 0 ? "critical" : "warning",
        title: `Low seats: ${d.packageName}`,
        message: `Only ${Math.max(0, available)} seat(s) left for departure ${d.departureDate}.`,
        entityType: "departure",
        entityId: d.id,
      });
    }
  }

  // Overdue invoices.
  const overdueRows = await db.all<{ id: string; number: string; amount: number; dueDate: string }>(sql`
    SELECT id, number, balance_due AS amount, due_date AS dueDate
    FROM invoices
    WHERE balance_due > 0
      AND status NOT IN ('void', 'draft', 'paid')
      AND due_date IS NOT NULL
      AND due_date < date('now')
  `);
  for (const i of overdueRows) {
    candidates.push({
      id: `alert_overdue_${i.id}`,
      kind: "overdue_payment",
      severity: "warning",
      title: `Overdue invoice ${i.number}`,
      message: `Balance of ${i.amount} was due on ${i.dueDate}.`,
      entityType: "invoice",
      entityId: i.id,
    });
  }

  // Upcoming departures within 7 days.
  const upcomingRows = await db.all<{
    id: string;
    packageName: string;
    departureDate: string;
  }>(sql`
    SELECT d.id, p.name AS packageName, d.departure_date AS departureDate
    FROM departures d
    JOIN packages p ON p.id = d.package_id
    WHERE d.status NOT IN ('cancelled', 'closed')
      AND d.departure_date BETWEEN date('now') AND date('now', '+7 days')
  `);
  for (const d of upcomingRows) {
    candidates.push({
      id: `alert_upcoming_${d.id}`,
      kind: "upcoming_departure",
      severity: "info",
      title: `Upcoming: ${d.packageName}`,
      message: `Departure on ${d.departureDate} is within 7 days.`,
      entityType: "departure",
      entityId: d.id,
    });
  }

  if (candidates.length === 0) return 0;

  // Insert with id primary key → duplicate keys are ignored (dedup).
  let inserted = 0;
  for (const a of candidates) {
    const result = await db
      .insert(schema.alerts)
      .values(a)
      .onConflictDoNothing()
      .returning({ id: schema.alerts.id });
    if (result.length > 0) inserted++;
  }
  return inserted;
}

/** Mark one or all alerts as read. Returns the number updated. */
export async function markAlertsRead(
  db: DB,
  id?: string,
): Promise<number> {
  if (id) {
    const rows = await db
      .update(schema.alerts)
      .set({ isRead: true })
      .where(sql`${schema.alerts.id} = ${id} AND ${schema.alerts.isRead} = 0`)
      .returning({ id: schema.alerts.id });
    return rows.length;
  }
  const rows = await db
    .update(schema.alerts)
    .set({ isRead: true })
    .where(sql`${schema.alerts.isRead} = 0`)
    .returning({ id: schema.alerts.id });
  return rows.length;
}

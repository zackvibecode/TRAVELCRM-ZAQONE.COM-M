import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Booking Workspace — bookings, passengers, and booking history.
// Cloudflare D1 (SQLite) via Drizzle ORM.
//
// Status / payment enums are stored as text with application-level validation;
// SQLite has no native enum type. Keeping statuses separate (booking status
// vs. payment status) is a core requirement of the PRD.
// ---------------------------------------------------------------------------

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    reference: text("reference").notNull().unique(),
    customerId: text("customer_id").notNull(),
    packageId: text("package_id").notNull(),
    departureId: text("departure_id").notNull(),
    type: text("type", { enum: ["individual", "group"] }).notNull(),
    status: text("status", {
      enum: [
        "draft",
        "hold",
        "pending_deposit",
        "confirmed",
        "cancelled",
        "completed",
      ],
    })
      .notNull()
      .default("draft"),
    paymentStatus: text("payment_status", {
      enum: ["unpaid", "partial", "paid"],
    })
      .notNull()
      .default("unpaid"),
    paxAdult: integer("pax_adult").notNull().default(0),
    paxChild: integer("pax_child").notNull().default(0),
    paxInfant: integer("pax_infant").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    depositAmount: integer("deposit_amount").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    balanceDue: integer("balance_due").notNull().default(0),
    createdBy: text("created_by"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    statusIdx: index("bookings_status_idx").on(table.status),
    paymentStatusIdx: index("bookings_payment_status_idx").on(
      table.paymentStatus,
    ),
    departureIdx: index("bookings_departure_idx").on(table.departureId),
  }),
);

export const passengers = sqliteTable(
  "passengers",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    type: text("type", { enum: ["adult", "child", "infant"] }).notNull(),
    dateOfBirth: text("date_of_birth"),
    gender: text("gender", { enum: ["male", "female"] }),
    nationality: text("nationality"),
    passportNumber: text("passport_number"),
    passportExpiry: text("passport_expiry"),
    phone: text("phone"),
    roomType: text("room_type"),
    roomingNote: text("rooming_note"),
    dietaryNote: text("dietary_note"),
    flightInfo: text("flight_info"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    bookingIdx: index("passengers_booking_idx").on(table.bookingId),
    passportIdx: index("passengers_passport_idx").on(table.passportNumber),
  }),
);

export const bookingHistory = sqliteTable(
  "booking_history",
  {
    id: text("id").primaryKey(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    detail: text("detail"),
    user: text("user"),
    at: text("at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    bookingIdx: index("booking_history_booking_idx").on(table.bookingId),
    atIdx: index("booking_history_at_idx").on(table.at),
  }),
);

export type BookingRow = typeof bookings.$inferSelect;
export type NewBookingRow = typeof bookings.$inferInsert;
export type PassengerRow = typeof passengers.$inferSelect;
export type NewPassengerRow = typeof passengers.$inferInsert;
export type BookingHistoryRow = typeof bookingHistory.$inferSelect;
export type NewBookingHistoryRow = typeof bookingHistory.$inferInsert;

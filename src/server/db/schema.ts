import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

// ---------------------------------------------------------------------------
// Travel packages (Package Catalog). A package is a sellable trip product;
// departures reference packages and carry per-departure pricing/seat capacity.
// ---------------------------------------------------------------------------

export const packages = sqliteTable(
  "packages",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    destination: text("destination").notNull(),
    durationDays: integer("duration_days").notNull().default(0),
    description: text("description"),
    highlights: text("highlights", { mode: "json" }).$type<string[]>().notNull().default([]),
    itinerary: text("itinerary", { mode: "json" }).$type<string[]>().notNull().default([]),
    inclusions: text("inclusions", { mode: "json" }).$type<string[]>().notNull().default([]),
    exclusions: text("exclusions", { mode: "json" }).$type<string[]>().notNull().default([]),
    adultPrice: integer("adult_price").notNull().default(0),
    childPrice: integer("child_price").notNull().default(0),
    infantPrice: integer("infant_price").notNull().default(0),
    coverImageUrl: text("cover_image_url"),
    images: text("images", { mode: "json" }).$type<string[]>().notNull().default([]),
    pdfUrl: text("pdf_url"),
    featured: integer("featured", { mode: "boolean" })
      .notNull()
      .default(false),
    publishStatus: text("publish_status", {
      enum: ["draft", "published", "archived"],
    })
      .notNull()
      .default("draft"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    destinationIdx: index("packages_destination_idx").on(table.destination),
    publishStatusIdx: index("packages_publish_status_idx").on(
      table.publishStatus,
    ),
  }),
);

export type PackageRow = typeof packages.$inferSelect;
export type NewPackageRow = typeof packages.$inferInsert;

// ---------------------------------------------------------------------------
// Package pricing tiers. Allows multiple pricing variants per package
// (e.g. standard vs. peak season, or per-person vs. per-room), each carrying
// its own adult/child/infant amounts and validity window.
// ---------------------------------------------------------------------------

export const packagePricing = sqliteTable(
  "package_pricing",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    pricingType: text("pricing_type", {
      enum: ["per_person", "per_package", "per_room"],
    })
      .notNull()
      .default("per_person"),
    adultPrice: integer("adult_price").notNull().default(0),
    childPrice: integer("child_price").notNull().default(0),
    infantPrice: integer("infant_price").notNull().default(0),
    validFrom: text("valid_from"),
    validTo: text("valid_to"),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    packageIdx: index("package_pricing_package_idx").on(table.packageId),
    typeIdx: index("package_pricing_type_idx").on(table.pricingType),
    defaultIdx: index("package_pricing_default_idx").on(table.isDefault),
  }),
);

export type PackagePricingRow = typeof packagePricing.$inferSelect;
export type NewPackagePricingRow = typeof packagePricing.$inferInsert;

// ---------------------------------------------------------------------------
// Package itinerary (structured day-by-day) and media gallery (images/PDFs).
// ---------------------------------------------------------------------------

export const packageItineraryItems = sqliteTable(
  "package_itinerary_items",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    dayNumber: integer("day_number").notNull().default(1),
    title: text("title"),
    description: text("description"),
    mealIncluded: text("meal_included", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    packageIdx: index("package_itinerary_package_idx").on(table.packageId),
    dayIdx: index("package_itinerary_day_idx").on(table.dayNumber),
  }),
);

export type PackageItineraryItemRow = typeof packageItineraryItems.$inferSelect;
export type NewPackageItineraryItemRow = typeof packageItineraryItems.$inferInsert;

export const packageMedia = sqliteTable(
  "package_media",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["image", "pdf", "video", "other"] })
      .notNull()
      .default("image"),
    url: text("url").notNull(),
    alt: text("alt"),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    packageIdx: index("package_media_package_idx").on(table.packageId),
    kindIdx: index("package_media_kind_idx").on(table.kind),
  }),
);

export type PackageMediaRow = typeof packageMedia.$inferSelect;
export type NewPackageMediaRow = typeof packageMedia.$inferInsert;

// ---------------------------------------------------------------------------
// Package departure dates. A package can have many scheduled departures;
// this is the catalog-level schedule that drives the public "dates & seats"
// listing. Full seat inventory (booked/held) is tracked on the `departures`
// table once a date becomes operational.
// ---------------------------------------------------------------------------

export const packageDepartureDates = sqliteTable(
  "package_departure_dates",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    departureDate: text("departure_date").notNull(),
    returnDate: text("return_date"),
    seatCapacity: integer("seat_capacity").notNull().default(0),
    adultPrice: integer("adult_price").notNull().default(0),
    childPrice: integer("child_price").notNull().default(0),
    infantPrice: integer("infant_price").notNull().default(0),
    status: text("status", {
      enum: ["scheduled", "open", "almost_full", "full", "closed", "cancelled"],
    })
      .notNull()
      .default("scheduled"),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    packageIdx: index("package_departure_dates_package_idx").on(
      table.packageId,
    ),
    dateIdx: index("package_departure_dates_date_idx").on(table.departureDate),
    statusIdx: index("package_departure_dates_status_idx").on(table.status),
  }),
);

export type PackageDepartureDateRow = typeof packageDepartureDates.$inferSelect;
export type NewPackageDepartureDateRow = typeof packageDepartureDates.$inferInsert;

// ---------------------------------------------------------------------------
// Departures & seat inventory (referenced by bookings for seat release).
// The full seat-hold / overbooking machinery lives in the "Trips & Seats"
// feature; this minimal table is the target of seat deduction/release.
// ---------------------------------------------------------------------------

export const departures = sqliteTable(
  "departures",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id").notNull(),
    departureDate: text("departure_date").notNull(),
    returnDate: text("return_date"),
    seatCapacity: integer("seat_capacity").notNull().default(0),
    seatsBooked: integer("seats_booked").notNull().default(0),
    seatsHeld: integer("seats_held").notNull().default(0),
    adultPrice: integer("adult_price").notNull().default(0),
    childPrice: integer("child_price").notNull().default(0),
    infantPrice: integer("infant_price").notNull().default(0),
    status: text("status", {
      enum: ["open", "almost_full", "full", "closed", "cancelled"],
    })
      .notNull()
      .default("open"),
    tourLeader: text("tour_leader"),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    packageIdx: index("departures_package_idx").on(table.packageId),
    statusIdx: index("departures_status_idx").on(table.status),
  }),
);

export type DepartureRow = typeof departures.$inferSelect;
export type NewDepartureRow = typeof departures.$inferInsert;

// ---------------------------------------------------------------------------
// Temporary seat holds. A hold reserves seats for a fixed window (expiresAt);
// expired holds are released (either lazily on read or by a cron). Prevents
// overbooking by letting callers check `seatsBooked + seatsHeld` before
// committing a booking.
// ---------------------------------------------------------------------------

export const seatHolds = sqliteTable(
  "seat_holds",
  {
    id: text("id").primaryKey(),
    departureId: text("departure_id")
      .notNull()
      .references(() => departures.id, { onDelete: "cascade" }),
    bookingId: text("booking_id"),
    seatCount: integer("seat_count").notNull().default(1),
    heldBy: text("held_by"),
    status: text("status", { enum: ["active", "released", "converted"] })
      .notNull()
      .default("active"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    releasedAt: text("released_at"),
  },
  (table) => ({
    departureIdx: index("seat_holds_departure_idx").on(table.departureId),
    bookingIdx: index("seat_holds_booking_idx").on(table.bookingId),
    statusIdx: index("seat_holds_status_idx").on(table.status),
    expiresIdx: index("seat_holds_expires_idx").on(table.expiresAt),
  }),
);

export type SeatHoldRow = typeof seatHolds.$inferSelect;
export type NewSeatHoldRow = typeof seatHolds.$inferInsert;

// ---------------------------------------------------------------------------
// Passenger documents. Stores only metadata + an R2 object key; the binary
// file itself lives in Cloudflare R2 (not D1). Passport/visa data is sensitive
// and access must be authorized.
// ---------------------------------------------------------------------------

export const passengerDocuments = sqliteTable(
  "passenger_documents",
  {
    id: text("id").primaryKey(),
    passengerId: text("passenger_id")
      .notNull()
      .references(() => passengers.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["passport", "visa", "insurance", "other"],
    }).notNull(),
    name: text("name").notNull(),
    r2Key: text("r2_key").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes").notNull().default(0),
    expiresAt: text("expires_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    passengerIdx: index("passenger_documents_passenger_idx").on(
      table.passengerId,
    ),
    typeIdx: index("passenger_documents_type_idx").on(table.type),
  }),
);

export type PassengerDocumentRow = typeof passengerDocuments.$inferSelect;
export type NewPassengerDocumentRow = typeof passengerDocuments.$inferInsert;

// ---------------------------------------------------------------------------
// Trip preparation checklists. One row per (departure, checklist item), with a
// done flag. Supports the operational checklist shown per departure.
// ---------------------------------------------------------------------------

export const tripChecklistItems = sqliteTable(
  "trip_checklist_items",
  {
    id: text("id").primaryKey(),
    departureId: text("departure_id")
      .notNull()
      .references(() => departures.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    category: text("category"),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    departureIdx: index("trip_checklist_departure_idx").on(table.departureId),
  }),
);

export type TripChecklistItemRow = typeof tripChecklistItems.$inferSelect;
export type NewTripChecklistItemRow = typeof tripChecklistItems.$inferInsert;

// ---------------------------------------------------------------------------
// Rooming lists. Assigns passengers to rooms (room type, number, hotel) for a
// departure. One row per room; occupant passenger IDs stored as JSON array.
// ---------------------------------------------------------------------------

export const roomingAssignments = sqliteTable(
  "rooming_assignments",
  {
    id: text("id").primaryKey(),
    departureId: text("departure_id")
      .notNull()
      .references(() => departures.id, { onDelete: "cascade" }),
    roomNumber: text("room_number").notNull(),
    roomType: text("room_type"),
    hotelName: text("hotel_name"),
    passengerIds: text("passenger_ids", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    departureIdx: index("rooming_departure_idx").on(table.departureId),
  }),
);

export type RoomingAssignmentRow = typeof roomingAssignments.$inferSelect;
export type NewRoomingAssignmentRow = typeof roomingAssignments.$inferInsert;

// ---------------------------------------------------------------------------
// Trip flight / transport info per departure (airlines, routes, times).
// ---------------------------------------------------------------------------

export const tripFlights = sqliteTable(
  "trip_flights",
  {
    id: text("id").primaryKey(),
    departureId: text("departure_id")
      .notNull()
      .references(() => departures.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["flight", "transport", "other"] })
      .notNull()
      .default("flight"),
    code: text("code"),
    airline: text("airline"),
    origin: text("origin"),
    destination: text("destination"),
    departAt: text("depart_at"),
    arriveAt: text("arrive_at"),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    departureIdx: index("trip_flights_departure_idx").on(table.departureId),
  }),
);

export type TripFlightRow = typeof tripFlights.$inferSelect;
export type NewTripFlightRow = typeof tripFlights.$inferInsert;

// ---------------------------------------------------------------------------
// Supplier directory & trip cost / profit tracking.
// ---------------------------------------------------------------------------

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type", {
      enum: ["airline", "hotel", "transport", "ground_agent", "other"],
    }).notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    typeIdx: index("suppliers_type_idx").on(table.type),
  }),
);

export type SupplierRow = typeof suppliers.$inferSelect;
export type NewSupplierRow = typeof suppliers.$inferInsert;

export const departureCosts = sqliteTable(
  "departure_costs",
  {
    id: text("id").primaryKey(),
    departureId: text("departure_id")
      .notNull()
      .references(() => departures.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    description: text("description"),
    estimatedAmount: integer("estimated_amount").notNull().default(0),
    actualAmount: integer("actual_amount").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    departureIdx: index("departure_costs_departure_idx").on(table.departureId),
    supplierIdx: index("departure_costs_supplier_idx").on(table.supplierId),
  }),
);

export type DepartureCostRow = typeof departureCosts.$inferSelect;
export type NewDepartureCostRow = typeof departureCosts.$inferInsert;

export const supplierPayments = sqliteTable(
  "supplier_payments",
  {
    id: text("id").primaryKey(),
    departureId: text("departure_id")
      .notNull()
      .references(() => departures.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull().default(0),
    status: text("status", { enum: ["due", "paid"] })
      .notNull()
      .default("due"),
    dueDate: text("due_date"),
    paidAt: text("paid_at"),
    reference: text("reference"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    departureIdx: index("supplier_payments_departure_idx").on(
      table.departureId,
    ),
    supplierIdx: index("supplier_payments_supplier_idx").on(table.supplierId),
    statusIdx: index("supplier_payments_status_idx").on(table.status),
  }),
);

export type SupplierPaymentRow = typeof supplierPayments.$inferSelect;
export type NewSupplierPaymentRow = typeof supplierPayments.$inferInsert;

// ---------------------------------------------------------------------------
// CRM — customers, lead sources, and leads pipeline.
// A customer is a converted lead (or a direct booking contact); leads track
// the pre-sale pipeline with stage/source/assignment per the PRD.
// ---------------------------------------------------------------------------

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    type: text("type", { enum: ["individual", "corporate"] })
      .notNull()
      .default("individual"),
    city: text("city"),
    notes: text("notes"),
    leadId: text("lead_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    nameIdx: index("customers_name_idx").on(table.name),
    typeIdx: index("customers_type_idx").on(table.type),
  }),
);

export const leadSources = sqliteTable(
  "lead_sources",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    active: integer("active", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
);

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    destination: text("destination"),
    pax: integer("pax").notNull().default(1),
    budget: integer("budget").notNull().default(0),
    stage: text("stage", {
      enum: ["new", "contacted", "qualified", "quotation", "won", "lost"],
    })
      .notNull()
      .default("new"),
    sourceId: text("source_id"),
    assignedTo: text("assigned_to"),
    nextFollowUp: text("next_follow_up"),
    lastActivityAt: text("last_activity_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    notes: text("notes"),
    customerId: text("customer_id"),
    // --- WhatsApp Follow-Up CRM (Phase 6) additions ---
    /** Mandatory lead owner (owner_user_id per plan) — sales user id. */
    ownerUserId: text("owner_user_id").notNull(),
    /** Overall lead status for the follow-up CRM (new/responded/won/lost/paused). */
    followupStatus: text("followup_status", {
      enum: ["new", "responded", "won", "lost", "paused"],
    }),
    /** Three-stage engine state: active / paused / done / escalated. */
    followupState: text("followup_state", {
      enum: ["active", "paused", "done", "escalated"],
    }),
    /** Next scheduled follow-up instant (ISO 8601, Asia/Kuala_Lumpur based). */
    nextFollowupAt: text("next_followup_at"),
    /**
     * Current engine stage (FU1/FU2/FU3), denormalised from the latest
     * confirmed followup_activities row for fast per-stage queries. The
     * activities table remains the source of truth for advancement.
     */
    followupStage: text("followup_stage", {
      enum: ["FU1", "FU2", "FU3"],
    }),
    /** When the lead entered the current stage. */
    followupStageAt: text("followup_stage_at"),
    /** When the sequence was paused (null while running). */
    pausedAt: text("paused_at"),
    /** Optional reason for the last pause. */
    pauseReason: text("pause_reason"),
    /** When the lead was escalated for admin review after FU3. */
    escalatedAt: text("escalated_at"),
    /** Last time the sales rep made contact (drives auto-pause). */
    lastContactedAt: text("last_contacted_at"),
    /** When the whole sequence was completed / closed out. */
    followupCompletedAt: text("followup_completed_at"),
    /**
     * Normalized phone (digits only, +60-prefixed for Malaysian numbers) —
     * the duplicate-detection key for CSV/Excel import (Phase 6).
     */
    phoneNormalized: text("phone_normalized"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    stageIdx: index("leads_stage_idx").on(table.stage),
    sourceIdx: index("leads_source_idx").on(table.sourceId),
    assignedIdx: index("leads_assigned_idx").on(table.assignedTo),
    nextFollowUpIdx: index("leads_next_follow_up_idx").on(table.nextFollowUp),
    ownerIdx: index("leads_owner_idx").on(table.ownerUserId),
    followupStateIdx: index("leads_followup_state_idx").on(table.followupState),
    nextFollowupAtIdx: index("leads_next_followup_at_idx").on(table.nextFollowupAt),
    followupStageIdx: index("leads_followup_stage_idx").on(table.followupStage),
    ownerStageIdx: index("leads_owner_stage_idx").on(table.ownerUserId, table.followupStage),
    lastContactedIdx: index("leads_last_contacted_idx").on(table.lastContactedAt),
    phoneNormalizedIdx: index("leads_phone_normalized_idx").on(table.phoneNormalized),
    // Dashboard & Ranking (Phase 6): pipeline per owner by state + schedule.
    ownerStateNextIdx: index("leads_owner_state_next_idx").on(
      table.ownerUserId,
      table.followupState,
      table.nextFollowupAt,
    ),
    // "Won within period" outcome counts on the dashboard.
    followupCompletedAtIdx: index("leads_followup_completed_at_idx").on(table.followupCompletedAt),
  }),
);

export const leadActivities = sqliteTable(
  "lead_activities",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    type: text("type", {
      enum: [
        "note",
        "call",
        "whatsapp",
        "email",
        "stage_change",
        // Follow-up engine bookkeeping that is NOT a stage confirmation.
        "transfer",
        "pause",
        "resume",
        "postpone",
        "escalation",
        "review",
      ],
    }).notNull(),
    text: text("text").notNull(),
    user: text("user").notNull().default("system"),
    at: text("at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    leadIdx: index("lead_activities_lead_idx").on(table.leadId),
  }),
);

// Scheduled follow-up reminders per lead — the agent's to-do queue.
export const leadFollowUps = sqliteTable(
  "lead_follow_ups",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    dueAt: text("due_at").notNull(),
    channel: text("channel", {
      enum: ["whatsapp", "email", "call", "in_person"],
    })
      .notNull()
      .default("whatsapp"),
    note: text("note"),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    doneAt: text("done_at"),
    doneBy: text("done_by"),
    createdBy: text("created_by").notNull().default("system"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    leadIdx: index("lead_follow_ups_lead_idx").on(table.leadId),
    dueIdx: index("lead_follow_ups_due_idx").on(table.dueAt),
    doneIdx: index("lead_follow_ups_done_idx").on(table.done),
  }),
);

// ---------------------------------------------------------------------------
// WhatsApp Follow-Up CRM (Phase 6) — three-stage follow-up engine tables.
// FU1/FU2/FU3 scheduling with manual confirmation only (no auto-sending),
// per-lead notes, WhatsApp templates, and Excel/CSV import batches.
// ---------------------------------------------------------------------------

/** Configurable follow-up stages (FU1/FU2/FU3 defaults, admin-editable). */
export const followupStages = sqliteTable(
  "followup_stages",
  {
    id: text("id").primaryKey(),
    /** Stage code, e.g. FU1 / FU2 / FU3. */
    code: text("code").notNull().unique(),
    nameMs: text("name_ms").notNull(),
    nameEn: text("name_en").notNull(),
    /** Offset in days from the previous stage (or lead creation for FU1). */
    offsetDays: integer("offset_days").notNull().default(1),
    /** KL hour of day (0-23) when the stage becomes due. */
    dueHourKl: integer("due_hour_kl").notNull().default(10),
    /** Message template id used for this stage's WhatsApp message. */
    templateId: text("template_id"),
    /** Stage order for sorting (1 = FU1). */
    order: integer("order").notNull().default(1),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    orderIdx: index("followup_stages_order_idx").on(table.order),
  }),
);

/** Manual follow-up activities — completed only by sales confirmation. */
export const followupActivities = sqliteTable(
  "followup_activities",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    /** FU1 / FU2 / FU3 stage code this activity belongs to. */
    stage: text("stage", { enum: ["FU1", "FU2", "FU3"] }).notNull(),
    type: text("type", {
      enum: ["whatsapp", "call", "note", "stage_change", "pause", "resume", "escalation"],
    }).notNull(),
    text: text("text").notNull(),
    /** True only after manual sales confirmation (never auto). */
    confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
    user: text("user").notNull().default("system"),
    at: text("at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    leadIdx: index("followup_activities_lead_idx").on(table.leadId),
    /** One activity row per (lead, stage) — unique index per the plan. */
    leadStageUnique: uniqueIndex("followup_activities_lead_stage_unique").on(
      table.leadId,
      table.stage,
    ),
    atIdx: index("followup_activities_at_idx").on(table.at),
    // Dashboard & Ranking (Phase 6): confirmed follow-ups inside a date
    // window (trend) and the per-rep slice of that window (leaderboard).
    confirmedAtIdx: index("followup_activities_confirmed_at_idx").on(
      table.confirmed,
      table.at,
    ),
    userConfirmedAtIdx: index("followup_activities_user_confirmed_at_idx").on(
      table.user,
      table.confirmed,
      table.at,
    ),
  }),
);

/** Per-lead customer notes, readable by both sales and admin. */
export const customerNotes = sqliteTable(
  "customer_notes",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    text: text("text").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    leadIdx: index("customer_notes_lead_idx").on(table.leadId),
    createdIdx: index("customer_notes_created_idx").on(table.createdAt),
  }),
);

/** WhatsApp click-to-chat message templates (EN/MS, placeholder-based). */
export const whatsappTemplates = sqliteTable(
  "whatsapp_templates",
  {
    id: text("id").primaryKey(),
    /**
     * Logical template code (e.g. "fu1-intro"). Groups the EN and MS
     * variants of the same template; unique per locale, not globally.
     */
    code: text("code").notNull(),
    name: text("name").notNull(),
    /** Template body with {{placeholders}}; one row per locale. */
    locale: text("locale", { enum: ["en", "ms"] }).notNull(),
    body: text("body").notNull(),
    /** Stage this template serves (FU1/FU2/FU3) or free-form campaign. */
    stage: text("stage"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdBy: text("created_by"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    codeLocaleUnique: uniqueIndex("whatsapp_templates_code_locale_unique").on(table.code, table.locale),
    localeIdx: index("whatsapp_templates_locale_idx").on(table.locale),
    stageIdx: index("whatsapp_templates_stage_idx").on(table.stage),
  }),
);

/** One row per Excel/CSV import run with its summary counts. */
export const importBatches = sqliteTable(
  "import_batches",
  {
    id: text("id").primaryKey(),
    fileName: text("file_name").notNull(),
    /** Row counts: inserted / duplicate / failed / total. */
    totalRows: integer("total_rows").notNull().default(0),
    insertedRows: integer("inserted_rows").notNull().default(0),
    duplicateRows: integer("duplicate_rows").notNull().default(0),
    failedRows: integer("failed_rows").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    createdIdx: index("import_batches_created_idx").on(table.createdAt),
    creatorIdx: index("import_batches_creator_idx").on(table.createdBy),
  }),
);

/** Failed rows from an import batch, kept for correction & re-import. */
export const importErrors = sqliteTable(
  "import_errors",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull(),
    /** 1-based row number in the source file. */
    rowNumber: integer("row_number").notNull(),
    /** Raw row data (JSON) so the user can fix and re-import. */
    rawData: text("raw_data"),
    reason: text("reason").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    batchIdx: index("import_errors_batch_idx").on(table.batchId),
  }),
);

export type CustomerRow = typeof customers.$inferSelect;
export type NewCustomerRow = typeof customers.$inferInsert;
export type LeadSourceRow = typeof leadSources.$inferSelect;
export type NewLeadSourceRow = typeof leadSources.$inferInsert;
export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type LeadActivityRow = typeof leadActivities.$inferSelect;
export type NewLeadActivityRow = typeof leadActivities.$inferInsert;
export type LeadFollowUpRow = typeof leadFollowUps.$inferSelect;
export type NewLeadFollowUpRow = typeof leadFollowUps.$inferInsert;
export type FollowupStageRow = typeof followupStages.$inferSelect;
export type NewFollowupStageRow = typeof followupStages.$inferInsert;
export type FollowupActivityRow = typeof followupActivities.$inferSelect;
export type NewFollowupActivityRow = typeof followupActivities.$inferInsert;
export type CustomerNoteRow = typeof customerNotes.$inferSelect;
export type NewCustomerNoteRow = typeof customerNotes.$inferInsert;
export type WhatsappTemplateRow = typeof whatsappTemplates.$inferSelect;
export type NewWhatsappTemplateRow = typeof whatsappTemplates.$inferInsert;
export type ImportBatchRow = typeof importBatches.$inferSelect;
export type NewImportBatchRow = typeof importBatches.$inferInsert;
export type ImportErrorRow = typeof importErrors.$inferSelect;
export type NewImportErrorRow = typeof importErrors.$inferInsert;

// ---------------------------------------------------------------------------
// Billing & Payments — quotations, invoices, payments, reminders, refunds.
// Invoice numbering is unique; payment verification is a two-step flow
// (pending_verification → verified/rejected) per the PRD.
// ---------------------------------------------------------------------------

export const quotations = sqliteTable(
  "quotations",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone"),
    packageName: text("package_name"),
    destination: text("destination"),
    paxAdult: integer("pax_adult").notNull().default(0),
    paxChild: integer("pax_child").notNull().default(0),
    paxInfant: integer("pax_infant").notNull().default(0),
    departureDate: text("departure_date"),
    status: text("status", {
      enum: ["draft", "sent", "accepted", "rejected", "expired"],
    })
      .notNull()
      .default("draft"),
    validUntil: text("valid_until"),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull().default(0),
    leadId: text("lead_id"),
    createdBy: text("created_by"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    statusIdx: index("quotations_status_idx").on(table.status),
    leadIdx: index("quotations_lead_idx").on(table.leadId),
  }),
);

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    bookingId: text("booking_id"),
    quotationId: text("quotation_id"),
    customerId: text("customer_id"),
    customerName: text("customer_name").notNull(),
    packageName: text("package_name"),
    status: text("status", {
      enum: ["draft", "issued", "partially_paid", "paid", "overdue", "void"],
    })
      .notNull()
      .default("draft"),
    issueDate: text("issue_date"),
    dueDate: text("due_date"),
    subtotal: integer("subtotal").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull().default(0),
    depositAmount: integer("deposit_amount").notNull().default(0),
    paidAmount: integer("paid_amount").notNull().default(0),
    balanceDue: integer("balance_due").notNull().default(0),
    notes: text("notes"),
    createdBy: text("created_by"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    statusIdx: index("invoices_status_idx").on(table.status),
    customerIdx: index("invoices_customer_idx").on(table.customerId),
    bookingIdx: index("invoices_booking_idx").on(table.bookingId),
    dueIdx: index("invoices_due_idx").on(table.dueDate),
  }),
);

export const invoiceItems = sqliteTable(
  "invoice_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull(),
    quotationItemId: text("quotation_item_id"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: integer("unit_price").notNull().default(0),
    amount: integer("amount").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    invoiceIdx: index("invoice_items_invoice_idx").on(table.invoiceId),
  }),
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull(),
    amount: integer("amount").notNull(),
    method: text("method", {
      enum: ["bank_transfer", "credit_card", "cash", "ewallet", "other"],
    })
      .notNull()
      .default("bank_transfer"),
    status: text("status", {
      enum: ["pending_verification", "verified", "rejected"],
    })
      .notNull()
      .default("pending_verification"),
    paidAt: text("paid_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    verifiedBy: text("verified_by"),
    verifiedAt: text("verified_at"),
    proofKey: text("proof_key"),
    proofUploaded: integer("proof_uploaded", { mode: "boolean" })
      .notNull()
      .default(false),
    reference: text("reference"),
    notes: text("notes"),
    createdBy: text("created_by"),
  },
  (table) => ({
    invoiceIdx: index("payments_invoice_idx").on(table.invoiceId),
    statusIdx: index("payments_status_idx").on(table.status),
  }),
);

export const paymentReminders = sqliteTable(
  "payment_reminders",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull(),
    channel: text("channel", {
      enum: ["whatsapp", "email"],
    })
      .notNull()
      .default("whatsapp"),
    message: text("message").notNull(),
    sentAt: text("sent_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    sentBy: text("sent_by"),
  },
  (table) => ({
    invoiceIdx: index("payment_reminders_invoice_idx").on(table.invoiceId),
  }),
);

export const refunds = sqliteTable(
  "refunds",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    invoiceId: text("invoice_id").notNull(),
    paymentId: text("payment_id"),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    status: text("status", {
      enum: ["requested", "processing", "completed", "rejected"],
    })
      .notNull()
      .default("requested"),
    requestedAt: text("requested_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    processedAt: text("processed_at"),
    processedBy: text("processed_by"),
  },
  (table) => ({
    invoiceIdx: index("refunds_invoice_idx").on(table.invoiceId),
    statusIdx: index("refunds_status_idx").on(table.status),
  }),
);

export type QuotationRow = typeof quotations.$inferSelect;
export type NewQuotationRow = typeof quotations.$inferInsert;
export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;
export type InvoiceItemRow = typeof invoiceItems.$inferSelect;
export type NewInvoiceItemRow = typeof invoiceItems.$inferInsert;
export type PaymentRow = typeof payments.$inferSelect;
export type NewPaymentRow = typeof payments.$inferInsert;
export type PaymentReminderRow = typeof paymentReminders.$inferSelect;
export type NewPaymentReminderRow = typeof paymentReminders.$inferInsert;
export type RefundRow = typeof refunds.$inferSelect;
export type NewRefundRow = typeof refunds.$inferInsert;

// ---------------------------------------------------------------------------
// Audit log for sensitive trip/booking mutations.
// ---------------------------------------------------------------------------

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actor: text("actor"),
    role: text("role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    detail: text("detail"),
    at: text("at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    entityIdx: index("audit_logs_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    actorIdx: index("audit_logs_actor_idx").on(table.actor),
  }),
);

export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NewAuditLogRow = typeof auditLogs.$inferInsert;

// ---------------------------------------------------------------------------
// Dashboard alerts. Persisted notifications generated by the alert service
// (low seats, overdue payments, upcoming departures, new leads). Each alert
// is deduplicated by (entityType, entityId, kind) so cron runs are idempotent.
// ---------------------------------------------------------------------------
export const alerts = sqliteTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    kind: text("kind", {
      enum: ["low_seats", "overdue_payment", "upcoming_departure", "new_lead"],
    }).notNull(),
    severity: text("severity", {
      enum: ["info", "warning", "critical"],
    })
      .notNull()
      .default("info"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    isRead: integer("is_read", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    kindIdx: index("alerts_kind_idx").on(table.kind),
    entityIdx: index("alerts_entity_idx").on(table.entityType, table.entityId),
    readIdx: index("alerts_read_idx").on(table.isRead),
  }),
);

export type AlertRow = typeof alerts.$inferSelect;
export type NewAlertRow = typeof alerts.$inferInsert;

export type SitePageRow = typeof sitePages.$inferSelect;
export type NewSitePageRow = typeof sitePages.$inferInsert;
export type SiteBannerRow = typeof siteBanners.$inferSelect;
export type NewSiteBannerRow = typeof siteBanners.$inferInsert;
export type SiteSeoRow = typeof siteSeo.$inferSelect;
export type NewSiteSeoRow = typeof siteSeo.$inferInsert;

// ---------------------------------------------------------------------------
// MCP access tokens. AI clients authenticate with a bearer token; only a
// SHA-256 hash of the secret is stored at rest. Each token inherits a staff
// role and an explicit scope set; every call is written to mcp_audit_logs.
// ---------------------------------------------------------------------------
export const mcpTokens = sqliteTable(
  "mcp_tokens",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPreview: text("token_preview").notNull(),
    role: text("role", {
      enum: ["super_admin", "management", "sales", "finance", "operations"],
    }).notNull(),
    scopes: text("scopes", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    status: text("status", {
      enum: ["active", "revoked", "expired"],
    })
      .notNull()
      .default("active"),
    createdBy: text("created_by"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    lastUsedAt: text("last_used_at"),
    expiresAt: text("expires_at").notNull(),
    callsLast30d: integer("calls_last_30d").notNull().default(0),
  },
  (table) => ({
    hashIdx: index("mcp_tokens_hash_idx").on(table.tokenHash),
    statusIdx: index("mcp_tokens_status_idx").on(table.status),
  }),
);

export const mcpAuditLogs = sqliteTable(
  "mcp_audit_logs",
  {
    id: text("id").primaryKey(),
    tokenId: text("token_id"),
    tool: text("tool").notNull(),
    arguments: text("arguments"),
    outcome: text("outcome", { enum: ["success", "denied", "error"] }).notNull(),
    deniedReason: text("denied_reason"),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    tokenIdx: index("mcp_audit_token_idx").on(table.tokenId),
    toolIdx: index("mcp_audit_tool_idx").on(table.tool),
    createdIdx: index("mcp_audit_created_idx").on(table.createdAt),
  }),
);

export type McpTokenRow = typeof mcpTokens.$inferSelect;
export type NewMcpTokenRow = typeof mcpTokens.$inferInsert;
export type McpAuditLogRow = typeof mcpAuditLogs.$inferSelect;
export type NewMcpAuditLogRow = typeof mcpAuditLogs.$inferInsert;

// ---------------------------------------------------------------------------
// MCP rate limiting. Fixed-window counters keyed by token + minute bucket;
// Workers have no in-memory shared state across isolates, so the window
// counter lives in D1 and is pruned by the cron job.
// ---------------------------------------------------------------------------
export const mcpRateLimits = sqliteTable(
  "mcp_rate_limits",
  {
    id: text("id").primaryKey(),
    tokenId: text("token_id").notNull(),
    windowStart: text("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => ({
    tokenWindowIdx: index("mcp_rate_token_window_idx").on(
      table.tokenId,
      table.windowStart,
    ),
  }),
);

export type McpRateLimitRow = typeof mcpRateLimits.$inferSelect;
export type NewMcpRateLimitRow = typeof mcpRateLimits.$inferInsert;
// SEO metadata driving the public website. Enquiries from the public site are
// captured in `leads` (PRD: enquiry capture), so no separate table is needed.
// ---------------------------------------------------------------------------
export const sitePages = sqliteTable(
  "site_pages",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    scheduledAt: text("scheduled_at"),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    statusIdx: index("site_pages_status_idx").on(table.status),
  }),
);

export const siteBanners = sqliteTable(
  "site_banners",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default(""),
    ctaHref: text("cta_href").notNull().default("/site/packages"),
    startAt: text("start_at"),
    endAt: text("end_at"),
    active: integer("active", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    activeIdx: index("site_banners_active_idx").on(table.active),
  }),
);

export const siteSeo = sqliteTable(
  "site_seo",
  {
    slug: text("slug").primaryKey(),
    metaTitle: text("meta_title").notNull().default(""),
    metaDescription: text("meta_description").notNull().default(""),
    keywords: text("keywords").notNull().default(""),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
);
// ---------------------------------------------------------------------------
// Staff Access — Better Auth core tables (v1.7).
// Column names are camelCase to match Better Auth fieldName defaults for the
// Drizzle adapter. `role` is an additional user field driving the CRM RBAC.
// ---------------------------------------------------------------------------

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: integer("emailVerified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    role: text("role", {
      enum: ["super_admin", "management", "sales", "finance", "operations"],
    })
      .notNull()
      .default("sales"),
    status: text("status", { enum: ["active", "pending", "suspended"] })
      .notNull()
      .default("active"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    roleIdx: index("user_role_idx").on(table.role),
  }),
);

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ---------------------------------------------------------------------------
// Staff Access — auth audit log.
// Immutable trail of staff authentication and account events (sign-in,
// sign-out, failed attempts, role changes, invitations). Written by the auth
// middleware and staff API; never updated or deleted from application code.
// ---------------------------------------------------------------------------

export const staffAuditLogs = sqliteTable(
  "staff_audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    actorEmail: text("actor_email").notNull(),
    action: text("action", {
      enum: [
        "login",
        "logout",
        "login_failed",
        "password_reset_request",
        "password_reset_done",
        "role_change",
        "staff_invite",
        "staff_update",
        "staff_delete",
        "account_suspended",
        "account_reactivated",
      ],
    }).notNull(),
    detail: text("detail"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    outcome: text("outcome", { enum: ["success", "failed"] })
      .notNull()
      .default("success"),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("staff_audit_logs_user_idx").on(table.userId),
    actionIdx: index("staff_audit_logs_action_idx").on(table.action),
    createdAtIdx: index("staff_audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export type StaffAuditLogRow = typeof staffAuditLogs.$inferSelect;
export type NewStaffAuditLogRow = typeof staffAuditLogs.$inferInsert;

// ---------------------------------------------------------------------------
// System Settings — app settings (key/value), bank accounts, and document
// numbering rules. Written by the settings API; seeded with sane defaults.
// ---------------------------------------------------------------------------

export const appSettings = sqliteTable(
  "app_settings",
  {
    key: text("key").primaryKey(),
    value: text("value", { mode: "json" }).notNull(),
    updatedBy: text("updated_by"),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
);

export const bankAccounts = sqliteTable("bank_accounts", {
  id: text("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  accountNo: text("account_no").notNull(),
  holder: text("holder").notNull(),
  isDefault: integer("is_default", { mode: "boolean" })
    .notNull()
    .default(false),
  createdBy: text("created_by"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const numberingRules = sqliteTable("numbering_rules", {
  id: text("id").primaryKey(),
  doc: text("doc", {
    enum: ["booking", "invoice", "receipt", "quote", "credit_note"],
  }).notNull().unique(),
  prefix: text("prefix").notNull(),
  digits: integer("digits").notNull().default(6),
  nextNo: integer("next_no").notNull().default(1),
  resetOn: text("reset_on", {
    enum: ["never", "year", "month"],
  }).notNull().default("year"),
  lastResetAt: integer("last_reset_at", { mode: "timestamp" }),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type AppSettingRow = typeof appSettings.$inferSelect;
export type BankAccountRow = typeof bankAccounts.$inferSelect;
export type NumberingRuleRow = typeof numberingRules.$inferSelect;

// ---------------------------------------------------------------------------
// System Settings — external integration API tokens and settings-change audit
// trail. Token secrets are stored only as SHA-256 hashes; the plaintext is
// shown once at creation. Settings changes are immutable before/after records.
// ---------------------------------------------------------------------------

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPreview: text("token_preview").notNull(),
    createdBy: text("created_by"),
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull().default([]),
    status: text("status", { enum: ["active", "revoked", "expired"] })
      .notNull()
      .default("active"),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    statusIdx: index("api_tokens_status_idx").on(table.status),
  }),
);

export const settingsAuditLogs = sqliteTable(
  "settings_audit_logs",
  {
    id: text("id").primaryKey(),
    actor: text("actor"),
    role: text("role"),
    module: text("module").notNull(),
    field: text("field").notNull(),
    beforeValue: text("before_value"),
    afterValue: text("after_value"),
    changeType: text("change_type", {
      enum: ["updated", "created", "deleted"],
    }).notNull(),
    at: text("at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => ({
    moduleIdx: index("settings_audit_logs_module_idx").on(table.module),
    atIdx: index("settings_audit_logs_at_idx").on(table.at),
  }),
);

export type ApiTokenRow = typeof apiTokens.$inferSelect;
export type NewApiTokenRow = typeof apiTokens.$inferInsert;
export type SettingsAuditLogRow = typeof settingsAuditLogs.$inferSelect;

// ---------------------------------------------------------------------------
// System Settings — notification message templates (email & WhatsApp) with
// {{placeholder}} interpolation. Seeded with the three default CRM templates.
// ---------------------------------------------------------------------------

export const notificationTemplates = sqliteTable(
  "notification_templates",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    nameMs: text("name_ms").notNull(),
    nameEn: text("name_en").notNull(),
    channel: text("channel", { enum: ["email", "whatsapp"] }).notNull(),
    subject: text("subject").notNull().default(""),
    body: text("body").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    updatedBy: text("updated_by"),
    updatedAt: integer("updatedAt", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    channelIdx: index("notification_templates_channel_idx").on(table.channel),
  }),
);

export type NotificationTemplateRow = typeof notificationTemplates.$inferSelect;

// ---------------------------------------------------------------------------
// AI Assistant — persisted chat history. One conversation per staff member
// thread; every user/assistant message is stored so history survives reloads.
// ---------------------------------------------------------------------------

export const aiConversations = sqliteTable(
  "ai_conversations",
  {
    id: text("id").primaryKey(),
    staffId: text("staff_id").notNull(),
    title: text("title").notNull().default("New chat"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    staffIdx: index("ai_conversations_staff_idx").on(table.staffId),
  }),
);

export const aiMessages = sqliteTable(
  "ai_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    toolCalls: text("tool_calls", { mode: "json" }).$type<Array<Record<string, unknown>>>(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    conversationIdx: index("ai_messages_conversation_idx").on(table.conversationId),
  }),
);

export type AiConversationRow = typeof aiConversations.$inferSelect;
export type AiMessageRow = typeof aiMessages.$inferSelect;

// ---------------------------------------------------------------------------
// AI Workers — background automation runs (package enrichment, supplier PDF
// sync, price & margin checks). Each run is recorded so the AI Workers page
// can display results, diffs and history. PDF-sync runs stay `pending_review`
// until an admin applies or rejects the proposed diff.
// ---------------------------------------------------------------------------

export const aiWorkerRuns = sqliteTable(
  "ai_worker_runs",
  {
    id: text("id").primaryKey(),
    /** Which worker produced this run: enrich | pdf_sync | price_check */
    worker: text("worker", {
      enum: ["enrich", "pdf_sync", "price_check"],
    }).notNull(),
    /** running | done | failed | pending_review */
    status: text("status", {
      enum: ["running", "done", "failed", "pending_review"],
    }).notNull(),
    /** One-sentence human summary shown in the feed. */
    summary: text("summary").notNull().default(""),
    /** Worker-specific payload: enriched package list, diff proposal, margin report. */
    result: text("result", { mode: "json" }).$type<Record<string, unknown>>(),
    /** Optional package focus (e.g. the PDF-sync target package). */
    packageId: text("package_id"),
    /** Staff who triggered the run manually (null for cron runs). */
    staffId: text("staff_id"),
    /** Set when an admin applies a pending_review diff. */
    appliedAt: text("applied_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    workerCreatedIdx: index("ai_worker_runs_worker_created_idx").on(
      table.worker,
      table.createdAt,
    ),
    statusIdx: index("ai_worker_runs_status_idx").on(table.status),
  }),
);

export type AiWorkerRunRow = typeof aiWorkerRuns.$inferSelect;
export type NewAiWorkerRunRow = typeof aiWorkerRuns.$inferInsert;

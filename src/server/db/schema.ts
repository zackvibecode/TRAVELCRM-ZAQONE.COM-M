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
  }),
);

export const leadActivities = sqliteTable(
  "lead_activities",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    type: text("type", {
      enum: ["note", "call", "whatsapp", "email", "stage_change"],
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

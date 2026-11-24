export type BookingStatus =
  | "draft"
  | "hold"
  | "pending_deposit"
  | "confirmed"
  | "cancelled"
  | "completed";

export type PaymentStatus = "unpaid" | "partial" | "paid";

export type BookingType = "individual" | "group";

export type CustomerType = "individual" | "corporate";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: CustomerType;
  city?: string;
  joinedAt: string;
  notes?: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  /** Meal codes for the day, e.g. ["Breakfast", "Lunch", "Dinner"]. */
  meals?: string[];
}

export interface TravelPackage {
  id: string;
  name: string;
  destination: string;
  durationDays: number;
  description?: string;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  inclusions: string[];
  exclusions?: string[];
  highlights?: string[];
  itinerary?: ItineraryDay[];
  images?: string[];
  status?: "active" | "archived";
  published?: boolean;
}

export interface Departure {
  id: string;
  packageId: string;
  departureDate: string;
  returnDate: string;
  seatCapacity: number;
  seatsBooked: number;
  seatsHeld: number;
  adultPrice: number;
  childPrice: number;
  status: "open" | "almost_full" | "full" | "closed";
  tourLeader?: string;
  notes?: string;
}

export const departureStatusLabels: Record<Departure["status"], string> = {
  open: "Open",
  almost_full: "Almost Full",
  full: "Full",
  closed: "Closed",
};

export interface DepartureCost {
  id: string;
  departureId: string;
  category: string;
  description: string;
  estimatedAmount: number;
  actualAmount: number;
}

export interface Passenger {
  id: string;
  fullName: string;
  type: "adult" | "child" | "infant";
  dateOfBirth?: string;
  gender?: "male" | "female";
  nationality?: string;
  passportNumber?: string;
  passportExpiry?: string;
  phone?: string;
  roomType?: string;
  roomingNote?: string;
  dietaryNote?: string;
  flightInfo?: string;
}

export interface Booking {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  packageName: string;
  departureDate: string;
  type: BookingType;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paxAdult: number;
  paxChild: number;
  paxInfant: number;
  totalAmount: number;
  discount: number;
  depositAmount: number;
  paidAmount: number;
  balanceDue: number;
  passengers: Passenger[];
  createdAt: string;
  createdBy: string;
}

export const bookingStatusLabels: Record<BookingStatus, string> = {
  draft: "Draft",
  hold: "Hold",
  pending_deposit: "Pending Deposit",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
};

// Ordered booking status flow. Transitions move one step forward (or to
// cancelled/completed at the appropriate stage).
export const bookingStatusOrder: BookingStatus[] = [
  "draft",
  "hold",
  "pending_deposit",
  "confirmed",
  "completed",
];

// Allowed next statuses for each current status.
export const bookingTransitions: Record<BookingStatus, BookingStatus[]> = {
  draft: ["hold", "pending_deposit", "cancelled"],
  hold: ["pending_deposit", "cancelled", "draft"],
  pending_deposit: ["confirmed", "cancelled", "hold"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: ["draft"],
};

export interface BookingHistoryEvent {
  id: string;
  bookingId: string;
  action: string;
  detail: string;
  user: string;
  at: string;
}

// ---------------------------------------------------------------------------
// CRM — leads pipeline (Customers & Leads feature).
// Pipeline stages per PRD: New → Contacted → Qualified → Quotation → Won/Lost.
// ---------------------------------------------------------------------------

export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "quotation"
  | "won"
  | "lost";

export const LEAD_STAGES: { value: LeadStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "quotation", label: "Quotation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

export type LeadSource =
  | "website"
  | "whatsapp"
  | "instagram"
  | "referral"
  | "walk_in"
  | "campaign";

// ---------------------------------------------------------------------------
// Billing & Payments — invoices, payments, refunds.
// Booking status and payment status stay separate (PRD requirement).
// ---------------------------------------------------------------------------

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  number: string; // unique invoice number, e.g. INV-2026-0001
  bookingReference: string;
  customerName: string;
  packageName: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  /** Subtotal before discount (computed from items). */
  subtotal: number;
  discount: number;
  /** Total payable = subtotal - discount. */
  total: number;
  depositAmount: number;
  paidAmount: number;
  balanceDue: number;
  notes?: string;
  createdAt: string;
}

export type PaymentMethod =
  | "bank_transfer"
  | "credit_card"
  | "cash"
  | "ewallet"
  | "other";

export type PaymentRecordStatus =
  | "pending_verification"
  | "verified"
  | "rejected";

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  paidAt: string;
  verifiedBy?: string;
  proofUploaded: boolean;
  reference?: string;
  notes?: string;
}

export type RefundStatus = "requested" | "processing" | "completed" | "rejected";

export interface Refund {
  id: string;
  number: string; // e.g. CRN-2026-0001 (credit note)
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
  processedAt?: string;
}

// ---------------------------------------------------------------------------
// Quotations — pre-booking price proposals that can convert to bookings.
// ---------------------------------------------------------------------------

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface Quotation {
  id: string;
  number: string; // e.g. QTN-2026-0001
  customerName: string;
  customerPhone: string;
  packageName: string;
  destination: string;
  paxAdult: number;
  paxChild: number;
  paxInfant: number;
  departureDate: string;
  status: QuotationStatus;
  validUntil: string;
  subtotal: number;
  discount: number;
  total: number;
  createdBy: string;
  createdAt: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Payment reminders — sent for invoices due soon / overdue.
// ---------------------------------------------------------------------------

export type ReminderChannel = "whatsapp" | "email";

export interface PaymentReminder {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  channel: ReminderChannel;
  message: string;
  sentAt: string;
  sentBy: string;
}

export interface LeadActivity {
  id: string;
  at: string;
  type: "note" | "call" | "whatsapp" | "email" | "stage_change";
  text: string;
  user: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  destination: string;
  pax: number;
  budget: number;
  stage: LeadStage;
  source: LeadSource;
  assignedTo: string;
  nextFollowUp?: string;
  lastActivityAt: string;
  notes?: string;
  activities: LeadActivity[];
  createdAt: string;
}

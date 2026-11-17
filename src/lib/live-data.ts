/**
 * Live data layer — fetches business entities from the Cloudflare Worker (D1)
 * and maps the normalized DB rows onto the frontend types in @/lib/types.
 * Every loader falls back to mock data when the API is unreachable so pages
 * always render something.
 */
import { apiFetch } from "@/lib/api";
import {
  mockBookings,
  mockCustomers,
  mockDepartures,
  mockInvoices,
  mockPackages,
  mockPayments,
  mockQuotations,
  mockRefunds,
} from "@/lib/mock-data";
import type {
  Booking,
  Customer,
  Departure,
  Invoice,
  InvoiceItem,
  Payment,
  Quotation,
  Refund,
  TravelPackage,
} from "@/lib/types";

// ---------------------------------------------------------------- helpers

function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function iso(v: unknown): string {
  // DB rows use "YYYY-MM-DD HH:mm:ss" — normalise to ISO for the UI.
  return str(v).replace(" ", "T");
}
function parseJsonArray<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    let s = v.trim();
    // Seed data sometimes stores SQL-escaped literals like '["Sakura ..."]'.
    // Strip wrapping single quotes and doubled quotes before parsing.
    if (s.startsWith("'") && s.endsWith("'")) {
      s = s.slice(1, -1).replace(/''/g, "'");
    }
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? (parsed as T[]) : [parsed as T];
      } catch {
        return [];
      }
    }
    return s ? ([s] as T[]) : [];
  }
  return [];
}

// ---------------------------------------------------------------- packages

interface PackageRow {
  id: string;
  name: string;
  destination: string;
  durationDays: number;
  highlights: string | string[];
  itinerary: string | string[];
  inclusions: string | string[];
  exclusions: string | string[];
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  images: string | string[];
  publishStatus: string;
  featured: number | boolean;
}

function mapPackage(row: Record<string, unknown>): TravelPackage {
  const r = row as unknown as PackageRow;
  const itineraryStrings = parseJsonArray<string>(r.itinerary);
  return {
    id: r.id,
    name: r.name,
    destination: r.destination,
    durationDays: num(r.durationDays),
    adultPrice: num(r.adultPrice),
    childPrice: num(r.childPrice),
    infantPrice: num(r.infantPrice),
    inclusions: parseJsonArray<string>(r.inclusions),
    exclusions: parseJsonArray<string>(r.exclusions),
    highlights: parseJsonArray<string>(r.highlights),
    itinerary: itineraryStrings.map((s, i) => ({
      day: i + 1,
      title: s.split(" — ")[0] ?? s,
      description: s.split(" — ").slice(1).join(" — ") || s,
    })),
    images: parseJsonArray<string>(r.images),
    published: r.publishStatus === "published",
  };
}

export async function fetchPackages(): Promise<{
  packages: TravelPackage[];
  live: boolean;
}> {
  try {
    const res = await apiFetch<{ success: boolean; packages: Record<string, unknown>[] }>(
      "/packages?limit=200",
    );
    if (res.success && Array.isArray(res.packages) && res.packages.length > 0) {
      return { packages: res.packages.map(mapPackage), live: true };
    }
    if (res.success && Array.isArray(res.packages)) {
      return { packages: [], live: true };
    }
  } catch {
    // fall through to mock
  }
  return { packages: mockPackages, live: false };
}

// ---------------------------------------------------------------- departures

function mapDeparture(row: Record<string, unknown>): Departure {
  return {
    id: str(row.id),
    packageId: str(row.packageId),
    departureDate: str(row.departureDate),
    returnDate: str(row.returnDate),
    seatCapacity: num(row.seatCapacity),
    seatsBooked: num(row.seatsBooked),
    seatsHeld: num(row.seatsHeld),
    adultPrice: num(row.adultPrice),
    childPrice: num(row.childPrice),
    status: (row.status as Departure["status"]) ?? "open",
    tourLeader: row.tourLeader ? str(row.tourLeader) : undefined,
    notes: row.notes ? str(row.notes) : undefined,
  };
}

export async function fetchDepartures(): Promise<{
  departures: Departure[];
  live: boolean;
}> {
  try {
    const res = await apiFetch<{
      success: boolean;
      departures?: Record<string, unknown>[];
      months?: { departures?: Record<string, unknown>[] }[];
    }>("/departures/calendar");
    if (res.success) {
      // The API may return either `departures` or a grouped `months` shape.
      let rows: Record<string, unknown>[] = [];
      if (Array.isArray(res.departures)) rows = res.departures;
      else if (Array.isArray(res.months)) {
        rows = res.months.flatMap(
          (m) => (Array.isArray(m.departures) ? m.departures : []) as Record<string, unknown>[],
        );
      }
      return { departures: rows.map(mapDeparture), live: true };
    }
  } catch {
    // fall through
  }
  return { departures: mockDepartures, live: false };
}

// ---------------------------------------------------------------- customers

function mapCustomer(row: Record<string, unknown>): Customer {
  return {
    id: str(row.id),
    name: str(row.name),
    phone: str(row.phone),
    email: str(row.email),
    type: (row.type as Customer["type"]) ?? "individual",
    city: row.city ? str(row.city) : undefined,
    joinedAt: iso(row.createdAt).slice(0, 10) || str(row.joinedAt),
    notes: row.notes ? str(row.notes) : undefined,
  };
}

export async function fetchCustomers(): Promise<{
  customers: Customer[];
  live: boolean;
}> {
  try {
    const res = await apiFetch<{
      success: boolean;
      data?: Record<string, unknown>[];
      customers?: Record<string, unknown>[];
    }>("/customers?limit=200");
    if (res.success) {
      const rows = res.data ?? res.customers ?? [];
      if (Array.isArray(rows)) return { customers: rows.map(mapCustomer), live: true };
    }
  } catch {
    // fall through
  }
  return { customers: mockCustomers, live: false };
}

// ---------------------------------------------------------------- bookings

function mapBooking(
  row: Record<string, unknown>,
  customers: Customer[],
  packages: TravelPackage[],
  departures: Departure[],
): Booking {
  const customerId = str(row.customerId);
  const customer = customers.find((c) => c.id === customerId);
  const pkg = packages.find((p) => p.id === str(row.packageId));
  const dep = departures.find((d) => d.id === str(row.departureId));
  return {
    id: str(row.id),
    reference: str(row.reference),
    customerName: customer?.name ?? customerId,
    customerPhone: customer?.phone ?? "",
    packageName: pkg?.name ?? str(row.packageId),
    departureDate: dep?.departureDate ?? "",
    type: (row.type as Booking["type"]) ?? "individual",
    status: (row.status as Booking["status"]) ?? "draft",
    paymentStatus: (row.paymentStatus as Booking["paymentStatus"]) ?? "unpaid",
    paxAdult: num(row.paxAdult),
    paxChild: num(row.paxChild),
    paxInfant: num(row.paxInfant),
    totalAmount: num(row.totalAmount),
    discount: num(row.discount),
    depositAmount: num(row.depositAmount),
    paidAmount: num(row.paidAmount),
    balanceDue: num(row.balanceDue),
    passengers: [],
    createdAt: iso(row.createdAt),
    createdBy: str(row.createdBy),
  };
}

export async function fetchBookings(): Promise<{
  bookings: Booking[];
  live: boolean;
}> {
  try {
    const [bookingsRes, customersRes, packagesRes, departuresRes] = await Promise.all([
      apiFetch<{ success: boolean; bookings?: Record<string, unknown>[] }>(
        "/bookings?limit=200",
      ),
      fetchCustomers(),
      fetchPackages(),
      fetchDepartures(),
    ]);
    if (bookingsRes.success && Array.isArray(bookingsRes.bookings)) {
      const bookings = bookingsRes.bookings.map((row) =>
        mapBooking(row, customersRes.customers, packagesRes.packages, departuresRes.departures),
      );
      if (bookingsRes.bookings.length > 0 || customersRes.live) {
        return { bookings, live: true };
      }
    }
  } catch {
    // fall through
  }
  return { bookings: mockBookings, live: false };
}

// ---------------------------------------------------------------- invoices

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: str(row.id),
    number: str(row.number),
    bookingReference: str(row.bookingReference ?? row.bookingId),
    customerName: str(row.customerName),
    packageName: str(row.packageName),
    status: (row.status as Invoice["status"]) ?? "draft",
    issueDate: iso(row.issueDate).slice(0, 10),
    dueDate: iso(row.dueDate).slice(0, 10),
    items: parseJsonArray<InvoiceItem>(row.items),
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    total: num(row.total),
    depositAmount: num(row.depositAmount),
    paidAmount: num(row.paidAmount),
    balanceDue: num(row.balanceDue),
    notes: row.notes ? str(row.notes) : undefined,
    createdAt: iso(row.createdAt),
  };
}

export async function fetchInvoices(): Promise<{
  invoices: Invoice[];
  live: boolean;
}> {
  try {
    const res = await apiFetch<{
      success: boolean;
      invoices?: Record<string, unknown>[];
      data?: Record<string, unknown>[];
    }>("/invoices?limit=200");
    if (res.success) {
      const rows = res.invoices ?? res.data ?? [];
      if (Array.isArray(rows)) return { invoices: rows.map(mapInvoice), live: true };
    }
  } catch {
    // fall through
  }
  return { invoices: mockInvoices, live: false };
}

// ---------------------------------------------------------------- payments

function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: str(row.id),
    invoiceId: str(row.invoiceId),
    invoiceNumber: str(row.invoiceNumber),
    customerName: str(row.customerName),
    amount: num(row.amount),
    method: (row.method as Payment["method"]) ?? "bank_transfer",
    status: (row.status as Payment["status"]) ?? "pending_verification",
    paidAt: iso(row.paidAt),
    verifiedBy: row.verifiedBy ? str(row.verifiedBy) : undefined,
    proofUploaded: Boolean(row.proofUploaded),
    reference: row.reference ? str(row.reference) : undefined,
    notes: row.notes ? str(row.notes) : undefined,
  };
}

export async function fetchPayments(): Promise<{
  payments: Payment[];
  live: boolean;
}> {
  try {
    const res = await apiFetch<{
      success: boolean;
      payments?: Record<string, unknown>[];
      data?: Record<string, unknown>[];
    }>("/payments?limit=200");
    if (res.success) {
      const rows = res.payments ?? res.data ?? [];
      if (Array.isArray(rows)) return { payments: rows.map(mapPayment), live: true };
    }
  } catch {
    // fall through
  }
  return { payments: mockPayments, live: false };
}

// ---------------------------------------------------------------- refunds

function mapRefund(row: Record<string, unknown>): Refund {
  return {
    id: str(row.id),
    number: str(row.number),
    invoiceId: str(row.invoiceId),
    invoiceNumber: str(row.invoiceNumber),
    customerName: str(row.customerName),
    amount: num(row.amount),
    reason: str(row.reason),
    status: (row.status as Refund["status"]) ?? "requested",
    requestedAt: iso(row.requestedAt),
    processedAt: row.processedAt ? iso(row.processedAt) : undefined,
  };
}

export async function fetchRefunds(): Promise<{
  refunds: Refund[];
  live: boolean;
}> {
  try {
    const res = await apiFetch<{
      success: boolean;
      refunds?: Record<string, unknown>[];
      data?: Record<string, unknown>[];
    }>("/refunds?limit=200");
    if (res.success) {
      const rows = res.refunds ?? res.data ?? [];
      if (Array.isArray(rows)) return { refunds: rows.map(mapRefund), live: true };
    }
  } catch {
    // fall through
  }
  return { refunds: mockRefunds, live: false };
}

// ---------------------------------------------------------------- quotations

function mapQuotation(row: Record<string, unknown>): Quotation {
  return {
    id: str(row.id),
    number: str(row.number),
    customerName: str(row.customerName),
    customerPhone: str(row.customerPhone),
    packageName: str(row.packageName),
    destination: str(row.destination),
    paxAdult: num(row.paxAdult),
    paxChild: num(row.paxChild),
    paxInfant: num(row.paxInfant),
    departureDate: iso(row.departureDate).slice(0, 10),
    status: (row.status as Quotation["status"]) ?? "draft",
    validUntil: iso(row.validUntil).slice(0, 10),
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    total: num(row.total),
    createdBy: str(row.createdBy),
    createdAt: iso(row.createdAt),
    notes: row.notes ? str(row.notes) : undefined,
  };
}

export async function fetchQuotations(): Promise<{
  quotations: Quotation[];
  live: boolean;
}> {
  try {
    const res = await apiFetch<{
      success: boolean;
      quotations?: Record<string, unknown>[];
      data?: Record<string, unknown>[];
    }>("/quotations?limit=200");
    if (res.success) {
      const rows = res.quotations ?? res.data ?? [];
      if (Array.isArray(rows)) return { quotations: rows.map(mapQuotation), live: true };
    }
  } catch {
    // fall through
  }
  return { quotations: mockQuotations, live: false };
}

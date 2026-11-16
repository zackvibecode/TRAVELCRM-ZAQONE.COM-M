export type BookingStatus =
  | "draft"
  | "hold"
  | "pending_deposit"
  | "confirmed"
  | "cancelled"
  | "completed";

export type PaymentStatus = "unpaid" | "partial" | "paid";

export type BookingType = "individual" | "group";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export interface TravelPackage {
  id: string;
  name: string;
  destination: string;
  durationDays: number;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  inclusions: string[];
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

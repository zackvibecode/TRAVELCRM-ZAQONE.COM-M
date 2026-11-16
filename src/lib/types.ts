export type BookingStatus =
  | "draft"
  | "hold"
  | "pending_deposit"
  | "confirmed"
  | "cancelled"
  | "completed";

export type PaymentStatus = "unpaid" | "partial" | "paid";

export type BookingType = "individual" | "group";

export interface Passenger {
  id: string;
  fullName: string;
  type: "adult" | "child" | "infant";
  nationality?: string;
  passportNumber?: string;
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

export type BookingStatus =
  | "draft"
  | "hold"
  | "pending_deposit"
  | "confirmed"
  | "cancelled"
  | "completed";

export const BOOKING_STATUSES: BookingStatus[] = [
  "draft",
  "hold",
  "pending_deposit",
  "confirmed",
  "cancelled",
  "completed",
];

/**
 * Legal status transitions. A booking cannot skip directly from `draft` to
 * `completed`, for example; it must follow the workflow. `cancelled` is a
 * terminal state reachable from most active states.
 */
export const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  draft: ["hold", "pending_deposit", "confirmed", "cancelled"],
  hold: ["pending_deposit", "confirmed", "cancelled"],
  pending_deposit: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  cancelled: [],
  completed: [],
};

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

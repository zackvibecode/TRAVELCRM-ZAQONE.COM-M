import type { BookingStatus, PaymentStatus } from "@/lib/types";
import { bookingStatusLabels, paymentStatusLabels } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function statusBadgeVariant(
  status: BookingStatus,
): "success" | "warning" | "info" | "destructive" | "secondary" | "outline" {
  switch (status) {
    case "confirmed":
      return "success";
    case "pending_deposit":
      return "warning";
    case "hold":
      return "info";
    case "cancelled":
      return "destructive";
    case "completed":
      return "secondary";
    default:
      return "outline";
  }
}

export function paymentBadgeVariant(
  status: PaymentStatus,
): "success" | "warning" | "outline" {
  switch (status) {
    case "paid":
      return "success";
    case "partial":
      return "warning";
    default:
      return "outline";
  }
}

export function BookingStatusBadge({
  status,
}: {
  status: BookingStatus;
}) {
  return (
    <Badge variant={statusBadgeVariant(status)}>
      {bookingStatusLabels[status]}
    </Badge>
  );
}

export function PaymentStatusBadge({
  status,
}: {
  status: PaymentStatus;
}) {
  return (
    <Badge variant={paymentBadgeVariant(status)}>
      {paymentStatusLabels[status]}
    </Badge>
  );
}

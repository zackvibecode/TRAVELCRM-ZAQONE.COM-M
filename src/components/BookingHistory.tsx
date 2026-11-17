import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { BookingHistoryEvent } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import {
  FilePlus2,
  CreditCard,
  BadgeCheck,
  Percent,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const actionMeta: Record<
  string,
  { label: string; icon: LucideIcon; className: string }
> = {
  created: {
    label: "Created",
    icon: FilePlus2,
    className: "bg-sky-100 text-sky-700",
  },
  status_changed: {
    label: "Status changed",
    icon: CheckCircle2,
    className: "bg-violet-100 text-violet-700",
  },
  payment_verified: {
    label: "Payment verified",
    icon: CreditCard,
    className: "bg-emerald-100 text-emerald-700",
  },
  discount_applied: {
    label: "Discount applied",
    icon: Percent,
    className: "bg-amber-100 text-amber-700",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-red-100 text-red-700",
  },
};

function HistoryIcon({ action }: { action: string }) {
  const meta = actionMeta[action] ?? {
    label: action,
    icon: BadgeCheck,
    className: "bg-muted text-muted-foreground",
  };
  const Icon = meta.icon;
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.className}`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export default function BookingHistory({
  bookingId,
}: {
  bookingId: string;
}) {
  const [events, setEvents] = useState<BookingHistoryEvent[]>([]);

  // Live history from D1 via GET /bookings/:id.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{
          success: boolean;
          history?: Record<string, unknown>[];
        }>(`/bookings/${bookingId}`);
        if (res.success && Array.isArray(res.history)) {
          setEvents(
            res.history.map((h) => ({
              id: String(h.id),
              bookingId: String(h.bookingId ?? bookingId),
              action: String(h.action),
              detail: String(h.detail ?? ""),
              user: String(h.user ?? h.actor ?? "—"),
              at: String(h.at ?? ""),
            })) as BookingHistoryEvent[],
          );
        }
      } catch {
        // riwayat pilihan
      }
    })();
  }, [bookingId]);

  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));

  if (sorted.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
        No history recorded yet.
      </p>
    );
  }

  return (
    <div className="grid gap-0">
      {sorted.map((event, i) => (
        <TimelineItem
          key={event.id}
          event={event}
          isLast={i === events.length - 1}
        />
      ))}
    </div>
  );
}

function TimelineItem({
  event,
  isLast,
}: {
  event: BookingHistoryEvent;
  isLast: boolean;
}) {
  const meta = actionMeta[event.action];
  return (
    <div className="relative flex gap-3 pb-5">
      {!isLast && (
        <span className="absolute left-4 top-8 h-full w-px bg-border" />
      )}
      <HistoryIcon action={event.action} />
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">
            {meta?.label ?? event.action}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(event.at)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{event.detail}</p>
        <p className="text-xs text-muted-foreground/70">by {event.user}</p>
      </div>
    </div>
  );
}

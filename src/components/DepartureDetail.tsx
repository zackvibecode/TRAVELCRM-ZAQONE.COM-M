import { mockPackages } from "@/lib/mock-data";
import {
  departureStatusLabels,
  type Departure,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import PassengerManifest from "@/components/PassengerManifest";
import TripPrepChecklist from "@/components/TripPrepChecklist";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DepartureDetailProps {
  departure: Departure | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function departureBadgeVariant(
  status: Departure["status"],
): "success" | "warning" | "destructive" | "outline" {
  switch (status) {
    case "open":
      return "success";
    case "almost_full":
      return "warning";
    case "full":
      return "destructive";
    default:
      return "outline";
  }
}

export default function DepartureDetail({
  departure,
  open,
  onOpenChange,
}: DepartureDetailProps) {
  if (!departure) return null;

  const pkg = mockPackages.find((p) => p.id === departure.packageId);
  const booked = departure.seatsBooked;
  const held = departure.seatsHeld;
  const available = Math.max(
    0,
    departure.seatCapacity - booked - held,
  );
  const occupancy = Math.round(
    ((booked + held) / departure.seatCapacity) * 100,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pkg?.name ?? "Unknown package"}
            <Badge variant={departureBadgeVariant(departure.status)}>
              {departureStatusLabels[departure.status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {pkg?.destination ?? ""}
          </DialogDescription>
        </DialogHeader>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Departure</div>
            <div className="font-medium">
              {formatDate(departure.departureDate)}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Return</div>
            <div className="font-medium">
              {formatDate(departure.returnDate)}
            </div>
          </div>
        </div>

        {/* Tour leader */}
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Tour leader</div>
          <div className="font-medium">{departure.tourLeader ?? "—"}</div>
        </div>

        {/* Seat summary */}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-semibold">Seat Summary</h3>
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>{occupancy}% occupied</span>
              <span>
                {booked + held} / {departure.seatCapacity} seats
              </span>
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="bg-primary"
                style={{ width: `${(booked / departure.seatCapacity) * 100}%` }}
              />
              <div
                className="bg-amber-400"
                style={{ width: `${(held / departure.seatCapacity) * 100}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-primary/5 p-3">
              <div className="text-2xl font-bold text-primary">{booked}</div>
              <div className="text-xs text-muted-foreground">Booked</div>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <div className="text-2xl font-bold text-amber-600">{held}</div>
              <div className="text-xs text-muted-foreground">Held</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="text-2xl font-bold text-emerald-600">
                {available}
              </div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-semibold">Pricing</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Adult</span>
              <span>{formatCurrency(departure.adultPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Child</span>
              <span>{formatCurrency(departure.childPrice)}</span>
            </div>
          </div>
        </div>

        {/* Passenger manifest */}
        <div className="rounded-lg border p-4">
          <PassengerManifest departure={departure} />
        </div>

        {/* Trip prep checklist */}
        <div className="rounded-lg border p-4">
          <TripPrepChecklist />
        </div>

        {/* Notes */}
        {departure.notes && (
          <div className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">Notes</div>
            <div className="text-sm">{departure.notes}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

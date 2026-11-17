import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, ArrowRight, Ban } from "lucide-react";
import type { Booking, BookingStatus, Passenger } from "@/lib/types";
import { bookingTransitions } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { fetchPackages } from "@/lib/live-data";
import PriceSummaryPanel from "@/components/PriceSummaryPanel";
import BookingHistory from "@/components/BookingHistory";
import CancellationDialog from "@/components/CancellationDialog";
import { BookingStatusBadge, PaymentStatusBadge } from "@/components/StatusBadges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BookingDetailProps {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const passengerTypeLabel: Record<Passenger["type"], string> = {
  adult: "Adult",
  child: "Child",
  infant: "Infant",
};

export default function BookingDetail({
  booking,
  open,
  onOpenChange,
}: BookingDetailProps) {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Passenger | null>(null);
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [packages, setPackages] = useState<Awaited<ReturnType<typeof fetchPackages>>["packages"]>([]);

  // Live packages from D1 for unit-price lookup (falls back to mock in loader).
  useEffect(() => {
    (async () => {
      const res = await fetchPackages();
      setPackages(res.packages);
    })();
  }, []);

  // Sync local passenger list + status whenever a booking is opened.
  const [syncedBookingId, setSyncedBookingId] = useState<string | null>(null);
  if (booking && booking.id !== syncedBookingId) {
    setPassengers(booking.passengers);
    setStatus(booking.status);
    setSyncedBookingId(booking.id);
    setEditingId(null);
    setDraft(null);
  }

  if (!booking) return null;

  function startEdit(p: Passenger) {
    setEditingId(p.id);
    setDraft({ ...p });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function saveEdit() {
    if (!draft) return;
    setPassengers((prev) =>
      prev.map((p) => (p.id === draft.id ? draft : p)),
    );
    setEditingId(null);
    setDraft(null);
  }

  function addPassenger() {
    const p: Passenger = {
      id: `new-${Date.now()}`,
      fullName: "",
      type: "adult",
    };
    setPassengers((prev) => [...prev, p]);
    startEdit(p);
  }

  function removePassenger(id: string) {
    setPassengers((prev) => prev.filter((p) => p.id !== id));
    if (editingId === id) cancelEdit();
  }

  function setDraftField(field: keyof Passenger, value: string) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-base">{booking.reference}</span>
            <BookingStatusBadge status={status ?? booking.status} />
            <PaymentStatusBadge status={booking.paymentStatus} />
          </DialogTitle>
          <DialogDescription>
            {booking.customerName} · {booking.packageName} ·{" "}
            {formatDate(booking.departureDate)}
          </DialogDescription>
        </DialogHeader>

        {/* Status transition controls */}
        <StatusTransition
          current={status ?? booking.status}
          onTransition={(next) => setStatus(next)}
          onCancel={() => setCancelOpen(true)}
        />

        {/* Price & discount summary */}
        <PriceSummaryPanel
          booking={booking}
          unitPrices={(() => {
            const pkg = packages.find(
              (p) => p.name === booking.packageName,
            );
            return pkg
              ? {
                  adult: pkg.adultPrice,
                  child: pkg.childPrice,
                  infant: pkg.infantPrice,
                }
              : undefined;
          })()}
        />

        {/* Passengers */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">
              Passengers ({passengers.length})
            </Label>
            <Button variant="outline" size="sm" onClick={addPassenger}>
              <Plus className="h-3.5 w-3.5" />
              Add passenger
            </Button>
          </div>

          {passengers.length === 0 && (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No passengers added yet.
            </p>
          )}

          {passengers.map((p) =>
            editingId === p.id && draft ? (
              <PassengerEditForm
                key={p.id}
                draft={draft}
                onChange={setDraftField}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
            ) : (
              <PassengerRow
                key={p.id}
                passenger={p}
                onEdit={() => startEdit(p)}
                onRemove={() => removePassenger(p.id)}
              />
            ),
          )}
        </div>

        {/* History timeline */}
        <div className="grid gap-3">
          <Label className="text-base font-semibold">History</Label>
          <BookingHistory bookingId={booking.id} />
        </div>
      </DialogContent>

      <CancellationDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        bookingReference={booking.reference}
        onConfirm={() => setStatus("cancelled")}
      />
    </Dialog>
  );
}

function PassengerRow({
  passenger,
  onEdit,
  onRemove,
}: {
  passenger: Passenger;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {passenger.fullName || "(Unnamed)"}
          </span>
          <Badge variant="secondary">
            {passengerTypeLabel[passenger.type]}
          </Badge>
          {passenger.gender && (
            <span className="text-xs capitalize text-muted-foreground">
              {passenger.gender}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {passenger.nationality && (
            <span>Nationality: {passenger.nationality}</span>
          )}
          {passenger.passportNumber && (
            <span>Passport: {passenger.passportNumber}</span>
          )}
          {passenger.passportExpiry && (
            <span>Expiry: {formatDate(passenger.passportExpiry)}</span>
          )}
          {passenger.roomType && <span>Room: {passenger.roomType}</span>}
          {passenger.dietaryNote && (
            <span>Diet: {passenger.dietaryNote}</span>
          )}
          {passenger.flightInfo && <span>Flight: {passenger.flightInfo}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          title="Remove"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function PassengerEditForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Passenger;
  onChange: (field: keyof Passenger, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="grid gap-3">
        <div className="grid gap-1.5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Full name</Label>
            <Input
              value={draft.fullName}
              onChange={(e) => onChange("fullName", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select
              value={draft.type}
              onValueChange={(v) => onChange("type", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adult">Adult</SelectItem>
                <SelectItem value="child">Child</SelectItem>
                <SelectItem value="infant">Infant</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Date of birth</Label>
            <Input
              type="date"
              value={draft.dateOfBirth ?? ""}
              onChange={(e) => onChange("dateOfBirth", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Gender</Label>
            <Select
              value={draft.gender ?? "none"}
              onValueChange={(v) =>
                onChange("gender", v === "none" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Nationality</Label>
            <Input
              value={draft.nationality ?? ""}
              onChange={(e) => onChange("nationality", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Phone</Label>
            <Input
              value={draft.phone ?? ""}
              onChange={(e) => onChange("phone", e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Passport number</Label>
            <Input
              value={draft.passportNumber ?? ""}
              onChange={(e) => onChange("passportNumber", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Passport expiry</Label>
            <Input
              type="date"
              value={draft.passportExpiry ?? ""}
              onChange={(e) => onChange("passportExpiry", e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Room type</Label>
            <Input
              value={draft.roomType ?? ""}
              onChange={(e) => onChange("roomType", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Flight info</Label>
            <Input
              value={draft.flightInfo ?? ""}
              onChange={(e) => onChange("flightInfo", e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Dietary note</Label>
          <Input
            value={draft.dietaryNote ?? ""}
            onChange={(e) => onChange("dietaryNote", e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button size="sm" onClick={onSave}>
            <Check className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusTransition({
  current,
  onTransition,
  onCancel,
}: {
  current: BookingStatus;
  onTransition: (next: BookingStatus) => void;
  onCancel: () => void;
}) {
  const next = bookingTransitions[current] ?? [];
  const canCancel =
    current !== "cancelled" && current !== "completed";

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Booking Status</h3>
        <span className="text-xs text-muted-foreground">
          {next.length === 0 ? "No further transitions" : "Choose next status"}
        </span>
      </div>

      {next.length === 0 && !canCancel ? (
        <p className="text-xs text-muted-foreground">
          This booking has reached a terminal status.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {next.map((s) => (
            <Button
              key={s}
              variant="outline"
              size="sm"
              onClick={() => onTransition(s)}
              className="group"
            >
              <span className="font-medium">Move to</span>
              <span className="capitalize text-primary">
                {s.replace(/_/g, " ")}
              </span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          ))}
          {canCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-destructive hover:text-destructive"
            >
              <Ban className="h-3.5 w-3.5" />
              Cancel booking
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

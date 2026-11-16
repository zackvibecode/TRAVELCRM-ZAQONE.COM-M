import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  mockCustomers,
  mockDepartures,
  mockPackages,
} from "@/lib/mock-data";
import type { BookingType, Passenger } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface CreateBookingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: unknown) => void;
}

type PaxCounts = { adult: number; child: number; infant: number };

const emptyPax: PaxCounts = { adult: 1, child: 0, infant: 0 };

export default function CreateBookingForm({
  open,
  onOpenChange,
  onSubmit,
}: CreateBookingFormProps) {
  const [bookingType, setBookingType] = useState<BookingType>("individual");
  const [customerId, setCustomerId] = useState<string>("");
  const [packageId, setPackageId] = useState<string>("");
  const [departureId, setDepartureId] = useState<string>("");
  const [pax, setPax] = useState<PaxCounts>(emptyPax);
  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  const selectedPackage = mockPackages.find((p) => p.id === packageId);
  const selectedDeparture = mockDepartures.find(
    (d) => d.id === departureId,
  );
  const availableDepartures = useMemo(
    () => mockDepartures.filter((d) => d.packageId === packageId),
    [packageId],
  );

  const totalPax = pax.adult + pax.child + pax.infant;

  const seatsAvailable = selectedDeparture
    ? selectedDeparture.seatCapacity -
      selectedDeparture.seatsBooked -
      selectedDeparture.seatsHeld
    : 0;

  const seatsExceeded =
    selectedDeparture !== undefined && totalPax > seatsAvailable;

  const subtotal = useMemo(() => {
    if (!selectedPackage) return 0;
    return (
      pax.adult * selectedPackage.adultPrice +
      pax.child * selectedPackage.childPrice +
      pax.infant * selectedPackage.infantPrice
    );
  }, [selectedPackage, pax]);

  const totalAmount = Math.max(0, subtotal - discount);
  const balanceDue = Math.max(0, totalAmount - deposit);

  function resetForm() {
    setBookingType("individual");
    setCustomerId("");
    setPackageId("");
    setDepartureId("");
    setPax(emptyPax);
    setDiscount(0);
    setDeposit(0);
    setPassengers([]);
  }

  function setPaxField(field: keyof PaxCounts, value: number) {
    setPax((prev) => ({ ...prev, [field]: Math.max(0, value) }));
  }

  function addPassenger() {
    setPassengers((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        fullName: "",
        type: "adult",
      },
    ]);
  }

  function updatePassenger(
    id: string,
    field: keyof Passenger,
    value: string,
  ) {
    setPassengers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );
  }

  function removePassenger(id: string) {
    setPassengers((prev) => prev.filter((p) => p.id !== id));
  }

  function handleSubmit() {
    onSubmit?.({
      bookingType,
      customerId,
      packageId,
      departureId,
      pax,
      discount,
      deposit,
      totalAmount,
      balanceDue,
      passengers,
    });
    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Booking</DialogTitle>
          <DialogDescription>
            Choose a customer, package and departure to start a booking.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          {/* Booking type */}
          <div>
            <Label className="mb-1.5 block">Booking type</Label>
            <div className="flex gap-2">
              {(["individual", "group"] as BookingType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBookingType(t)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors",
                    bookingType === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-muted",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Customer */}
          <div className="grid gap-1.5">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {mockCustomers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Package */}
          <div className="grid gap-1.5">
            <Label>Package</Label>
            <Select
              value={packageId}
              onValueChange={(v) => {
                setPackageId(v);
                setDepartureId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select package" />
              </SelectTrigger>
              <SelectContent>
                {mockPackages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Departure */}
          <div className="grid gap-1.5">
            <Label>Departure</Label>
            <Select
              value={departureId}
              onValueChange={setDepartureId}
              disabled={!packageId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    packageId ? "Select departure" : "Select package first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableDepartures.length === 0 && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No departures for this package.
                  </div>
                )}
                {availableDepartures.map((d) => {
                  const avail =
                    d.seatCapacity - d.seatsBooked - d.seatsHeld;
                  return (
                    <SelectItem
                      key={d.id}
                      value={d.id}
                      disabled={avail <= 0}
                    >
                      {formatDate(d.departureDate)} — {avail} seats left
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedDeparture && (
              <p className="text-xs text-muted-foreground">
                {seatsAvailable} seats available · Returns{" "}
                {formatDate(selectedDeparture.returnDate)}
              </p>
            )}
          </div>

          {/* Pax */}
          <div className="grid gap-1.5">
            <Label>Passengers (pax)</Label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["adult", "Adult"],
                  ["child", "Child"],
                  ["infant", "Infant"],
                ] as [keyof PaxCounts, string][]
              ).map(([key, label]) => (
                <div key={key} className="grid gap-1">
                  <span className="text-xs text-muted-foreground">
                    {label}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={pax[key]}
                    onChange={(e) =>
                      setPaxField(key, Number(e.target.value))
                    }
                  />
                </div>
              ))}
            </div>
            {seatsExceeded && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                Not enough seats: you requested {totalPax} passengers but only{" "}
                {seatsAvailable} seats are available on this departure.
              </p>
            )}
          </div>

          {/* Pricing */}
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="space-y-1.5 text-sm">
              {selectedPackage && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Adult × {pax.adult}
                    </span>
                    <span>
                      {formatCurrency(
                        pax.adult * selectedPackage.adultPrice,
                      )}
                    </span>
                  </div>
                  {pax.child > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Child × {pax.child}
                      </span>
                      <span>
                        {formatCurrency(
                          pax.child * selectedPackage.childPrice,
                        )}
                      </span>
                    </div>
                  )}
                  {pax.infant > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Infant × {pax.infant}
                      </span>
                      <span>
                        {formatCurrency(
                          pax.infant * selectedPackage.infantPrice,
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(subtotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Discount & deposit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Discount</Label>
              <Input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Deposit</Label>
              <Input
                type="number"
                min={0}
                value={deposit}
                onChange={(e) => setDeposit(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-lg border p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">
                  {formatCurrency(totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance due</span>
                <span className="font-semibold text-amber-600">
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* Passengers */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Passenger details</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPassenger}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {passengers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add passengers to build the manifest (optional at this
                stage).
              </p>
            )}
            {passengers.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <Input
                  placeholder="Full name"
                  value={p.fullName}
                  onChange={(e) =>
                    updatePassenger(p.id, "fullName", e.target.value)
                  }
                />
                <Select
                  value={p.type}
                  onValueChange={(v) =>
                    updatePassenger(p.id, "type", v)
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adult">Adult</SelectItem>
                    <SelectItem value="child">Child</SelectItem>
                    <SelectItem value="infant">Infant</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePassenger(p.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !customerId ||
              !packageId ||
              !departureId ||
              totalPax === 0 ||
              seatsExceeded
            }
          >
            Create Booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

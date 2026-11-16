import { useMemo, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { mockDepartures } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface DepartureDateEntry {
  id: string;
  departureDate: string;
  returnDate: string;
  seatCapacity: number;
}

interface DepartureDatesManagerProps {
  packageId: string;
  value: DepartureDateEntry[];
  onChange: (value: DepartureDateEntry[]) => void;
}

export default function DepartureDatesManager({
  packageId,
  value,
  onChange,
}: DepartureDatesManagerProps) {
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [seatCapacity, setSeatCapacity] = useState(30);

  // Existing departures for this package (from mock data) for reference
  const existing = useMemo(
    () => mockDepartures.filter((d) => d.packageId === packageId),
    [packageId],
  );

  function addDate() {
    if (!departureDate || !returnDate) return;
    onChange([
      ...value,
      {
        id: `dep-${Date.now()}`,
        departureDate,
        returnDate,
        seatCapacity,
      },
    ]);
    setDepartureDate("");
    setReturnDate("");
  }

  function removeDate(id: string) {
    onChange(value.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <CalendarPlus className="h-4 w-4" />
        Departure Dates
      </div>

      {/* Existing departures (mock reference) */}
      {existing.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {existing.map((d) => (
            <Badge key={d.id} variant="secondary">
              {formatDate(d.departureDate)} — {formatDate(d.returnDate)}
            </Badge>
          ))}
        </div>
      )}

      {/* New dates added in this session */}
      {value.map((d) => (
        <div
          key={d.id}
          className="flex items-center justify-between gap-2 rounded-md border p-2.5"
        >
          <div className="text-sm">
            <div className="font-medium">
              {formatDate(d.departureDate)} → {formatDate(d.returnDate)}
            </div>
            <div className="text-xs text-muted-foreground">
              {d.seatCapacity} seats
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeDate(d.id)}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* Add form */}
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Departure</span>
          <Input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Return</span>
          <Input
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <span className="text-xs text-muted-foreground">Seats</span>
          <Input
            type="number"
            min={1}
            value={seatCapacity}
            onChange={(e) => setSeatCapacity(Number(e.target.value))}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addDate}
            disabled={!departureDate || !returnDate}
          >
            Add date
          </Button>
        </div>
      </div>
    </div>
  );
}

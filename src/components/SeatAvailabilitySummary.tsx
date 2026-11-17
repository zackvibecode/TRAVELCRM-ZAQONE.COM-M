import { useEffect, useMemo, useState } from "react";
import { Armchair, CheckCircle2, Hourglass, CircleSlash } from "lucide-react";
import { fetchDepartures } from "@/lib/live-data";
import { departureStatusLabels, type Departure } from "@/lib/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Seat availability summary — totals across all departures plus a
 * per-status (open / almost_full / full / closed) breakdown.
 */
export default function SeatAvailabilitySummary() {
  const [departures, setDepartures] = useState<Departure[]>([]);

  // Live departures from D1 (falls back to mock inside the loader).
  useEffect(() => {
    (async () => {
      const res = await fetchDepartures();
      setDepartures(res.departures);
    })();
  }, []);

  const totals = useMemo(() => {
    const capacity = departures.reduce(
      (s, d) => s + d.seatCapacity,
      0,
    );
    const booked = departures.reduce((s, d) => s + d.seatsBooked, 0);
    const held = departures.reduce((s, d) => s + d.seatsHeld, 0);
    return { capacity, booked, held, available: capacity - booked - held };
  }, [departures]);

  const byStatus = useMemo(() => {
    const map = new Map<Departure["status"], number>();
    for (const d of departures) {
      map.set(d.status, (map.get(d.status) ?? 0) + 1);
    }
    return map;
  }, [departures]);

  const statusOrder: Departure["status"][] = [
    "open",
    "almost_full",
    "full",
    "closed",
  ];

  return (
    <div className="space-y-4">
      {/* Seat status cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Armchair className="h-4 w-4" />
              Capacity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.capacity}</div>
            <div className="text-xs text-muted-foreground">
              total seats across departures
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {totals.booked}
            </div>
            <div className="text-xs text-muted-foreground">booked seats</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Hourglass className="h-4 w-4 text-amber-500" />
              Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {totals.held}
            </div>
            <div className="text-xs text-muted-foreground">
              temporarily reserved
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CircleSlash className="h-4 w-4 text-emerald-600" />
              Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {totals.available}
            </div>
            <div className="text-xs text-muted-foreground">
              seats left to sell
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-status breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Departures by status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statusOrder.map((status) => {
              const count = byStatus.get(status) ?? 0;
              return (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <Badge variant="outline">
                    {departureStatusLabels[status]}
                  </Badge>
                  <span className="text-xl font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

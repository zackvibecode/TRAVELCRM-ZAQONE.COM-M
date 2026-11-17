import { useEffect, useMemo, useState } from "react";
import { BedDouble, Plane } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Departure, Passenger } from "@/lib/types";

interface RoomingFlightProps {
  departure: Departure;
}

export default function RoomingFlightInfo({
  departure,
}: RoomingFlightProps) {
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  // Live manifest from D1 via /departures/:id/manifest.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ success: boolean; manifest?: Passenger[] }>(
          `/departures/${departure.id}/manifest`,
        );
        if (res.success && Array.isArray(res.manifest)) setPassengers(res.manifest);
      } catch {
        // manifest mungkin terhad kepada role tertentu
      }
    })();
  }, [departure.id]);

  // Group passengers by room type
  const rooming = useMemo(() => {
    const map = new Map<string, Passenger[]>();
    for (const p of passengers) {
      const key = p.roomType || "Unassigned";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return Array.from(map.entries()).map(([roomType, list]) => ({
      roomType,
      count: list.length,
      names: list.map((p) => p.fullName),
    }));
  }, [passengers]);

  // Unique flight info
  const flights = useMemo(() => {
    const set = new Set<string>();
    for (const p of passengers) {
      if (p.flightInfo) set.add(p.flightInfo);
    }
    return Array.from(set);
  }, [passengers]);

  return (
    <div className="grid gap-4">
      {/* Rooming */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <BedDouble className="h-4 w-4" />
          Rooming
        </h3>
        {rooming.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No rooming assignments yet.
          </p>
        ) : (
          <div className="space-y-2">
            {rooming.map((r) => (
              <div
                key={r.roomType}
                className="flex items-start justify-between gap-3 rounded-md border p-3"
              >
                <div>
                  <div className="text-sm font-medium">{r.roomType}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.names.join(", ")}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                  {r.count} pax
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Flight info */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Plane className="h-4 w-4" />
          Flight Information
        </h3>
        {flights.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            No flight information recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {flights.map((f) => (
              <div
                key={f}
                className="rounded-md border p-3 font-mono text-sm"
              >
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

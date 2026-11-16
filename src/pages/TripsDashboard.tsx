import { useMemo, useState } from "react";
import { CalendarDays, Plane, Users, Armchair, Search } from "lucide-react";
import { mockDepartures, mockPackages } from "@/lib/mock-data";
import {
  departureStatusLabels,
  type Departure,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

function packageName(packageId: string) {
  return mockPackages.find((p) => p.id === packageId)?.name ?? "Unknown";
}

function OccupancyBar({ departure }: { departure: Departure }) {
  const bookedPct = Math.round(
    (departure.seatsBooked / departure.seatCapacity) * 100,
  );
  const heldPct = Math.round(
    (departure.seatsHeld / departure.seatCapacity) * 100,
  );
  const available = Math.max(
    0,
    departure.seatCapacity -
      departure.seatsBooked -
      departure.seatsHeld,
  );

  return (
    <div className="min-w-[140px]">
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{departure.seatsBooked + departure.seatsHeld} / {departure.seatCapacity}</span>
        <span>{available} left</span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="bg-primary"
          style={{ width: `${bookedPct}%` }}
          title={`${departure.seatsBooked} booked`}
        />
        <div
          className="bg-amber-400"
          style={{ width: `${heldPct}%` }}
          title={`${departure.seatsHeld} held`}
        />
      </div>
    </div>
  );
}

export default function TripsDashboard() {
  const [search, setSearch] = useState("");

  const departures = useMemo(() => {
    return mockDepartures.filter((d) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        packageName(d.packageId).toLowerCase().includes(q) ||
        d.tourLeader?.toLowerCase().includes(q) ||
        d.departureDate.includes(q)
      );
    });
  }, [search]);

  const totals = useMemo(() => {
    const capacity = mockDepartures.reduce(
      (s, d) => s + d.seatCapacity,
      0,
    );
    const booked = mockDepartures.reduce((s, d) => s + d.seatsBooked, 0);
    const held = mockDepartures.reduce((s, d) => s + d.seatsHeld, 0);
    const active = mockDepartures.filter(
      (d) => d.status !== "closed" && d.status !== "full",
    ).length;
    return { capacity, booked, held, available: capacity - booked - held, active };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Trips & Seats
          </h1>
          <p className="text-sm text-muted-foreground">
            Departure calendar, seat availability, and trip occupancy.
          </p>
        </div>
        <Button>
          <Plane className="h-4 w-4" />
          New Departure
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Active Departures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Armchair className="h-4 w-4" />
              Total Seats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.capacity}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" />
              Booked + Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {totals.booked + totals.held}
            </div>
            <div className="text-xs text-muted-foreground">
              {totals.booked} booked · {totals.held} held
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Plane className="h-4 w-4" />
              Available Seats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {totals.available}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search package, leader, date..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Departures table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Return</TableHead>
                <TableHead>Tour Leader</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead>Price (adult)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departures.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No departures match your search.
                  </TableCell>
                </TableRow>
              ) : (
                departures.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="font-medium">
                        {packageName(d.packageId)}
                      </div>
                      {d.notes && (
                        <div className="text-xs text-muted-foreground">
                          {d.notes}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(d.departureDate)}</TableCell>
                    <TableCell>{formatDate(d.returnDate)}</TableCell>
                    <TableCell>{d.tourLeader ?? "—"}</TableCell>
                    <TableCell>
                      <OccupancyBar departure={d} />
                    </TableCell>
                    <TableCell>{formatCurrency(d.adultPrice)}</TableCell>
                    <TableCell>
                      <Badge variant={departureBadgeVariant(d.status)}>
                        {departureStatusLabels[d.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

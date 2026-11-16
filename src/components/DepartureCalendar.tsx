import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mockDepartures, mockPackages } from "@/lib/mock-data";
import { departureStatusLabels, type Departure } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

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

export default function DepartureCalendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  // Departures grouped by date string (YYYY-MM-DD)
  const departuresByDate = useMemo(() => {
    const map = new Map<string, Departure[]>();
    for (const d of mockDepartures) {
      const key = d.departureDate;
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return map;
  }, []);

  const days = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  function navigate(dir: -1 | 1) {
    let m = month + dir;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  function dateKey(day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h3 className="font-display text-base font-semibold">
          {MONTHS[month]} {year}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(1)}
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b text-center">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="min-h-[92px] border-b border-r bg-muted/20" />;
          }
          const key = dateKey(day);
          const dayDepartures = departuresByDate.get(key) ?? [];
          const isToday =
            day === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();

          return (
            <div
              key={key}
              className={cn(
                "min-h-[92px] border-b border-r p-1.5",
                isToday && "bg-primary/5",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-medium text-muted-foreground",
                    isToday &&
                      "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground",
                  )}
                >
                  {day}
                </span>
              </div>
              <div className="mt-1 space-y-1">
                {dayDepartures.map((d) => (
                  <div
                    key={d.id}
                    className="rounded bg-primary/10 px-1.5 py-1"
                    title={`${packageName(d.packageId)} — ${departureStatusLabels[d.status]}`}
                  >
                    <div className="truncate text-[10px] font-medium leading-tight text-primary">
                      {packageName(d.packageId)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {d.seatsBooked + d.seatsHeld}/{d.seatCapacity} seats
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Legend:</span>
        {(
          ["open", "almost_full", "full", "closed"] as Departure["status"][]
        ).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <Badge variant={departureBadgeVariant(s)}>
              {departureStatusLabels[s]}
            </Badge>
          </span>
        ))}
      </div>
    </div>
  );
}

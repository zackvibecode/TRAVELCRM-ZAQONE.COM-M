import { useMemo, useState } from "react";
import { Download, Users } from "lucide-react";
import { mockBookings } from "@/lib/mock-data";
import type { Departure, Passenger } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import PassengerDetails from "@/components/PassengerDetails";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface ManifestRow extends Passenger {
  bookingReference: string;
  customerName: string;
}

const typeLabel: Record<Passenger["type"], string> = {
  adult: "Adult",
  child: "Child",
  infant: "Infant",
};

function typeBadgeVariant(
  type: Passenger["type"],
): "default" | "secondary" | "outline" {
  if (type === "adult") return "default";
  if (type === "child") return "secondary";
  return "outline";
}

function exportManifestCsv(rows: ManifestRow[], filename: string) {
  const headers = [
    "Name",
    "Type",
    "Booking",
    "Customer",
    "Passport",
    "Room",
    "Dietary",
  ];
  const lines = rows.map((r) =>
    [
      r.fullName,
      r.type,
      r.bookingReference,
      r.customerName,
      r.passportNumber ?? "",
      r.roomType ?? "",
      r.dietaryNote ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PassengerManifest({
  departure,
}: {
  departure: Departure;
}) {
  const [selected, setSelected] = useState<Passenger | null>(null);

  const rows = useMemo<ManifestRow[]>(() => {
    return mockBookings
      .filter(
        (b) =>
          b.departureDate === departure.departureDate &&
          b.status !== "cancelled" &&
          b.status !== "draft",
      )
      .flatMap((b) =>
        b.passengers.map((p) => ({
          ...p,
          bookingReference: b.reference,
          customerName: b.customerName,
        })),
      );
  }, [departure]);

  const counts = useMemo(() => {
    const adult = rows.filter((r) => r.type === "adult").length;
    const child = rows.filter((r) => r.type === "child").length;
    const infant = rows.filter((r) => r.type === "infant").length;
    return { adult, child, infant, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" />
          Passenger Manifest
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>{counts.adult} adult</span>
            <span>{counts.child} child</span>
            <span>{counts.infant} infant</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() =>
              exportManifestCsv(
                rows,
                `manifest-${departure.departureDate}.csv`,
              )
            }
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No passengers recorded for this departure yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Passport</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Diet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow
                  key={`${r.id}-${i}`}
                  className="cursor-pointer"
                  onClick={() => setSelected(r)}
                >
                  <TableCell>
                    <div className="font-medium">{r.fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.customerName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeBadgeVariant(r.type)}>
                      {typeLabel[r.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {r.bookingReference}
                  </TableCell>
                  <TableCell>{r.passportNumber ?? "—"}</TableCell>
                  <TableCell>{r.roomType ?? "—"}</TableCell>
                  <TableCell>{r.dietaryNote ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {departure.departureDate && (
        <p className="text-xs text-muted-foreground">
          Departure {formatDate(departure.departureDate)} ·{" "}
          {counts.total} passengers total
        </p>
      )}

      <PassengerDetails
        passenger={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

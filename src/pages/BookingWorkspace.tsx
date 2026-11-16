import { useMemo, useState } from "react";
import { Plus, Search, Eye, MoreHorizontal } from "lucide-react";
import { mockBookings } from "@/lib/mock-data";
import CreateBookingForm from "@/components/CreateBookingForm";
import BookingDetail from "@/components/BookingDetail";
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from "@/components/StatusBadges";
import { type Booking, type BookingStatus, bookingStatusLabels } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const statusFilters: (BookingStatus | "all")[] = [
  "all",
  "draft",
  "hold",
  "pending_deposit",
  "confirmed",
  "completed",
  "cancelled",
];

function totalPax(b: Booking) {
  return b.paxAdult + b.paxChild + b.paxInfant;
}

export default function BookingWorkspace() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusFilters)[number]>("all");

  const filtered = useMemo(() => {
    return mockBookings.filter((b) => {
      const matchesSearch =
        !search ||
        b.reference.toLowerCase().includes(search.toLowerCase()) ||
        b.customerName.toLowerCase().includes(search.toLowerCase()) ||
        b.packageName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const counts = useMemo(() => {
    const total = mockBookings.length;
    const confirmed = mockBookings.filter(
      (b) => b.status === "confirmed",
    ).length;
    const pending = mockBookings.filter(
      (b) => b.status === "pending_deposit" || b.status === "hold",
    ).length;
    const outstanding = mockBookings.reduce(
      (sum, b) => sum + b.balanceDue,
      0,
    );
    return { total, confirmed, pending, outstanding };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Booking Workspace
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage customer bookings, passengers, pricing, and status.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Booking
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">
              {counts.confirmed}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Awaiting Deposit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {counts.pending}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Outstanding Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(counts.outstanding)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reference, customer, package..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {statusFilters.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70",
              )}
            >
              {f === "all" ? "All" : bookingStatusLabels[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead className="text-center">Pax</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No bookings match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {b.reference}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{b.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.customerPhone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{b.packageName}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {b.type}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(b.departureDate)}</TableCell>
                    <TableCell className="text-center">{totalPax(b)}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(b.totalAmount)}
                    </TableCell>
                    <TableCell>
                      {b.balanceDue > 0 ? (
                        <span className="font-medium text-amber-600">
                          {formatCurrency(b.balanceDue)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <BookingStatusBadge status={b.status} />
                    </TableCell>
                    <TableCell>
                      <PaymentStatusBadge status={b.paymentStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View"
                          onClick={() => setDetailBooking(b)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="More">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateBookingForm
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <BookingDetail
        booking={detailBooking}
        open={detailBooking !== null}
        onOpenChange={(open) => {
          if (!open) setDetailBooking(null);
        }}
      />
    </div>
  );
}

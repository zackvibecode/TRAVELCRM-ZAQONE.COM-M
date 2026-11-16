import { useMemo, useState } from "react";
import {
  Users,
  Search,
  MessageCircle,
  Plus,
  Building2,
  User as UserIcon,
  CalendarDays,
  Wallet,
  MapPin,
  BookOpenCheck,
} from "lucide-react";
import { mockBookings, mockCustomers } from "@/lib/mock-data";
import type { Booking, Customer } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const BOOKING_STATUS_CLASS: Record<Booking["status"], string> = {
  draft: "bg-slate-50 text-slate-700 border-slate-200",
  hold: "bg-amber-50 text-amber-700 border-amber-200",
  pending_deposit: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-violet-50 text-violet-700 border-violet-200",
};

export default function Customers() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "individual" | "corporate">("all");
  const [selected, setSelected] = useState<Customer | null>(null);

  const customers = useMemo(() => {
    const q = search.toLowerCase();
    return mockCustomers.filter((customer) => {
      if (q) {
        if (
          !customer.name.toLowerCase().includes(q) &&
          !customer.email.toLowerCase().includes(q) &&
          !customer.phone.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (typeFilter !== "all" && customer.type !== typeFilter) return false;
      return true;
    });
  }, [search, typeFilter]);

  const bookingsByCustomer = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const booking of mockBookings) {
      const list = map.get(booking.customerName) ?? [];
      list.push(booking);
      map.set(booking.customerName, list);
    }
    return map;
  }, []);

  function statsFor(customer: Customer) {
    const bookings = bookingsByCustomer.get(customer.name) ?? [];
    const totalSpend = bookings
      .filter((b) => b.status !== "cancelled")
      .reduce((sum, b) => sum + b.paidAmount, 0);
    const active = bookings.filter(
      (b) => b.status === "confirmed" || b.status === "pending_deposit" || b.status === "hold",
    ).length;
    return { bookings, totalSpend, active };
  }

  const kpi = useMemo(() => {
    const total = mockCustomers.length;
    const corporate = mockCustomers.filter((c) => c.type === "corporate").length;
    const withBookings = mockCustomers.filter(
      (c) => (bookingsByCustomer.get(c.name) ?? []).length > 0,
    ).length;
    return { total, corporate, withBookings };
  }, [bookingsByCustomer]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Customers
          </h1>
          <p className="text-sm text-muted-foreground">
            Profil pelanggan dan riwayat booking.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Tambah Customer
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Users className="h-4 w-4" /> Total Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold">{kpi.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Building2 className="h-4 w-4" /> Korporat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold">{kpi.corporate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <BookOpenCheck className="h-4 w-4" /> Punya Booking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl font-bold">{kpi.withBookings}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama, email, atau telepon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "all" | "individual" | "corporate")
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Semua Tipe</option>
          <option value="individual">Individual</option>
          <option value="corporate">Korporat</option>
        </select>
      </div>

      {/* Customer table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Kota</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Total Belanja</TableHead>
                <TableHead>Sejak</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => {
                const stats = statsFor(customer);
                return (
                  <TableRow
                    key={customer.id}
                    className={cn(
                      "cursor-pointer",
                      selected?.id === customer.id && "bg-muted/50",
                    )}
                    onClick={() =>
                      setSelected(selected?.id === customer.id ? null : customer)
                    }
                  >
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs">{customer.phone}</span>
                        <span className="text-xs text-muted-foreground">
                          {customer.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          customer.type === "corporate"
                            ? "border-violet-200 bg-violet-50 text-violet-700"
                            : "border-blue-200 bg-blue-50 text-blue-700"
                        }
                      >
                        {customer.type === "corporate" ? (
                          <Building2 className="mr-1 h-3 w-3" />
                        ) : (
                          <UserIcon className="mr-1 h-3 w-3" />
                        )}
                        {customer.type === "corporate" ? "Korporat" : "Individual"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {customer.city ?? "—"}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {stats.bookings.length}
                      </span>
                      {stats.active > 0 && (
                        <span className="ml-1 text-xs text-green-600">
                          ({stats.active} aktif)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatRupiah(stats.totalSpend)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDate(customer.joinedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20"
                        title={`Chat WhatsApp ${customer.name}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Tidak ada customer yang cocok.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Customer profile panel */}
      {selected && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-lg font-bold">
                {selected.name}
              </CardTitle>
              <Badge
                variant="outline"
                className={
                  selected.type === "corporate"
                    ? "border-violet-200 bg-violet-50 text-violet-700"
                    : "border-blue-200 bg-blue-50 text-blue-700"
                }
              >
                {selected.type === "corporate" ? "Korporat" : "Individual"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Telepon</p>
                  <p className="truncate text-xs font-medium">{selected.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Email / Kota</p>
                  <p className="truncate text-xs font-medium">
                    {selected.city ?? selected.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Customer Sejak</p>
                  <p className="truncate text-xs font-medium">
                    {formatDate(selected.joinedAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border p-3">
                <Wallet className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">Total Belanja</p>
                  <p className="truncate text-xs font-semibold text-primary">
                    {formatRupiah(statsFor(selected).totalSpend)}
                  </p>
                </div>
              </div>
            </div>

            {selected.notes && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  Catatan
                </p>
                <p className="text-sm">{selected.notes}</p>
              </div>
            )}

            {/* Booking history */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Riwayat Booking
              </p>
              {statsFor(selected).bookings.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Belum ada booking.
                </p>
              ) : (
                <div className="space-y-2">
                  {statsFor(selected).bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {booking.reference} — {booking.packageName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {booking.departureDate} • {booking.paxAdult + booking.paxChild + booking.paxInfant} pax
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={BOOKING_STATUS_CLASS[booking.status]}
                        >
                          {booking.status}
                        </Badge>
                        <span className="text-sm font-medium">
                          {formatRupiah(booking.totalAmount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

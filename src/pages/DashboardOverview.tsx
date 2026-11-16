import { useMemo } from "react";
import {
  Users,
  UserPlus,
  CalendarCheck,
  Wallet,
  AlertCircle,
  TrendingUp,
  Package,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import {
  mockBookings,
  mockCustomers,
  mockInvoices,
  mockLeads,
} from "@/lib/mock-data";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import SalesPerformanceTable from "@/components/SalesPerformanceTable";
import AlertsPanel from "@/components/AlertsPanel";

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** Deterministic monthly revenue from mock bookings — the real chart swaps
 *  this for the /reports endpoints in the backend phase. */
function buildMonthlyRevenue(bookings: Booking[]): {
  month: string;
  revenue: number;
  count: number;
}[] {
  const now = new Date();
  const buckets: { month: string; revenue: number; count: number }[] = [];

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      month: MONTH_LABELS[d.getMonth()],
      revenue: 0,
      count: 0,
    });
  }

  for (const b of bookings) {
    const created = new Date(b.createdAt);
    const diff =
      (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth());
    if (diff >= 0 && diff < 12 && b.status !== "cancelled") {
      const idx = 11 - diff;
      buckets[idx].revenue += b.paidAmount;
      buckets[idx].count += 1;
    }
  }
  return buckets;
}

export default function DashboardOverview() {
  const stats = useMemo(() => {
    const activeLeads = mockLeads.filter(
      (l) => !["won", "lost"].includes(l.stage),
    );
    const wonLeads = mockLeads.filter((l) => l.stage === "won");
    const lostLeads = mockLeads.filter((l) => l.stage === "lost");
    const decided = wonLeads.length + lostLeads.length;

    const activeBookings = mockBookings.filter(
      (b) => b.status !== "cancelled",
    );
    const confirmed = mockBookings.filter((b) => b.status === "confirmed");
    const collected = activeBookings.reduce((s, b) => s + b.paidAmount, 0);
    const outstanding = activeBookings.reduce(
      (s, b) => s + (b.totalAmount - b.paidAmount),
      0,
    );

    const invoiceOverdue = mockInvoices.filter(
      (i) =>
        i.balanceDue > 0 &&
        i.status !== "void" &&
        i.status !== "draft" &&
        new Date(i.dueDate) < new Date(),
    );

    return {
      totalLeads: mockLeads.length,
      openLeads: activeLeads.length,
      winRate: decided > 0 ? Math.round((wonLeads.length / decided) * 100) : 0,
      totalCustomers: mockCustomers.length,
      bookingCount: activeBookings.length,
      confirmedCount: confirmed.length,
      collected,
      outstanding,
      overdueInvoices: invoiceOverdue,
      overdueAmount: invoiceOverdue.reduce((s, i) => s + i.balanceDue, 0),
    };
  }, []);

  const monthly = useMemo(() => buildMonthlyRevenue(mockBookings), []);
  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  const topPackages = useMemo(() => {
    const byPkg = new Map<
      string,
      { name: string; bookings: number; revenue: number }
    >();
    for (const b of mockBookings) {
      if (b.status === "cancelled") continue;
      const entry = byPkg.get(b.packageName) ?? {
        name: b.packageName,
        bookings: 0,
        revenue: 0,
      };
      entry.bookings += 1;
      entry.revenue += b.paidAmount;
      byPkg.set(b.packageName, entry);
    }
    return [...byPkg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, []);

  const upcomingDepartures = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return mockBookings
      .filter(
        (b) =>
          b.status === "confirmed" &&
          b.departureDate &&
          b.departureDate >= today,
      )
      .sort((a, b) => (a.departureDate ?? "").localeCompare(b.departureDate ?? ""))
      .slice(0, 5);
  }, []);

  const kpis = [
    {
      label: "Leads Aktif",
      value: String(stats.openLeads),
      sub: `${stats.totalLeads} total • win rate ${stats.winRate}%`,
      icon: UserPlus,
      accent: "text-blue-600 bg-blue-50",
    },
    {
      label: "Customers",
      value: String(stats.totalCustomers),
      sub: "Sepanjang waktu",
      icon: Users,
      accent: "text-violet-600 bg-violet-50",
    },
    {
      label: "Bookings Aktif",
      value: String(stats.bookingCount),
      sub: `${stats.confirmedCount} confirmed`,
      icon: CalendarCheck,
      accent: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Sales Terkumpul",
      value: formatCompact(stats.collected),
      sub: formatRupiah(stats.collected),
      icon: Wallet,
      accent: "text-teal-600 bg-teal-50",
    },
    {
      label: "Outstanding",
      value: formatCompact(stats.outstanding),
      sub: formatRupiah(stats.outstanding),
      icon: AlertCircle,
      accent: "text-red-600 bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Ringkasan performa bisnis hari ini — {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-start justify-between p-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground">{kpi.sub}</p>
              </div>
              <div className={cn("rounded-lg p-2", kpi.accent)}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts strip */}
      {stats.overdueInvoices.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">
                {stats.overdueInvoices.length} invoice overdue — total{" "}
                {formatRupiah(stats.overdueAmount)}
              </p>
              <p className="text-xs text-red-700">
                {stats.overdueInvoices
                  .slice(0, 3)
                  .map((i) => i.number)
                  .join(", ")}
                {stats.overdueInvoices.length > 3 && " …"}
              </p>
            </div>
            <Badge variant="outline" className="border-red-300 bg-white text-red-700">
              Butuh tindakan
            </Badge>
          </CardContent>
        </Card>
      )}

      <AlertsPanel />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Monthly revenue chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Revenue Bulanan (12 bulan)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex h-56 items-end gap-1.5 sm:gap-2">
              {monthly.map((m, idx) => {
                const pct = Math.round((m.revenue / maxRevenue) * 100);
                const isLatest = idx === monthly.length - 1;
                return (
                  <div
                    key={`${m.month}-${idx}`}
                    className="group flex flex-1 flex-col items-center gap-1"
                  >
                    <span className="text-[9px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      {formatCompact(m.revenue)}
                    </span>
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-colors",
                        isLatest
                          ? "bg-red-500"
                          : "bg-red-200 group-hover:bg-red-400",
                      )}
                      style={{ height: `${Math.max(pct, m.revenue > 0 ? 6 : 2)}%` }}
                      title={`${m.month}: ${formatRupiah(m.revenue)} • ${m.count} booking`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {m.month}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Menampilkan pembayaran terverifikasi per bulan. Hover untuk detail.
            </p>
          </CardContent>
        </Card>

        {/* Top packages */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Paket Terlaris</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {topPackages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Belum ada booking.
              </p>
            )}
            {topPackages.map((p, idx) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.bookings} booking
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCompact(p.revenue)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Sales agent performance */}
      <SalesPerformanceTable />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Upcoming departures */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Keberangkatan Terdekat</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingDepartures.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Tidak ada keberangkatan terjadwal.
              </p>
            )}
            {upcomingDepartures.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {b.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.packageName} •{" "}
                    {(b.paxAdult + b.paxChild).toString()} pax
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {b.departureDate &&
                      new Date(b.departureDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                      })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {b.reference}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Aksi Cepat</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: "Booking Baru", href: "/bookings" },
              { label: "Pipeline Leads", href: "/leads" },
              { label: "Tagihan & Pembayaran", href: "/billing" },
              { label: "Jadwal Trip", href: "/trips" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-muted/50"
              >
                {link.label}
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

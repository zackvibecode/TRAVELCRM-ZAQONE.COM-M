import { useEffect, useMemo, useState } from "react";
import {
  Users,
  UserPlus,
  CalendarCheck,
  Wallet,
  AlertCircle,
  Hourglass,
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
import { cn, formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useDashboardKpi } from "@/lib/useDashboardKpi";
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
  return formatRinggit(value);
}

function formatCompact(value: number): string {
  const rm = Math.round(value / 3000);
  return `RM ${new Intl.NumberFormat("ms-MY", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(rm)}`;
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

/** Deterministic monthly revenue from bookings — derived from live D1 data
 *  with mock fallback so the chart always renders. */
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
  const { t, lang } = useLang();
  const { kpi } = useDashboardKpi();
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);

  // Live bookings from D1 (falls back to mock inside the loader) — used for
  // the monthly revenue chart, top packages, and upcoming departures.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { fetchBookings } = await import("@/lib/live-data");
      const res = await fetchBookings();
      if (!cancelled) setLiveBookings(res.bookings);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mockStats = useMemo(() => {
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

  // Prefer live D1 KPIs; fall back to mock-derived values if API is unavailable.
  const stats = useMemo(() => {
    if (!kpi) return mockStats;
    return {
      ...mockStats,
      totalLeads: kpi.totalLeads,
      openLeads: kpi.openLeads,
      winRate: kpi.winRate,
      totalCustomers: kpi.totalCustomers,
      bookingCount: kpi.bookingCount,
      confirmedCount: kpi.confirmedCount,
      collected: kpi.collected,
      outstanding: kpi.outstanding,
      overdueAmount: kpi.overdueAmount,
    };
  }, [kpi, mockStats]);

  const monthly = useMemo(() => buildMonthlyRevenue(liveBookings), [liveBookings]);
  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  const topPackages = useMemo(() => {
    const byPkg = new Map<
      string,
      { name: string; bookings: number; revenue: number }
    >();
    for (const b of liveBookings) {
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
  }, [liveBookings]);

  const upcomingDepartures = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return liveBookings
      .filter(
        (b) =>
          b.status === "confirmed" &&
          b.departureDate &&
          b.departureDate >= today,
      )
      .sort((a, b) => (a.departureDate ?? "").localeCompare(b.departureDate ?? ""))
      .slice(0, 5);
  }, [liveBookings]);

  // KPI cards following the prototype business-dashboard: small muted label,
  // soft-tone 30px icon chip, big tabular value, delta + note line.
  const kpis = [
    {
      label: t("Leads Aktif", "Total Leads"),
      value: String(stats.openLeads),
      sub: `${stats.totalLeads} total · win rate ${stats.winRate}%`,
      icon: UserPlus,
      chip: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
    },
    {
      label: t("Pelanggan", "Customers"),
      value: String(stats.totalCustomers),
      sub: t("Sepanjang masa", "All time"),
      icon: Users,
      chip: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    },
    {
      label: t("Tempahan Aktif", "Bookings"),
      value: String(stats.bookingCount),
      sub: `${stats.confirmedCount} confirmed`,
      icon: CalendarCheck,
      chip: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
    },
    {
      label: t("Jualan Terkumpul", "Total Sales"),
      value: formatCompact(stats.collected),
      sub: formatRupiah(stats.collected),
      icon: Wallet,
      chip: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    },
    {
      label: t("Baki Tertunggak", "Outstanding"),
      value: formatCompact(stats.outstanding),
      sub: formatRupiah(stats.outstanding),
      icon: Hourglass,
      chip: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
    },
  ];

  const locale = lang === "ms" ? "ms-MY" : "en-GB";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Page head — tvl-pagehead per prototype */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-2xl font-bold leading-tight tracking-tight">
            {t("Papan Pemuka Perniagaan", "Business Dashboard")}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            {t(
              "Jualan, okupansi dan bayaran sekali pandang — sehingga",
              "Sales, occupancy and payments at a glance — as of",
            )}{" "}
            {new Date().toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] text-[var(--color-text-secondary)]">
            <Clock className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString(locale, { month: "short", year: "numeric" })}
          </span>
          <a
            href="/bookings"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t("Tempahan Baharu", "New booking")}
          </a>
        </div>
      </div>

      {/* KPI cards — dash-kpis per prototype */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpiItem) => (
          <article
            key={kpiItem.label}
            className="flex min-w-0 flex-col gap-2.5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12.5px] font-medium text-muted-foreground">
                {kpiItem.label}
              </span>
              <span
                className={cn(
                  "grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px]",
                  kpiItem.chip,
                )}
              >
                <kpiItem.icon className="h-[15px] w-[15px]" />
              </span>
            </div>
            <strong className="whitespace-nowrap text-[23px] font-bold leading-tight tracking-tight text-foreground [font-variant-numeric:tabular-nums]">
              {kpiItem.value}
            </strong>
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="font-semibold text-[var(--color-success)]">
                {kpiItem.sub}
              </span>
            </div>
          </article>
        ))}
      </div>

      {/* Alerts strip */}
      {stats.overdueInvoices.length > 0 && (
        <Card className="border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)]/50">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-[var(--color-danger)]" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--color-danger)]">
                {stats.overdueInvoices.length} {t("invois tertunggak", "overdue invoices")} —{" "}
                {t("jumlah", "total")} {formatRupiah(stats.overdueAmount)}
              </p>
              <p className="text-xs text-[var(--color-danger)]">
                {stats.overdueInvoices
                  .slice(0, 3)
                  .map((i) => i.number)
                  .join(", ")}
                {stats.overdueInvoices.length > 3 && " …"}
              </p>
            </div>
            <Badge variant="outline" className="border-[var(--color-danger)] bg-white text-[var(--color-danger)]">
              {t("Perlu tindakan", "Action needed")}
            </Badge>
          </CardContent>
        </Card>
      )}

      <AlertsPanel />

      {/* Main grid: revenue chart (1.62fr) + top packages (1fr) — per prototype */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1.62fr_1fr]">
        {/* Monthly revenue chart */}
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div className="min-w-0">
              <CardTitle className="text-[14.5px] font-semibold">
                {t("Jualan & Tempahan Bulanan", "Revenue & Bookings")}
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("Purata", "Average")} {formatCompact(stats.collected / 12)} /{" "}
                {t("bulan · 12 bulan terakhir", "month · last 12 months")}
              </p>
            </div>
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
                          ? "bg-[var(--color-primary)]"
                          : "bg-[var(--color-primary-soft)] group-hover:bg-[var(--color-primary-hover)]",
                      )}
                      style={{ height: `${Math.max(pct, m.revenue > 0 ? 6 : 2)}%` }}
                      title={`${m.month}: ${formatRupiah(m.revenue)} • ${m.count} ${t("tempahan", "bookings")}`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {m.month}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t(
                "Memaparkan pembayaran disahkan setiap bulan. Hover untuk butiran.",
                "Showing verified payments per month. Hover for details.",
              )}
            </p>
          </CardContent>
        </Card>

        {/* Top packages — dash-top-pkg per prototype with progress bars */}
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[14.5px] font-semibold">
              {t("Pakej Terlaris", "Top Packages")}
            </CardTitle>
            <a href="/packages" className="text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">
              {t("Lihat katalog", "View catalogue")}
            </a>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {topPackages.length === 0 && (
              <p className="px-5 pb-5 pt-2 text-sm text-muted-foreground">
                {t("Belum ada tempahan.", "No bookings yet.")}
              </p>
            )}
            {topPackages.map((p, idx) => {
              const maxBookings = topPackages[0]?.bookings || 1;
              const pct = Math.round((p.bookings / maxBookings) * 100);
              return (
                <div
                  key={p.name}
                  className={cn(
                    "flex items-center gap-3 px-5 py-3",
                    idx > 0 && "border-t border-[var(--color-border)]",
                  )}
                >
                  <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <Package className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{p.name}</p>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]"
                      aria-hidden="true"
                    >
                      <span
                        className="block h-full rounded-full bg-[var(--color-primary)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <strong className="flex-none whitespace-nowrap text-[12.5px] font-semibold [font-variant-numeric:tabular-nums]">
                    {formatCompact(p.revenue)}
                  </strong>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Sales agent performance */}
      <SalesPerformanceTable />

      {/* Bottom grid: departures + quick actions */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Upcoming departures */}
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[14.5px] font-semibold">
              {t("Keberangkatan Terdekat", "Upcoming Departures")}
            </CardTitle>
            <a href="/trips" className="text-[12.5px] font-semibold text-[var(--color-primary)] hover:underline">
              {t("Semua keberangkatan", "All departures")}
            </a>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingDepartures.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t(
                  "Tiada keberangkatan dijadualkan.",
                  "No scheduled departures.",
                )}
              </p>
            )}
            {upcomingDepartures.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-surface-raised)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">
                    {b.packageName}
                  </p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {b.customerName} ·{" "}
                    {(b.paxAdult + b.paxChild).toString()} pax
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12.5px] font-semibold [font-variant-numeric:tabular-nums]">
                    {b.departureDate &&
                      new Date(b.departureDate).toLocaleDateString(locale, {
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
        <Card className="min-w-0">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[14.5px] font-semibold">
              {t("Tindakan Pantas", "Quick Actions")}
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            {[
              { label: t("Tempahan Baharu", "New Booking"), href: "/bookings" },
              { label: t("Saluran Leads", "Leads Pipeline"), href: "/leads" },
              { label: t("Billing & Pembayaran", "Billing & Payments"), href: "/billing" },
              { label: t("Jadual Trip", "Trip Schedule"), href: "/trips" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm font-medium transition-colors hover:bg-[var(--color-surface-muted)]"
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

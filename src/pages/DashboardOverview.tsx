import { useEffect, useMemo, useState } from "react";
import {
  Armchair,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  Download,
  Hourglass,
  MapPin,
  PlaneTakeoff,
  Plus,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { Booking } from "@/lib/types";
import { cn, formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useDashboardKpi } from "@/lib/useDashboardKpi";

type Tone = "success" | "warning" | "info" | "danger" | "neutral";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: "bg-[var(--color-success-soft)]", fg: "text-[var(--color-success)]" },
  warning: { bg: "bg-[var(--color-warning-soft)]", fg: "text-[var(--color-warning)]" },
  info: { bg: "bg-[var(--color-info-soft)]", fg: "text-[var(--color-info)]" },
  danger: { bg: "bg-[var(--color-danger-soft)]", fg: "text-[var(--color-danger)]" },
  neutral: { bg: "bg-[var(--color-neutral-soft)]", fg: "text-[var(--color-text-secondary)]" },
};

const KPIS: {
  id: string;
  label: { ms: string; en: string };
  delta: string;
  up: boolean;
  icon: typeof UserPlus;
  chip: string;
  key: "totalLeads" | "totalCustomers" | "bookingCount" | "collected" | "outstanding";
  compact?: boolean;
}[] = [
  { id: "leads", label: { ms: "Jumlah Leads", en: "Total Leads" }, delta: "+12.4%", up: true, icon: UserPlus, chip: "bg-[var(--color-info-soft)] text-[var(--color-info)]", key: "totalLeads" },
  { id: "customers", label: { ms: "Pelanggan", en: "Customers" }, delta: "+6.1%", up: true, icon: Users, chip: "bg-[var(--color-success-soft)] text-[var(--color-success)]", key: "totalCustomers" },
  { id: "bookings", label: { ms: "Tempahan", en: "Bookings" }, delta: "+18.7%", up: true, icon: CalendarCheck, chip: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]", key: "bookingCount" },
  { id: "sales", label: { ms: "Jualan", en: "Total Sales" }, delta: "+21.3%", up: true, icon: Wallet, chip: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]", key: "collected", compact: true },
  { id: "outstanding", label: { ms: "Tertunggak", en: "Outstanding" }, delta: "-3.8%", up: false, icon: Hourglass, chip: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]", key: "outstanding", compact: true },
];

const REVENUE = [
  { month: "Apr", revenue: 89, bookings: 32 },
  { month: "May", revenue: 107, bookings: 38 },
  { month: "Jun", revenue: 99, bookings: 35 },
  { month: "Jul", revenue: 129, bookings: 44 },
  { month: "Aug", revenue: 137, bookings: 47 },
  { month: "Sep", revenue: 123, bookings: 41 },
  { month: "Oct", revenue: 149, bookings: 52 },
  { month: "Nov", revenue: 166, bookings: 58 },
];

const BOOKING_MIX = [
  { label: "Confirmed", value: 186, color: "var(--color-primary)" },
  { label: "Pending deposit", value: 64, color: "var(--color-warning)" },
  { label: "Hold", value: 27, color: "var(--color-info)" },
  { label: "Completed", value: 35, color: "var(--color-success)" },
];

const TOP_PACKAGES = [
  { id: "japan", name: "Japan Sakura 8D7N", destination: "Tokyo · Osaka · Kyoto", sold: 148, target: 160, revenue: "RM 931k" },
  { id: "turkey", name: "Turkey Istanbul 9D8N", destination: "Istanbul · Cappadocia", sold: 121, target: 150, revenue: "RM 988k" },
  { id: "bali", name: "Bali Premium 4D3N", destination: "Ubud · Nusa Penida", sold: 96, target: 120, revenue: "RM 120k" },
  { id: "korea", name: "Korea Autumn 6D5N", destination: "Seoul · Nami Island", sold: 84, target: 100, revenue: "RM 441k" },
];

const DEPARTURES = [
  { id: "DP-4471", package: "Japan Sakura 8D7N", date: "12 Dec 2025", leader: "Rina Pratama", capacity: 40, booked: 34, held: 4 },
  { id: "DP-4482", package: "Turkey Istanbul 9D8N", date: "18 Dec 2025", leader: "Badrul Hakim", capacity: 32, booked: 24, held: 3 },
  { id: "DP-4490", package: "Korea Autumn 6D5N", date: "23 Dec 2025", leader: "Nur Aisyah", capacity: 28, booked: 27, held: 1 },
  { id: "DP-4501", package: "Bali Premium 4D3N", date: "28 Dec 2025", leader: "Yoga Aditya", capacity: 24, booked: 11, held: 2 },
];

const STATIC_BOOKINGS = [
  { id: "TRV-2025-0481", customer: "Hendra Wijaya", pax: 4, amount: "RM 13,850", status: "Confirmed", tone: "success" as Tone },
  { id: "TRV-2025-0480", customer: "Siti Nurhaliza", pax: 2, amount: "RM 6,120", status: "Pending deposit", tone: "warning" as Tone },
  { id: "TRV-2025-0479", customer: "Gunawan Family", pax: 6, amount: "RM 24,720", status: "Hold", tone: "info" as Tone },
  { id: "TRV-2025-0478", customer: "Andi Pratama", pax: 1, amount: "RM 3,080", status: "Confirmed", tone: "success" as Tone },
];

const FEED = [
  { id: "f1", icon: UserPlus, chip: "bg-[var(--color-info-soft)] text-[var(--color-info)]", title: "New lead from website", detail: "Meta Ads · Japan Sakura", time: "4 min ago" },
  { id: "f2", icon: BadgeCheck, chip: "bg-[var(--color-success-soft)] text-[var(--color-success)]", title: "Payment verified", detail: "INV-2025-0231 · RM 4,150", time: "22 min ago" },
  { id: "f3", icon: Armchair, chip: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]", title: "Seats running low", detail: "Korea Autumn · 1 seat", time: "1 hr ago" },
  { id: "f4", icon: PlaneTakeoff, chip: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]", title: "Departure coming up", detail: "DP-4471 in 12 days", time: "3 hrs ago" },
];

function compact(value: number): string {
  return `RM ${new Intl.NumberFormat("ms-MY", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
}

function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const palette = TONE[tone] ?? TONE.neutral;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap", palette.bg, palette.fg)}>
      {children}
    </span>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]", className)}>
      {children}
    </section>
  );
}

function PanelHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
      <h2 className="m-0 text-[14.5px] font-semibold tracking-tight">{title}</h2>
      {aside}
    </div>
  );
}

function RevenueChart({ rows, range }: { rows: typeof REVENUE; range: string }) {
  const W = rows.length === 3 ? 380 : 520;
  const H = 250;
  const left = 34;
  const right = 8;
  const top = 16;
  const bottom = 26;
  const plotW = W - left - right;
  const plotH = H - top - bottom;
  const compactChart = rows.length > 3;
  const maxBook = 64;
  const slot = plotW / rows.length;
  const barW = Math.min(18, slot / 2.6);
  const yBook = (v: number) => top + plotH - (v / maxBook) * plotH;
  const linePoints = rows.map((r, i) => `${left + slot * i + slot / 2},${yBook(r.bookings)}`).join(" ");
  const areaPoints = `${left + slot / 2},${top + plotH} ${linePoints} ${left + slot * (rows.length - 1) + slot / 2},${top + plotH}`;
  const ticks = [0, 16, 32, 48, 64];
  const totalBook = rows.reduce((sum, r) => sum + r.bookings, 0);
  const peak = rows.reduce((best, r) => (r.bookings > best.bookings ? r : best), rows[0]);

  return (
    <figure className="m-0 min-w-0 overflow-x-auto px-5 pb-5 pt-4">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Revenue ${range}`} className="block h-auto w-full min-w-[470px]">
        <defs>
          <linearGradient id="dashArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={W - right} y1={yBook(tick)} y2={yBook(tick)} stroke="var(--color-border)" strokeWidth="1" />
            <text x={left - 8} y={yBook(tick) + 3} textAnchor="end" fill="var(--color-text-muted)" fontSize="11">{tick}</text>
          </g>
        ))}
        {rows.map((r) => (
          <rect key={r.month} x={left + slot * rows.indexOf(r) + slot / 2 - barW / 2} y={top} width={barW} height={plotH} rx="4" fill="var(--color-primary-soft)" opacity="0.7" />
        ))}
        <polygon points={areaPoints} fill="url(#dashArea)" />
        <polyline points={linePoints} fill="none" stroke="var(--color-primary)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        {rows.map((r, i) => (
          <g key={`p-${r.month}`}>
            <circle cx={left + slot * i + slot / 2} cy={yBook(r.bookings)} r="3.4" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="2" />
            <text x={left + slot * i + slot / 2} y={yBook(r.bookings) - 10} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="11" fontWeight="600">{r.bookings}</text>
          </g>
        ))}
        {rows.map((r, i) => (
          <g key={`b-${r.month}`}>
            <text x={left + slot * i + slot / 2} y={top + plotH + 16} textAnchor="middle" fill="var(--color-text-muted)" fontSize="11">{r.month}</text>
            {!compactChart && <text x={left + slot * i + slot / 2} y={top + plotH - (r.revenue / 180) * plotH * 0.82 - 6} textAnchor="middle" fill="var(--color-text)" fontSize="11" fontWeight="600">{r.revenue}</text>}
          </g>
        ))}
      </svg>
      <figcaption className="mt-2.5 flex flex-wrap gap-4 text-[11.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-[var(--color-primary)] bg-[var(--color-primary-soft)]" />
          {range === "3 months" ? "Bars: revenue (RM thousand)" : "Bars: revenue (RM thousand)"}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-3 rounded bg-[var(--color-primary)]" />
          Line: number of bookings
        </span>
        <span className="ml-auto text-[var(--color-text-secondary)]">{totalBook} bookings in total · peak {peak.month}</span>
      </figcaption>
    </figure>
  );
}

function Donut({ rows }: { rows: typeof BOOKING_MIX }) {
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-4 px-5 pb-5 pt-4">
      <div className="relative h-[140px] w-[140px] flex-none">
        <svg viewBox="0 0 140 140" className="block h-full w-full -rotate-90" role="img" aria-label="Booking distribution">
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-surface-muted)" strokeWidth="18" />
          {rows.map((r) => {
            const len = (r.value / total) * C;
            const dash = `${Math.max(len - 3, 0)} ${C - Math.max(len - 3, 0)}`;
            const el = (
              <circle key={r.label} cx="70" cy="70" r={R} fill="none" stroke={r.color} strokeWidth="18" strokeDasharray={dash} strokeDashoffset={-offset} strokeLinecap="butt" />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          <strong className="text-[21px] tracking-tight [font-variant-numeric:tabular-nums]">{total}</strong>
          <span className="text-[11px] text-muted-foreground">bookings</span>
        </div>
      </div>
      <ul className="m-0 flex min-w-[150px] flex-1 list-none flex-col gap-2 p-0">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="h-2 w-2 flex-none rounded-[2px]" style={{ background: r.color }} />
            <span className="min-w-0 truncate text-[var(--color-text-secondary)]">{r.label}</span>
            <strong className="ml-auto [font-variant-numeric:tabular-nums]">{r.value}</strong>
            <span className="w-[34px] text-right text-muted-foreground [font-variant-numeric:tabular-nums]">{Math.round((r.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DashboardOverview() {
  const { t, lang } = useLang();
  const { kpi } = useDashboardKpi();
  const [range, setRange] = useState<"3m" | "6m">("6m");
  const [tab, setTab] = useState<"departures" | "bookings">("departures");
  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchBookings } = await import("@/lib/live-data");
        const res = await fetchBookings();
        if (!cancelled) setLiveBookings(res.bookings);
      } catch {
        /* live data unavailable — static prototype data remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const locale = lang === "ms" ? "ms-MY" : "en-GB";

  const kpiValue = (key: (typeof KPIS)[number]["key"], isCompact: boolean | undefined): string => {
    const live = kpi as unknown as Record<string, number> | null;
    const value =
      key === "collected"
        ? live?.collected ?? 1600000
        : key === "outstanding"
          ? live?.outstanding ?? 204100
          : (live?.[key] ?? 0);
    if (isCompact) return compact(value);
    if (value > 100) return value.toLocaleString("en-MY");
    return String(value);
  };

  const rows = REVENUE.slice(range === "3m" ? -3 : -6);

  const recentBookings = useMemo(() => {
    if (liveBookings.length === 0) return STATIC_BOOKINGS;
    return [...liveBookings]
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
      .slice(0, 4)
      .map((b) => {
        const tone: Tone =
          b.status === "confirmed" ? "success" : b.status === "pending_deposit" ? "warning" : b.status === "hold" ? "info" : "neutral";
        return {
          id: b.reference,
          customer: b.customerName,
          pax: b.paxAdult + b.paxChild,
          amount: formatRinggit(b.totalAmount),
          status: b.status.replace(/_/g, " "),
          tone,
        };
      });
  }, [liveBookings]);

  return (
    <div className="flex min-w-0 flex-col gap-4 font-[var(--font-body)] text-[var(--color-text)]">
      {/* Page head */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-2xl font-bold tracking-tight">
            {t("Papan Pemuka Perniagaan", "Business Dashboard")}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            {t("Jualan, okupansi dan bayaran sekali pandang — sehingga", "Sales, occupancy and payments at a glance — as of")}{" "}
            {new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] text-[var(--color-text-secondary)]">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString(locale, { month: "short", year: "numeric" })}
          </span>
          <button
            onClick={() => undefined}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[var(--color-surface-muted)]"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
          <a
            href="/bookings"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
            style={{ textDecoration: "none" }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("Tempahan Baharu", "New booking")}
          </a>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {KPIS.map((item) => {
          const Icon = item.icon;
          const Trend = item.up ? TrendingUp : TrendingDown;
          return (
            <article key={item.id} className="flex min-w-0 flex-col gap-2.5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12.5px] font-medium text-muted-foreground">{t(item.label.ms, item.label.en)}</span>
                <span className={cn("grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px]", item.chip)}>
                  <Icon className="h-[15px] w-[15px]" />
                </span>
              </div>
              <strong className="whitespace-nowrap text-[23px] font-bold leading-tight tracking-[-0.03em] [font-variant-numeric:tabular-nums]">
                {kpiValue(item.key, item.compact)}
              </strong>
              <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <span className={cn("inline-flex items-center gap-0.5 font-semibold", item.up ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")}>
                  <Trend className="h-3.5 w-3.5" />
                  {item.delta}
                </span>
                <span>vs last month</span>
              </div>
            </article>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1.62fr_1fr]">
        <Panel className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
            <div className="min-w-0">
              <h2 className="m-0 text-[14.5px] font-semibold">Revenue & Bookings</h2>
              <p className="mb-0 mt-0.5 text-xs text-muted-foreground">
                Average RM 124k / month · last {rows.length} months
              </p>
            </div>
            <div className="inline-flex gap-0.5 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-[3px]">
              {(["3m", "6m"] as const).map((r) => (
                <button
                  key={r}
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md border-0 bg-transparent px-2.5 py-1 text-xs font-semibold text-muted-foreground cursor-pointer",
                    range === r && "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm",
                  )}
                >
                  {r === "3m" ? "3 months" : "6 months"}
                </button>
              ))}
            </div>
          </div>
          <RevenueChart rows={rows} range={range === "3m" ? "3 months" : "6 months"} />
        </Panel>

        <Panel>
          <PanelHead title="Booking status" aside={<Badge tone="neutral">312</Badge>} />
          <Donut rows={BOOKING_MIX} />
          <div className="flex flex-wrap gap-3 px-5 pb-5">
            <div className="min-w-[120px] flex-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground">Payments collected</div>
              <div className="mt-0.5 whitespace-nowrap text-[15px] font-bold [font-variant-numeric:tabular-nums]">RM 1.4m</div>
            </div>
            <div className="min-w-[120px] flex-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground">Outstanding balance</div>
              <div className="mt-0.5 whitespace-nowrap text-[15px] font-bold text-[var(--color-danger)] [font-variant-numeric:tabular-nums]">RM 204.1k</div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Bottom grid */}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1.62fr_1fr]">
        <Panel>
          <PanelHead
            title="Top packages"
            aside={<a href="/packages" className="bg-transparent p-1 text-[12.5px] font-semibold text-[var(--color-primary)]" style={{ textDecoration: "none" }}>View catalogue</a>}
          />
          <div className="flex flex-col">
            {TOP_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] px-5 py-3 first:border-t-0">
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="min-w-[150px] flex-1">
                  <div className="truncate text-[13px] font-semibold">{pkg.name}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground">{pkg.destination}</div>
                </div>
                <div className="min-w-[90px] flex-1">
                  <div className="block h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                    <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.round((pkg.sold / pkg.target) * 100)}%` }} />
                  </div>
                  <div className="mt-1.5 text-[11px] text-muted-foreground [font-variant-numeric:tabular-nums]">{pkg.sold} / {pkg.target} pax</div>
                </div>
                <strong className="flex-none whitespace-nowrap text-[12.5px] [font-variant-numeric:tabular-nums]">{pkg.revenue}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Activity & notifications" aside={<span className="text-[11.5px] text-muted-foreground">4 new</span>} />
          <div className="flex flex-col">
            {FEED.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className={cn("flex items-start gap-3 border-t border-[var(--color-border)] px-5 py-3", idx === 0 && "border-t-0")}>
                  <span className={cn("grid h-[30px] w-[30px] flex-none place-items-center rounded-lg", item.chip)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold">{item.title}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">{item.detail}</div>
                  </div>
                  <span className="ml-auto flex-none whitespace-nowrap text-[10.5px] text-muted-foreground">{item.time}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Records */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
          <div className="inline-flex gap-0.5 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-[3px]">
            {([
              ["departures", "Upcoming departures"],
              ["bookings", "Recent bookings"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-md border-0 bg-transparent px-2.5 py-1 text-xs font-semibold text-muted-foreground cursor-pointer",
                  tab === id && "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <a
            href={tab === "departures" ? "/trips" : "/bookings"}
            className="bg-transparent p-1 text-[12.5px] font-semibold text-[var(--color-primary)]"
            style={{ textDecoration: "none" }}
          >
            {tab === "departures" ? "All departures" : "All bookings"}
          </a>
        </div>

        {tab === "departures" && (
          <div>
            <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(120px,1fr)_minmax(80px,auto)] items-center gap-3 border-b border-[var(--color-border)] px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Package & code</span>
              <span>Date</span>
              <span>Seat occupancy</span>
              <span>Status</span>
            </div>
            {DEPARTURES.map((dep) => {
              const used = dep.booked + dep.held;
              const pct = Math.round((used / dep.capacity) * 100);
              const free = dep.capacity - used;
              const tone: Tone = free <= 2 ? "warning" : pct >= 80 ? "danger" : "success";
              return (
                <a
                  key={dep.id}
                  href="/trips"
                  className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(120px,1fr)_minmax(80px,auto)] items-center gap-3 border-b border-[var(--color-border)] px-5 py-3 last:border-b-0 hover:bg-[var(--color-surface-raised)]"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{dep.package}</div>
                    <div className="text-[11.5px] text-muted-foreground">{dep.id} · TL {dep.leader}</div>
                  </div>
                  <span className="text-[12.5px] text-[var(--color-text-secondary)]">{dep.date}</span>
                  <div>
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                      <span className="block h-full bg-[var(--color-primary)]" style={{ width: `${(dep.booked / dep.capacity) * 100}%` }} />
                      <span className="block h-full bg-[var(--color-warning)]" style={{ width: `${(dep.held / dep.capacity) * 100}%` }} />
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground [font-variant-numeric:tabular-nums]">{dep.booked} booked · {dep.held} held · {free} available</div>
                  </div>
                  <Badge tone={tone}>{free <= 2 ? "Almost full" : "Open"}</Badge>
                </a>
              );
            })}
          </div>
        )}

        {tab === "bookings" && (
          <div>
            <div className="grid grid-cols-[118px_minmax(0,1.2fr)_minmax(0,auto)_auto] items-center gap-3 border-b border-[var(--color-border)] px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Reference</span>
              <span>Customer</span>
              <span>Total</span>
              <span>Status</span>
            </div>
            {recentBookings.map((bk) => (
              <div key={bk.id} className="grid grid-cols-[118px_minmax(0,1.2fr)_minmax(0,auto)_auto] items-center gap-3 border-b border-[var(--color-border)] px-5 py-3 last:border-b-0 hover:bg-[var(--color-surface-raised)]">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">{bk.id}</span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold">{bk.customer}</div>
                  <div className="text-[11.5px] text-muted-foreground">{bk.pax} pax</div>
                </div>
                <strong className="whitespace-nowrap text-[12.5px] [font-variant-numeric:tabular-nums]">{bk.amount}</strong>
                <Badge tone={bk.tone}>{bk.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  BedDouble,
  Download,
  FileText,
  Printer,
  ReceiptText,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { fetchBookings, fetchInvoices } from "@/lib/live-data";
import { apiFetch } from "@/lib/api";
import { formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

/* --------------------------------------------------------------- styles */
const css = `
.rp-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
.rp-kpi { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-panel); padding: var(--space-4); display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.rp-kpi__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.rp-kpi__label { font-size: 12.5px; font-weight: 500; color: var(--color-text-muted); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-kpi__icon { display: grid; place-items: center; width: 30px; height: 30px; flex: none; border-radius: 9px; }
.rp-kpi__value { font-size: 23px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; font-variant-numeric: tabular-nums; white-space: nowrap; }
.rp-kpi__note { font-size: 11.5px; color: var(--color-text-muted); }

.rp-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.rp-tab { display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-pill); background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.rp-tab:hover { background: var(--color-surface-muted); }
.rp-tab[aria-selected="true"] { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
.rp-tab:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
.rp-tab__icon { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 7px; flex: none; }

.rp-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: var(--space-4); align-items: start; }
.rp-panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-panel); min-width: 0; overflow: hidden; }
.rp-panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); padding: 14px var(--space-5); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
.rp-panel__title { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--color-text); }
.rp-panel__sub { margin: 3px 0 0; font-size: 12px; color: var(--color-text-muted); }
.rp-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: var(--radius-pill); background: var(--color-primary-soft); color: var(--color-primary); font-size: 11.5px; font-weight: 600; white-space: nowrap; }

.rp-tablewrap { width: 100%; overflow-x: auto; }
.rp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.rp-table th { padding: 10px var(--space-5); text-align: left; font-weight: 600; color: var(--color-text-muted); background: var(--color-surface-raised); border-bottom: 1px solid var(--color-border); white-space: nowrap; }
.rp-table td { padding: 10px var(--space-5); border-bottom: 1px solid var(--color-border); color: var(--color-text); white-space: nowrap; }
.rp-table tbody tr:last-child td { border-bottom: 0; }
.rp-table tbody tr:hover td { background: var(--color-surface-raised); }
.rp-table .rp-num { text-align: right; font-variant-numeric: tabular-nums; }
.rp-table .rp-cap { text-transform: capitalize; }
.rp-empty { padding: var(--space-8) var(--space-5); text-align: center; color: var(--color-text-muted); font-size: 13px; }

.rp-chart { display: flex; gap: 10px; align-items: flex-end; height: 200px; padding: 10px var(--space-5) 0; overflow-x: auto; }
.rp-chart__col { flex: 1 0 38px; max-width: 58px; min-width: 38px; height: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.rp-chart__barwrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid var(--color-border); }
.rp-chart__bar { width: 100%; max-width: 30px; border-radius: var(--radius-control) var(--radius-control) 3px 3px; background: var(--color-primary); transition: background 140ms ease; }
.rp-chart__col:hover .rp-chart__bar { background: var(--color-primary-hover); }
.rp-chart__value { font-size: 10.5px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text-secondary); white-space: nowrap; }
.rp-chart__label { font-size: 11px; color: var(--color-text-muted); white-space: nowrap; }
.rp-chart__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-border); font-size: 12.5px; flex-wrap: wrap; }
.rp-chart__foot > span { color: var(--color-text-muted); }
.rp-chart__foot strong { font-variant-numeric: tabular-nums; }
.rp-legend { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--color-text-muted); }
.rp-legend i { width: 9px; height: 9px; border-radius: 3px; background: var(--color-primary); display: inline-block; }

.rp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.rp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border-radius: var(--radius-control); border: 1px solid var(--color-border); background: var(--color-surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--color-text); cursor: pointer; }
.rp-btn:hover { background: var(--color-surface-muted); }
.rp-btn--primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.rp-btn--primary:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
.rp-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }

@media (max-width: 1279px) { .rp-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .rp-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 640px) { .rp-kpis { grid-template-columns: minmax(0, 1fr); } .rp-panel__head { padding: 12px var(--space-4); } .rp-table th, .rp-table td { padding: 9px var(--space-4); } .rp-chart { padding-left: var(--space-4); padding-right: var(--space-4); } }
@media (prefers-reduced-motion: reduce) { .rp-btn, .rp-chart__bar, .rp-tab { transition: none; } }
`;

/* ---------------------------------------------------------------- types */
type ReportKind = "sales" | "finance" | "occupancy" | "staff";

interface ReportColumn {
  key: string;
  labelMs: string;
  labelEn: string;
  align?: "right";
}

const REPORTS: Record<
  ReportKind,
  {
    labelMs: string;
    labelEn: string;
    descMs: string;
    descEn: string;
    icon: LucideIcon;
    bg: string;
    fg: string;
  }
> = {
  sales: {
    labelMs: "Laporan Jualan",
    labelEn: "Sales Report",
    descMs: "Tempahan, nilai transaksi, dan pembayaran setiap bulan",
    descEn: "Bookings, transaction value, and monthly payments",
    icon: BarChart3,
    bg: "var(--color-primary-soft)",
    fg: "var(--color-primary)",
  },
  finance: {
    labelMs: "Laporan Kewangan",
    labelEn: "Finance Report",
    descMs: "Invois, kutipan, baki tertunggak, dan bayaran balik",
    descEn: "Invoices, collections, outstanding balances, and refunds",
    icon: Wallet,
    bg: "var(--color-info-soft)",
    fg: "var(--color-info)",
  },
  occupancy: {
    labelMs: "Laporan Okupansi",
    labelEn: "Occupancy Report",
    descMs: "Pax terisi setiap pakej dan status keberangkatan",
    descEn: "Pax filled per package and departure status",
    icon: BedDouble,
    bg: "var(--color-success-soft)",
    fg: "var(--color-success)",
  },
  staff: {
    labelMs: "Laporan Staf",
    labelEn: "Staff Report",
    descMs: "Aktiviti dan sumbangan setiap ejen",
    descEn: "Activity and contribution per agent",
    icon: Users,
    bg: "var(--color-warning-soft)",
    fg: "var(--color-warning)",
  },
};

interface BookingLike {
  status: string;
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  packageName: string;
  departureDate: string;
  paxAdult: number;
  paxChild: number;
}
interface InvoiceLike {
  status: string;
  number: string;
  customerName: string;
  total: number;
  paidAmount: number;
  balanceDue: number;
}
interface LeadLike {
  assignedTo: string;
  stage: string;
}

/* --------------------------------------------------------------- helpers */
function buildRows(
  kind: ReportKind,
  bookings: BookingLike[],
  invoices: InvoiceLike[],
  leads: LeadLike[],
): { columns: ReportColumn[]; rows: Record<string, string | number>[] } {
  if (kind === "sales") {
    const byMonth = new Map<string, Record<string, string | number>>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const month = b.createdAt.slice(0, 7);
      const entry =
        byMonth.get(month) ?? { month, bookings: 0, gross: 0, paid: 0 };
      entry.bookings = (entry.bookings as number) + 1;
      entry.gross = (entry.gross as number) + b.totalAmount;
      entry.paid = (entry.paid as number) + b.paidAmount;
      byMonth.set(month, entry);
    }
    return {
      columns: [
        { key: "month", labelMs: "Bulan", labelEn: "Month" },
        { key: "bookings", labelMs: "Tempahan", labelEn: "Bookings", align: "right" },
        { key: "gross", labelMs: "Nilai Transaksi", labelEn: "Transaction value", align: "right" },
        { key: "paid", labelMs: "Terkumpul", labelEn: "Collected", align: "right" },
      ],
      rows: [...byMonth.values()].sort((a, b) =>
        String(a.month).localeCompare(String(b.month)),
      ),
    };
  }

  if (kind === "finance") {
    const rows = invoices
      .filter((i) => i.status !== "draft")
      .map((i) => ({
        number: i.number,
        customer: i.customerName,
        status: i.status,
        total: i.total,
        paid: i.paidAmount,
        balance: i.balanceDue,
      }));
    return {
      columns: [
        { key: "number", labelMs: "Invois", labelEn: "Invoice" },
        { key: "customer", labelMs: "Pelanggan", labelEn: "Customer" },
        { key: "status", labelMs: "Status", labelEn: "Status" },
        { key: "total", labelMs: "Jumlah", labelEn: "Total", align: "right" },
        { key: "paid", labelMs: "Dibayar", labelEn: "Paid", align: "right" },
        { key: "balance", labelMs: "Baki", labelEn: "Balance", align: "right" },
      ],
      rows,
    };
  }

  if (kind === "occupancy") {
    const byPkg = new Map<string, Record<string, string | number>>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const entry =
        byPkg.get(b.packageName) ??
        { pkg: b.packageName, pax: 0, bookings: 0, lastDeparture: "—" };
      entry.pax = (entry.pax as number) + b.paxAdult + b.paxChild;
      entry.bookings = (entry.bookings as number) + 1;
      if (b.departureDate > String(entry.lastDeparture)) {
        entry.lastDeparture = b.departureDate;
      }
      byPkg.set(b.packageName, entry);
    }
    return {
      columns: [
        { key: "pkg", labelMs: "Pakej", labelEn: "Package" },
        { key: "bookings", labelMs: "Tempahan", labelEn: "Bookings", align: "right" },
        { key: "pax", labelMs: "Jumlah Pax", labelEn: "Total pax", align: "right" },
        { key: "lastDeparture", labelMs: "Keberangkatan Terakhir", labelEn: "Last departure" },
      ],
      rows: [...byPkg.values()],
    };
  }

  const byAgent = new Map<string, Record<string, string | number>>();
  for (const l of leads) {
    const entry =
      byAgent.get(l.assignedTo) ??
      { agent: l.assignedTo, leads: 0, won: 0, lost: 0, customers: 0 };
    entry.leads = (entry.leads as number) + 1;
    if (l.stage === "won") entry.won = (entry.won as number) + 1;
    if (l.stage === "lost") entry.lost = (entry.lost as number) + 1;
    byAgent.set(l.assignedTo, entry);
  }
  return {
    columns: [
      { key: "agent", labelMs: "Ejen", labelEn: "Agent" },
      { key: "leads", labelMs: "Leads", labelEn: "Leads", align: "right" },
      { key: "won", labelMs: "Menang", labelEn: "Won", align: "right" },
      { key: "lost", labelMs: "Kalah", labelEn: "Lost", align: "right" },
      { key: "customers", labelMs: "Pelanggan", labelEn: "Customers", align: "right" },
    ],
    rows: [...byAgent.values()],
  };
}

function Ikon({
  icon,
  size = 15,
  style,
}: {
  icon: LucideIcon;
  size?: number;
  style?: React.CSSProperties;
}) {
  const Icon = icon;
  return (
    <Icon
      aria-hidden="true"
      style={{ fontSize: `${size}px`, width: size, height: size, flex: "none", ...style }}
    />
  );
}

function Kpi({
  id,
  label,
  nilai,
  catatan,
  ikon,
  bg,
  fg,
}: {
  id: string;
  label: string;
  nilai: string;
  catatan: string;
  ikon: LucideIcon;
  bg: string;
  fg: string;
}) {
  return (
    <article className="rp-kpi" data-node-id={`rp.kpi.${id}`}>
      <div className="rp-kpi__top">
        <span className="rp-kpi__label" title={label}>{label}</span>
        <span className="rp-kpi__icon" style={{ background: bg, color: fg }}>
          <Ikon icon={ikon} />
        </span>
      </div>
      <strong className="rp-kpi__value">{nilai}</strong>
      <span className="rp-kpi__note">{catatan}</span>
    </article>
  );
}

const BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
function labelBulan(month: string): string {
  const [year, m] = month.split("-");
  const index = Number(m) - 1;
  const name = index >= 0 && index < BULAN.length ? BULAN[index] : m;
  return `${name} ${year.slice(2)}`;
}

/* ------------------------------------------------------------------ page */
export default function ReportsPage() {
  const { t } = useLang();
  const [kind, setKind] = useState<ReportKind>("sales");
  const [bookings, setBookings] = useState<BookingLike[]>([]);
  const [invoices, setInvoices] = useState<InvoiceLike[]>([]);
  const [leads, setLeads] = useState<LeadLike[]>([]);

  // Live data from D1 (loaders fall back to mock data).
  useEffect(() => {
    (async () => {
      const [b, i] = await Promise.all([fetchBookings(), fetchInvoices()]);
      setBookings(b.bookings);
      setInvoices(i.invoices);
      try {
        const l = await apiFetch<{ success: boolean; data?: LeadLike[]; leads?: LeadLike[] }>(
          "/leads?limit=200",
        );
        if (l.success) setLeads(l.data ?? l.leads ?? []);
      } catch {
        // leads are optional
      }
    })();
  }, []);

  const report = useMemo(
    () => buildRows(kind, bookings, invoices, leads),
    [kind, bookings, invoices, leads],
  );

  const kpis = useMemo(() => {
    const aktif = bookings.filter((b) => b.status !== "cancelled");
    const gross = aktif.reduce((n, b) => n + b.totalAmount, 0);
    const paid = aktif.reduce((n, b) => n + b.paidAmount, 0);
    return { count: aktif.length, gross, paid, balance: Math.max(gross - paid, 0) };
  }, [bookings]);

  const monthly = useMemo(() => {
    const byMonth = new Map<string, { month: string; gross: number; paid: number; count: number }>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      const month = b.createdAt.slice(0, 7);
      const entry = byMonth.get(month) ?? { month, gross: 0, paid: 0, count: 0 };
      entry.gross += b.totalAmount;
      entry.paid += b.paidAmount;
      entry.count += 1;
      byMonth.set(month, entry);
    }
    return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-8);
  }, [bookings]);

  const maxGross = useMemo(
    () => Math.max(1, ...monthly.map((m) => m.gross)),
    [monthly],
  );
  const totalRevenue = monthly.reduce((n, m) => n + m.gross, 0);
  const meta = REPORTS[kind];

  const handleExport = () => {
    const header = report.columns.map((c) => `"${t(c.labelMs, c.labelEn)}"`).join(",");
    const body = report.rows
      .map((r) =>
        report.columns
          .map((c) => `"${String(r[c.key] ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const csv = `${header}\n${body}`;
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main
      data-node-id="rp.root"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-5) var(--space-6) var(--space-8)", minWidth: 0, color: "var(--color-text)" }}
    >
      <style>{css}</style>

      {/* Page head */}
      <div className="tvl-pagehead" data-node-id="rp.header">
        <div style={{ minWidth: 0 }}>
          <h1 className="tvl-title" data-node-id="rp.title">{t("Laporan", "Reports")}</h1>
          <p className="tvl-subtitle">
            {t("Pratonton laporan perniagaan dan hasilkan eksport CSV.", "Preview business reports and generate CSV exports.")}
          </p>
        </div>
        <div className="rp-actions">
          <button type="button" className="rp-btn" data-action="rp:print" onClick={() => window.print()}>
            <Ikon icon={Printer} />
            {t("Cetak", "Print")}
          </button>
          <button type="button" className="rp-btn rp-btn--primary" data-action="rp:export" onClick={handleExport}>
            <Ikon icon={Download} />
            {t("Eksport CSV", "Export CSV")}
          </button>
        </div>
      </div>

      {/* Report type picker */}
      <div className="rp-tabs" role="tablist" aria-label={t("Jenis laporan", "Report type")} data-node-id="rp.tabs">
        {(Object.keys(REPORTS) as ReportKind[]).map((key) => {
          const r = REPORTS[key];
          const active = kind === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`rp-tab-${key}`}
              className="rp-tab"
              aria-selected={active}
              data-action={`rp:tab-${key}`}
              onClick={() => setKind(key)}
            >
              <span className="rp-tab__icon" style={{ background: active ? r.bg : "var(--color-neutral-soft)", color: active ? r.fg : "var(--color-text-secondary)" }}>
                <Ikon icon={r.icon} size={14} />
              </span>
              {t(r.labelMs, r.labelEn)}
            </button>
          );
        })}
      </div>

      {/* KPI cards */}
      <div className="rp-kpis" data-node-id="rp.kpis">
        <Kpi
          id="tempahan"
          label={t("Jumlah tempahan", "Total bookings")}
          nilai={String(kpis.count)}
          catatan={t("Tidak termasuk tempahan dibatalkan", "Excludes cancelled bookings")}
          ikon={BarChart3}
          bg="var(--color-primary-soft)"
          fg="var(--color-primary)"
        />
        <Kpi
          id="nilai"
          label={t("Nilai transaksi", "Transaction value")}
          nilai={formatRinggit(kpis.gross)}
          catatan={t("Nilai kasar tempahan aktif", "Gross value of active bookings")}
          ikon={Wallet}
          bg="var(--color-info-soft)"
          fg="var(--color-info)"
        />
        <Kpi
          id="kutipan"
          label={t("Bayaran terkumpul", "Payments collected")}
          nilai={formatRinggit(kpis.paid)}
          catatan={t("Deposit dan baki diterima", "Deposits and balances received")}
          ikon={Banknote}
          bg="var(--color-success-soft)"
          fg="var(--color-success)"
        />
        <Kpi
          id="baki"
          label={t("Baki tertunggak", "Outstanding balance")}
          nilai={formatRinggit(kpis.balance)}
          catatan={t("Masih perlu dikutip", "Still to be collected")}
          ikon={ReceiptText}
          bg="var(--color-warning-soft)"
          fg="var(--color-warning)"
        />
      </div>

      {/* Summary table + revenue chart */}
      <div className="rp-grid">
        <section className="rp-panel" data-node-id="rp.table" aria-labelledby="rp-table-title">
          <div className="rp-panel__head">
            <div style={{ minWidth: 0 }}>
              <h2 className="rp-panel__title" id="rp-table-title">
                {t(meta.labelMs, meta.labelEn)} — {report.rows.length} {t("baris", "rows")}
              </h2>
              <p className="rp-panel__sub">{t(meta.descMs, meta.descEn)}</p>
            </div>
            <span className="rp-badge">
              <Ikon icon={FileText} size={12} />
              {t("Ringkasan", "Summary")}
            </span>
          </div>
          <div className="rp-tablewrap">
            <table className="rp-table">
              <thead>
                <tr>
                  {report.columns.map((col) => (
                    <th key={col.key} scope="col" className={col.align === "right" ? "rp-num" : undefined}>
                      {t(col.labelMs, col.labelEn)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, idx) => (
                  <tr key={idx}>
                    {report.columns.map((col) => {
                      const value = row[col.key];
                      const money = typeof value === "number" && ["gross", "paid", "total", "balance"].includes(col.key);
                      return (
                        <td
                          key={col.key}
                          className={[
                            col.align === "right" ? "rp-num" : "",
                            col.key === "status" ? "rp-cap" : "",
                          ].filter(Boolean).join(" ")}
                        >
                          {money ? formatRinggit(value as number) : String(value ?? "—")}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={report.columns.length} className="rp-empty">
                      {t("Tiada data untuk laporan ini.", "No data for this report.")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rp-panel" data-node-id="rp.chart" aria-labelledby="rp-chart-title">
          <div className="rp-panel__head">
            <div style={{ minWidth: 0 }}>
              <h2 className="rp-panel__title" id="rp-chart-title">{t("Hasil Bulanan", "Monthly Revenue")}</h2>
              <p className="rp-panel__sub">
                {t("Nilai transaksi tempahan mengikut bulan", "Booking transaction value by month")}
              </p>
            </div>
            <span className="rp-legend"><i aria-hidden="true" />{t("Nilai", "Value")}</span>
          </div>
          {monthly.length > 0 ? (
            <div
              className="rp-chart"
              role="img"
              aria-label={t("Carta bar hasil bulanan", "Monthly revenue bar chart")}
              data-node-id="rp.chart.bars"
            >
              {monthly.map((item) => {
                const height = Math.max(4, Math.round((item.gross / maxGross) * 100));
                return (
                  <div className="rp-chart__col" key={item.month} title={`${labelBulan(item.month)} · ${formatRinggit(item.gross)}`}>
                    <span className="rp-chart__barwrap">
                      <span className="rp-chart__bar" style={{ height: `${height}%` }} />
                    </span>
                    <span className="rp-chart__value">{formatRinggit(item.gross)}</span>
                    <span className="rp-chart__label">{labelBulan(item.month)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rp-empty">{t("Tiada data hasil untuk dipaparkan.", "No revenue data to display.")}</div>
          )}
          <div className="rp-chart__foot">
            <span>{t("Jumlah hasil", "Total revenue")}</span>
            <strong>{formatRinggit(totalRevenue)}</strong>
          </div>
        </section>
      </div>
    </main>
  );
}

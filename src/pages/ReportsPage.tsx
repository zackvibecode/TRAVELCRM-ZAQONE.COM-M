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
      className="rp-icon"
      style={{ "--size": `${size}px`, ...style } as React.CSSProperties}
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
    <main className="rp-root" data-node-id="rp.root">
      {/* Page head */}
      <div className="tvl-pagehead" data-node-id="rp.header">
        <div className="rp-min0">
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
              <span
                className="rp-tab__icon"
                style={active ? ({ "--tab-bg": r.bg, "--tab-fg": r.fg } as React.CSSProperties) : undefined}
              >
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
            <div className="rp-min0">
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
            <div className="rp-min0">
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
                      <span className="rp-chart__bar" style={{ "--h": `${height}%` } as React.CSSProperties} />
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

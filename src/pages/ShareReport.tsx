import { useMemo, useState } from "react";
import {
  BarChart3,
  Banknote,
  Download,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLang } from "@/lib/i18n";
import { getSession, type StaffRole } from "@/lib/auth";
import {
  leadSourceApi,
  percentChange,
  shareReportApi,
  useLeadSources,
  useShareDashboard,
  useShareEntries,
  type LeadSource,
  type ShareEntry,
} from "@/lib/sales-report-api";

/**
 * Report Monthly — sales submit their own monthly entries (customer name,
 * packs, lead source). Dashboard + Excel export + Lead Sources live here.
 * Separated from the follow-up module entirely.
 */

const PANEL = "tv-panel";
const BTN = "tv-btn disabled:opacity-55 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} tv-btn--primary`;
const INPUT =
  "w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)]";

const PIE_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#84cc16",
  "#f97316",
];

function monthKey(offset = 0): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string, lang: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", {
    month: "long",
    year: "numeric",
  });
}

/** Format a MYR amount, e.g. 12450.5 → "RM 12,450.50". */
function formatRM(amount: number): string {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface StatCardProps {
  label: string;
  value: string;
  icon: typeof UserRound;
  change: number | null;
}

function StatCard({ label, value, icon: Icon, change }: StatCardProps) {
  const up = (change ?? 0) >= 0;
  return (
    <div className={`${PANEL} flex flex-col gap-2 p-5`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-text-secondary)]">
          <Icon className="h-4 w-4" />
          {label}
        </span>
        {change !== null && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
              up
                ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
            }`}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? "+" : ""}
            {change}%
          </span>
        )}
      </div>
      <div className="text-[24px] font-black leading-none text-[var(--color-text)]">{value}</div>
    </div>
  );
}

export default function ShareReport() {
  const { t, lang } = useLang();
  const session = getSession();
  const role: StaffRole | undefined = session?.role;
  const isAdmin = role === "super_admin" || role === "management";

  const [month, setMonth] = useState(monthKey());
  const [ownerFilter, setOwnerFilter] = useState("all");

  const owner = isAdmin ? ownerFilter : undefined;
  const dashboard = useShareDashboard(month, owner);
  const entries = useShareEntries(month, owner);
  const sources = useLeadSources();

  const sourceChartData = useMemo(
    () => (dashboard.data?.sources ?? []).map((s) => ({ name: s.source, nilai: s.count })),
    [dashboard.data],
  );

  const d = dashboard.data;
  const entryList = entries.data ?? [];

  async function refreshAll() {
    await Promise.all([dashboard.refetch(), entries.refetch()]);
  }

  /** Export the month's entries as CSV (opens directly in Excel). */
  function exportExcel() {
    const header = [
      t("Nama Customer", "Customer Name"),
      t("Pack", "Packs"),
      t("Sumber Lead", "Lead Source"),
      t("Total Invoice", "Total Invoice"),
      ...(isAdmin ? [t("Sales", "Sales")] : []),
      t("Tarikh", "Date"),
    ];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = entryList.map((e) =>
      [
        esc(e.customerName),
        esc(e.packs),
        esc(e.source || "-"),
        esc(e.invoiceTotal.toFixed(2)),
        ...(isAdmin ? [esc(e.userName)] : []),
        esc(e.createdAt.slice(0, 10)),
      ].join(","),
    );
    // Totals row at the bottom.
    const totalCustomers = entryList.length;
    const totalPacks = entryList.reduce((sum, e) => sum + e.packs, 0);
    const totalInvoice = entryList.reduce((sum, e) => sum + e.invoiceTotal, 0);
    rows.push("");
    rows.push(
      [
        esc(t("JUMLAH", "TOTAL")),
        esc(totalPacks),
        esc(""),
        esc(totalInvoice.toFixed(2)),
        ...(isAdmin ? [esc("")] : []),
        esc(`${totalCustomers} ${t("customer", "customer(s)")}`),
      ].join(","),
    );
    // \uFEFF BOM so Excel detects UTF-8 (Malay names render correctly).
    const csv = "\uFEFF" + [header.map(esc).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-monthly-${month}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Report Monthly", "Monthly Report")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Laporan bulanan sales — isi customer, pack terjual dan sumber lead. Boleh export Excel.",
              "Monthly sales report — submit customers, packs sold and lead sources. Exportable to Excel.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={INPUT}>
            {[0, 1, 2, 3, 4, 5].map((offset) => {
              const m = monthKey(-offset);
              return (
                <option key={m} value={m}>
                  {monthLabel(m, lang)}
                </option>
              );
            })}
          </select>
          {isAdmin && (
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className={INPUT}
            >
              <option value="all">{t("Seluruh team", "Whole team")}</option>
            </select>
          )}
          <button
            type="button"
            onClick={exportExcel}
            disabled={entryList.length === 0}
            className={BTN}
            title={t("Export Excel", "Export Excel")}
          >
            <Download className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void refreshAll()} className={BTN}>
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {dashboard.error && (
        <div className="rounded-[var(--radius-control)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-2.5 text-[13px] text-[var(--color-danger)]">
          {dashboard.error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label={t("Customer", "Customers")}
          value={String(d?.customers ?? 0)}
          icon={UserRound}
          change={d ? percentChange(d.customers, d.previous.customers) : null}
        />
        <StatCard
          label={t("Pack terjual", "Packs sold")}
          value={String(d?.packs ?? 0)}
          icon={Package}
          change={d ? percentChange(d.packs, d.previous.packs) : null}
        />
      </div>

      {/* Total Invoice summary */}
      <div className={`${PANEL} flex flex-col gap-2 p-5`}>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-text-secondary)]">
            <Banknote className="h-4 w-4" />
            {t("Total Invoice", "Total Invoice")}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--color-success)]">
            {d ? percentChange(d.invoiceTotal, d.previous.invoiceTotal) ?? 0 : 0}%
          </span>
        </div>
        <div className="text-[24px] font-black leading-none text-[var(--color-text)]">
          {formatRM(d?.invoiceTotal ?? 0)}
        </div>
        <p className="text-[11.5px] text-[var(--color-text-secondary)]">
          {t("Jumlah nilai invoice bulan ini", "Total invoiced value this month")}
        </p>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${PANEL} p-5`}>
          <h2 className="mb-3 text-[14px] font-bold text-[var(--color-text)]">
            {t("Aktiviti harian", "Daily activity")}
          </h2>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d?.daily ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="day"
                  tickFormatter={(v: string) => v.slice(-2)}
                  fontSize={11}
                  stroke="var(--color-text-secondary)"
                />
                <YAxis allowDecimals={false} fontSize={11} stroke="var(--color-text-secondary)" />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="entries"
                  name={t("Customer di-share", "Customers shared")}
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="packs"
                  name={t("Pack", "Packs")}
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${PANEL} p-5`}>
          <h2 className="mb-3 text-[14px] font-bold text-[var(--color-text)]">
            {t("Share daripada mana", "Where shares come from")}
          </h2>
          {sourceChartData.length === 0 ? (
            <div className="grid h-[260px] place-items-center text-[13px] text-[var(--color-text-secondary)]">
              {t("Tiada share bulan ini.", "No shares this month.")}
            </div>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceChartData}
                    dataKey="nilai"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {sourceChartData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <EntriesCard
        month={month}
        entries={entryList}
        sources={sources.data ?? []}
        isAdmin={isAdmin}
        onChanged={() => void refreshAll()}
      />

      <LeadSourcesCard
        isAdmin={isAdmin}
        sources={sources.data ?? []}
        onChanged={() => void sources.refetch()}
      />
    </div>
  );
}

/** Share Report entries — the form sales fill in + the monthly list. */
function EntriesCard(props: {
  month: string;
  entries: ShareEntry[];
  sources: LeadSource[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const { t } = useLang();
  const { month, entries, sources, isAdmin, onChanged } = props;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShareEntry | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [packs, setPacks] = useState("1");
  const [invoiceTotal, setInvoiceTotal] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setCustomerName("");
    setPacks("1");
    setInvoiceTotal("");
    setSource("");
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(entry: ShareEntry) {
    setEditing(entry);
    setCustomerName(entry.customerName);
    setPacks(String(entry.packs));
    setInvoiceTotal(
      entry.invoiceTotal > 0 ? String(entry.invoiceTotal) : "",
    );
    setSource(entry.source);
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!customerName.trim()) {
      setError(t("Nama customer diperlukan", "Customer name is required"));
      return;
    }
    const amount = Number(invoiceTotal.replace(/,/g, ""));
    if (invoiceTotal.trim() !== "" && (!Number.isFinite(amount) || amount < 0)) {
      setError(t("Total invoice tidak sah", "Invalid invoice total"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await shareReportApi.updateEntry(editing.id, {
          customerName: customerName.trim(),
          packs: Number(packs),
          source,
          invoiceTotal: amount,
        });
      } else {
        await shareReportApi.createEntry({
          month,
          customerName: customerName.trim(),
          packs: Number(packs),
          source,
          invoiceTotal: amount,
        });
      }
      setDialogOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry: ShareEntry) {
    if (!window.confirm(t(`Padam share "${entry.customerName}"?`, `Delete share "${entry.customerName}"?`))) {
      return;
    }
    try {
      await shareReportApi.deleteEntry(entry.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memadam");
    }
  }

  return (
    <div className={`${PANEL} flex flex-col gap-4 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[14px] font-bold text-[var(--color-text)]">
          <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
          {t("Senarai Share", "Share List")}
        </h2>
        <button type="button" onClick={openCreate} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" />
          {t("Isi Share Report", "Submit Share Report")}
        </button>
      </div>

      {error && (
        <div className="rounded-[var(--radius-control)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {entries.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          {t(
            "Belum ada share report bulan ini. Tekan \"Isi Share Report\" untuk mula.",
            "No share reports this month yet. Click \"Submit Share Report\" to start.",
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">
                <th className="py-2 pr-3 font-semibold">{t("Nama Customer", "Customer Name")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Pack", "Packs")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Sumber Lead", "Lead Source")}</th>
                <th className="py-2 pr-3 font-semibold">{t("Total Invoice", "Total Invoice")}</th>
                {isAdmin && <th className="py-2 pr-3 font-semibold">{t("Sales", "Sales")}</th>}
                <th className="py-2 pr-3 font-semibold">{t("Tarikh", "Date")}</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="py-2.5 pr-3 font-semibold text-[var(--color-text)]">
                    {entry.customerName}
                  </td>
                  <td className="py-2.5 pr-3 text-[var(--color-text)]">{entry.packs}</td>
                  <td className="py-2.5 pr-3 text-[var(--color-text-secondary)]">
                    {entry.source || "—"}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-[var(--color-text)]">
                    {formatRM(entry.invoiceTotal)}
                  </td>
                  {isAdmin && (
                    <td className="py-2.5 pr-3 text-[var(--color-text-secondary)]">
                      {entry.userName}
                    </td>
                  )}
                  <td className="py-2.5 pr-3 text-[12px] text-[var(--color-text-secondary)]">
                    {entry.createdAt.slice(0, 10)}
                  </td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        className="text-[var(--color-primary)] hover:underline"
                        title={t("Edit", "Edit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(entry)}
                        className="text-[var(--color-danger)] hover:underline"
                        title={t("Padam", "Delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className={`${PANEL} w-full max-w-[420px] p-5`}>
            <h3 className="mb-4 text-[15px] font-bold text-[var(--color-text)]">
              {editing ? t("Edit Share", "Edit Share") : t("Isi Share Report", "Submit Share Report")}
            </h3>
            <div className="flex flex-col gap-3">
              <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                {t("Nama Customer", "Customer Name")}
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t("cth. Ahmad bin Ali", "e.g. Ahmad bin Ali")}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
              <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                {t("Berapa pack", "How many packs")}
                <input
                  type="number"
                  min="1"
                  value={packs}
                  onChange={(e) => setPacks(e.target.value)}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
              <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                {t("Total invoice (RM)", "Total invoice (RM)")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceTotal}
                  onChange={(e) => setInvoiceTotal(e.target.value)}
                  placeholder="0.00"
                  className={`mt-1 ${INPUT}`}
                />
              </label>
              <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                {t("Share daripada mana (sumber lead)", "Where the lead came from")}
                <select value={source} onChange={(e) => setSource(e.target.value)} className={`mt-1 ${INPUT}`}>
                  <option value="">{t("— Pilih sumber —", "— Choose source —")}</option>
                  {sources
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className={`${BTN_PRIMARY} flex-1 justify-center`}
              >
                {t("Simpan", "Save")}
              </button>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className={`${BTN} flex-1 justify-center`}
              >
                {t("Batal", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Lead Sources — read-only list for sales; full CRUD for admins. */
function LeadSourcesCard(props: {
  isAdmin: boolean;
  sources: LeadSource[];
  onChanged: () => void;
}) {
  const { t } = useLang();
  const { isAdmin, sources, onChanged } = props;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LeadSource | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(source: LeadSource) {
    setEditing(source);
    setFormName(source.name);
    setFormDesc(source.description ?? "");
    setError(null);
    setDialogOpen(true);
  }

  async function save() {
    if (!formName.trim()) {
      setError(t("Nama sumber diperlukan", "Source name is required"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await leadSourceApi.update(editing.id, {
          name: formName.trim(),
          description: formDesc.trim() || null,
        });
      } else {
        await leadSourceApi.create({
          name: formName.trim(),
          description: formDesc.trim() || undefined,
        });
      }
      setDialogOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function remove(source: LeadSource) {
    if (!window.confirm(t(`Padam sumber "${source.name}"?`, `Delete source "${source.name}"?`))) {
      return;
    }
    try {
      await leadSourceApi.remove(source.id);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memadam");
    }
  }

  return (
    <div className={`${PANEL} flex flex-col gap-4 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-[var(--color-text)]">
            <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
            {t("Sumber Lead", "Lead Sources")}
          </h2>
          <p className="mt-0.5 text-[11.5px] text-[var(--color-text-secondary)]">
            {t(
              "Jadi pilihan \"share daripada mana\" dalam borang share report.",
              "Becomes the lead-source dropdown in the share report form.",
            )}
          </p>
        </div>
        {isAdmin && (
          <button type="button" onClick={openCreate} className={BTN_PRIMARY}>
            <Plus className="h-4 w-4" />
            {t("Sumber Baru", "New Source")}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-[var(--radius-control)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-[12.5px] text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {sources.length === 0 ? (
        <p className="text-[13px] text-[var(--color-text-secondary)]">
          {t("Belum ada sumber lead.", "No lead sources yet.")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--color-text)]">
                    {source.name}
                  </span>
                  {!source.active && (
                    <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-secondary)]">
                      {t("Tak aktif", "Inactive")}
                    </span>
                  )}
                </div>
                {source.description && (
                  <div className="truncate text-[11.5px] text-[var(--color-text-secondary)]">
                    {source.description}
                  </div>
                )}
              </div>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => openEdit(source)}
                    className="shrink-0 text-[11.5px] font-semibold text-[var(--color-primary)] hover:underline"
                  >
                    {t("Edit", "Edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(source)}
                    className="shrink-0 text-[11.5px] font-semibold text-[var(--color-danger)] hover:underline"
                  >
                    {t("Padam", "Delete")}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className={`${PANEL} w-full max-w-[420px] p-5`}>
            <h3 className="mb-4 text-[15px] font-bold text-[var(--color-text)]">
              {editing ? t("Edit Sumber", "Edit Source") : t("Sumber Baru", "New Source")}
            </h3>
            <div className="flex flex-col gap-3">
              <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                {t("Nama", "Name")}
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t("cth. Facebook, TikTok, Walk-in", "e.g. Facebook, TikTok, Walk-in")}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
              <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                {t("Deskripsi (pilihan)", "Description (optional)")}
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={2}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className={`${BTN_PRIMARY} flex-1 justify-center`}
              >
                {t("Simpan", "Save")}
              </button>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className={`${BTN} flex-1 justify-center`}
              >
                {t("Batal", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




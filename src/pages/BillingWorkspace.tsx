import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Invoice, Payment } from "@/lib/types";
import { fetchInvoices, fetchPayments } from "@/lib/live-data";

// ---------------------------------------------------------------------------
// Row shape mirroring the prototype (payments.page.jsx).
// ---------------------------------------------------------------------------

type RowStatus = "awaiting" | "deposit" | "review" | "paid" | "overdue";

interface HistoryItem {
  label: string;
  date: string;
  amount: number;
  method: string;
}

interface Row {
  id: string;
  name: string;
  pkg: string;
  method: string;
  amount: number;
  paid: number;
  due: string;
  status: RowStatus;
  history: HistoryItem[];
}

const METHOD_LABEL: Record<string, string> = {
  bank_transfer: "Bank transfer",
  credit_card: "Credit card",
  cash: "Cash",
  ewallet: "E-Wallet",
  other: "Other",
};

function statusFromInvoice(inv: Invoice): RowStatus {
  switch (inv.status) {
    case "paid":
      return "paid";
    case "partially_paid":
      return "deposit";
    case "overdue":
      return "overdue";
    case "draft":
    case "issued":
    case "void":
    default:
      return inv.paidAmount > 0 ? "deposit" : "awaiting";
  }
}

// Empty until live invoices load from the API.
const STATIC_ROWS: Row[] = [];

const STATUS: Record<RowStatus, { labelMs: string; labelEn: string; bg: string; fg: string }> = {
  awaiting: { labelMs: "Menunggu bayaran", labelEn: "Awaiting payment", bg: "var(--color-surface-muted)", fg: "var(--color-text-secondary)" },
  deposit: { labelMs: "Deposit dibayar", labelEn: "Deposit paid", bg: "var(--color-info-soft)", fg: "var(--color-info)" },
  review: { labelMs: "Dalam semakan", labelEn: "In review", bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  paid: { labelMs: "Dibayar", labelEn: "Paid", bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  overdue: { labelMs: "Tertunggak", labelEn: "Overdue", bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
};

const FILTERS: { value: "all" | RowStatus; labelMs: string; labelEn: string }[] = [
  { value: "all", labelMs: "Semua", labelEn: "All" },
  { value: "awaiting", labelMs: "Menunggu bayaran", labelEn: "Awaiting payment" },
  { value: "deposit", labelMs: "Deposit dibayar", labelEn: "Deposit paid" },
  { value: "review", labelMs: "Dalam semakan", labelEn: "In review" },
  { value: "paid", labelMs: "Dibayar", labelEn: "Paid" },
  { value: "overdue", labelMs: "Tertunggak", labelEn: "Overdue" },
];

const ringgit = (value: number) => "RM " + value.toLocaleString("en-MY");

function StatusPill({ status }: { status: RowStatus }) {
  const { t } = useLang();
  const tone = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: tone.fg }} />
      {t(tone.labelMs, tone.labelEn)}
    </span>
  );
}

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  return (
    <article className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <span
        className="whitespace-nowrap text-[22px] font-semibold leading-tight tracking-tight [font-variant-numeric:tabular-nums]"
        style={{ color: tone || "var(--color-text)" }}
      >
        {value}
      </span>
      <span className="text-[11.5px] text-muted-foreground">{note}</span>
    </article>
  );
}

function rowsFromLive(invoices: Invoice[], payments: Payment[]): Row[] {
  if (invoices.length === 0) return STATIC_ROWS;
  return invoices.map((inv) => {
    const history = payments
      .filter((p) => p.invoiceId === inv.id && (p.status === "verified" || p.status === "pending_verification"))
      .map((p) => ({
        label: p.status === "pending_verification" ? "Pending verification" : "Payment",
        date: p.paidAt,
        amount: p.amount,
        method: METHOD_LABEL[p.method] ?? "Other",
      }));
    return {
      id: inv.number,
      name: inv.customerName,
      pkg: inv.packageName,
      method: METHOD_LABEL[payments.find((p) => p.invoiceId === inv.id)?.method ?? "other"] ?? "Other",
      amount: inv.total,
      paid: inv.paidAmount,
      due: inv.dueDate,
      status: statusFromInvoice(inv),
      history,
    };
  });
}

export default function BillingWorkspace() {
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>(STATIC_ROWS);
  const [filter, setFilter] = useState<"all" | RowStatus>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(STATIC_ROWS[1]?.id ?? null);
  const [loaded, setLoaded] = useState(false);

  // Live data: fetchInvoices() (falls back to mock inside the loader).
  // Follows the DashboardOverview dynamic-import pattern.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [inv, pay] = await Promise.all([fetchInvoices(), fetchPayments()]);
        if (cancelled) return;
        const mapped = rowsFromLive(inv.invoices, pay.payments);
        setRows(mapped);
        setSelectedId((prev) => (prev && mapped.some((r) => r.id === prev) ? prev : mapped[0]?.id ?? null));
      } catch {
        /* live data unavailable — prototype static rows remain */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchFilter = filter === "all" || row.status === filter;
      const matchTerm = !term || row.name.toLowerCase().includes(term) || row.id.toLowerCase().includes(term) || row.pkg.toLowerCase().includes(term);
      return matchFilter && matchTerm;
    });
  }, [rows, filter, query]);

  const selected = rows.find((row) => row.id === selectedId) || filtered[0] || null;

  const totals = useMemo(() => {
    const billed = rows.reduce((sum, row) => sum + row.amount, 0);
    const paid = rows.reduce((sum, row) => sum + row.paid, 0);
    const outstanding = billed - paid;
    const verify = rows.filter((row) => row.status === "review").reduce((sum, row) => sum + row.paid, 0);
    return { billed, paid, outstanding, verify };
  }, [rows]);

  const countFor = (value: "all" | RowStatus) => (value === "all" ? rows.length : rows.filter((row) => row.status === value).length);

  const markVerified = (id: string) => {
    setRows((list) => list.map((row) => (row.id === id ? { ...row, status: "paid" } : row)));
  };

  const settleRemaining = (id: string) => {
    setRows((list) =>
      list.map((row) => {
        if (row.id !== id) return row;
        const rest = row.amount - row.paid;
        if (rest <= 0) return row;
        return {
          ...row,
          paid: row.amount,
          status: "paid",
          history: [{ label: t("Bayaran akhir", "Final payment"), date: t("Hari ini", "Today"), amount: rest, method: row.method }, ...row.history],
        };
      }),
    );
  };

  const resetFilters = () => {
    setQuery("");
    setFilter("all");
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-8" style={{ overflowWrap: "break-word" }}>
      {/* Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t("Jumlah ditagih", "Total billed")} value={ringgit(totals.billed)} note={`${rows.length} ${t("bayaran bulan ini", "payments this month")}`} />
        <Metric label={t("Terkumpul", "Collected")} value={ringgit(totals.paid)} note={totals.billed > 0 ? `${Math.round((totals.paid / totals.billed) * 100)}% ${t("daripada ditagih", "of billed")}` : "—"} tone="var(--color-success)" />
        <Metric label={t("Baki tertunggak", "Outstanding")} value={ringgit(totals.outstanding)} note={t("Belum diterima", "Not yet received")} />
        <Metric label={t("Perlu pengesahan", "Needs verification")} value={ringgit(totals.verify)} note={t("Bukti bayaran menunggu", "Proof of payment waiting")} tone="var(--color-warning)" />
      </section>

      {/* Table + detail layout */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Payment list */}
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4">
            <h2 className="m-0 flex-[1_1_160px] text-[15px] font-semibold text-[var(--color-text)]">{t("Senarai bayaran", "Payment list")}</h2>
            <label className="flex h-9 min-w-0 flex-[1_1_220px] max-w-[300px] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3">
              <Search aria-hidden="true" className="h-4 w-4 flex-none text-[var(--color-text-muted)]" />
              <span className="sr-only">{t("Cari bayaran", "Search payments")}</span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[var(--color-text)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("Cari kod atau pelanggan", "Search code or customer")}
              />
            </label>
          </div>

          <div role="group" aria-label={t("Tapis bayaran mengikut status", "Filter payments by status")} className="flex flex-wrap gap-2 border-b border-[var(--color-border)] px-4 py-3">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                  filter === item.value
                    ? "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-surface)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]",
                )}
              >
                {t(item.labelMs, item.labelEn)}
                <span className="text-[11px] opacity-75 [font-variant-numeric:tabular-nums]">{countFor(item.value)}</span>
              </button>
            ))}
          </div>

          <div className="max-w-full overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                <p className="m-0 text-[13px]">{loaded ? t("Tiada bayaran sepadan dengan carian ini.", "No payments match this search.") : t("Memuatkan bayaran…", "Loading payments…")}</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-3 cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                >
                  {t("Set semula penapis", "Reset filters")}
                </button>
              </div>
            ) : (
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]">
                    <th scope="col" className="px-3 py-2 pl-4 text-left text-[11.5px] font-medium [font-variant-numeric:tabular-nums]">{t("Kod", "Code")}</th>
                    <th scope="col" className="px-3 py-2 text-left text-[11.5px] font-medium">{t("Pelanggan", "Customer")}</th>
                    <th scope="col" className="px-3 py-2 text-right text-[11.5px] font-medium">{t("Jumlah", "Amount")}</th>
                    <th scope="col" className="px-3 py-2 text-left text-[11.5px] font-medium">{t("Tarikh matang", "Due date")}</th>
                    <th scope="col" className="px-3 py-2 pr-4 text-left text-[11.5px] font-medium">{t("Status", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      aria-selected={selected?.id === row.id}
                      onClick={() => setSelectedId(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(row.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer border-t border-[var(--color-border)] text-[var(--color-text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                        selected?.id === row.id ? "bg-[var(--color-primary-soft)]" : "hover:bg-[var(--color-surface-raised)]",
                      )}
                    >
                      <td className="p-3 pl-4 font-semibold [font-variant-numeric:tabular-nums]">{row.id}</td>
                      <td className="max-w-[220px] p-3">
                        <span className="block overflow-hidden text-ellipsis">{row.name}</span>
                        <span className="block overflow-hidden text-ellipsis text-[11.5px] text-[var(--color-text-muted)]">{row.pkg} · {row.method}</span>
                      </td>
                      <td className="p-3 text-right [font-variant-numeric:tabular-nums]">{ringgit(row.amount)}</td>
                      <td className={cn("p-3 [font-variant-numeric:tabular-nums]", row.status === "overdue" ? "text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]")}>{row.due}</td>
                      <td className="p-3 pr-4">
                        <StatusPill status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Detail panel */}
        <aside aria-live="polite" className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">{selected.id}</p>
                  <h2 className="mt-1 text-[15px] font-semibold text-[var(--color-text)]">{selected.name}</h2>
                  <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">{selected.pkg}</p>
                </div>
                <StatusPill status={selected.status} />
              </div>

              <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
                <div className="flex justify-between gap-2">
                  <span className="text-[13px] text-[var(--color-text-secondary)]">{t("Jumlah ditagih", "Total billed")}</span>
                  <span className="text-[13px] font-semibold [font-variant-numeric:tabular-nums]">{ringgit(selected.amount)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[13px] text-[var(--color-text-secondary)]">{t("Dibayar", "Paid")}</span>
                  <span className="text-[13px] text-[var(--color-success)] [font-variant-numeric:tabular-nums]">{ringgit(selected.paid)}</span>
                </div>
                <div className="flex justify-between gap-2 border-t border-[var(--color-border)] pt-2">
                  <span className="text-[13px] font-semibold">{t("Baki", "Balance")}</span>
                  <span className={cn("text-[13px] font-bold [font-variant-numeric:tabular-nums]", selected.amount - selected.paid > 0 ? "text-[var(--color-text)]" : "text-[var(--color-success)]")}>{ringgit(selected.amount - selected.paid)}</span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-soft)]"
                  role="img"
                  aria-label={`${selected.amount > 0 ? Math.round((selected.paid / selected.amount) * 100) : 0} ${t("peratus dibayar", "percent paid")}`}
                >
                  <div
                    className="h-full rounded-full bg-[var(--color-success)]"
                    style={{ width: `${selected.amount > 0 ? Math.round((selected.paid / selected.amount) * 100) : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <h3 className="m-0 text-[11.5px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{t("Sejarah bayaran", "Payment history")}</h3>
                {selected.history.length === 0 ? (
                  <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">{t("Tiada bayaran direkodkan untuk invois ini lagi.", "No payments recorded for this invoice yet.")}</p>
                ) : (
                  <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                    {selected.history.map((item) => (
                      <li key={`${selected.id}-${item.label}-${item.date}`} className="flex min-w-0 justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium">{item.label}</span>
                          <span className="text-[11.5px] text-[var(--color-text-muted)]">{item.method} · {item.date}</span>
                        </span>
                        <span className="whitespace-nowrap text-[13px] [font-variant-numeric:tabular-nums]">{ringgit(item.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-auto flex flex-wrap gap-2">
                {selected.status === "review" ? (
                  <button
                    type="button"
                    onClick={() => markVerified(selected.id)}
                    className="flex-[1_1_140px] cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-[12px] font-semibold text-[var(--color-on-primary)] hover:border-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)]"
                  >
                    {t("Sahkan bayaran", "Verify payment")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={selected.paid >= selected.amount}
                  onClick={() => settleRemaining(selected.id)}
                  className="flex-[1_1_140px] cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[12px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {selected.paid >= selected.amount ? t("Invois telah dijelaskan", "Invoice fully paid") : t("Rekod bayaran akhir", "Record final payment")}
                </button>
              </div>
            </>
          ) : (
            <p className="m-0 text-[13px] text-[var(--color-text-muted)]">{t("Pilih baris bayaran untuk melihat butirannya.", "Select a payment row to see its details.")}</p>
          )}
        </aside>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Download,
  CalendarCheck2,
  Hourglass,
  ReceiptText,
  BadgeCheck,
  Eye,
  SearchX,
} from "lucide-react";
import { fetchBookings } from "@/lib/live-data";
import CreateBookingForm from "@/components/CreateBookingForm";
import BookingDetail from "@/components/BookingDetail";
import {
  type Booking,
  type BookingStatus,
  bookingStatusLabels,
} from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

type StatusFilter = BookingStatus | "all";

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "hold",
  "pending_deposit",
  "confirmed",
  "cancelled",
];

const STATUS_TONE: Record<
  BookingStatus,
  { label: string; bg: string; fg: string }
> = {
  confirmed: {
    label: "Confirmed",
    bg: "var(--color-success-soft)",
    fg: "var(--color-success)",
  },
  pending_deposit: {
    label: "Deposit paid",
    bg: "var(--color-warning-soft)",
    fg: "var(--color-warning)",
  },
  hold: {
    label: "Awaiting payment",
    bg: "var(--color-info-soft)",
    fg: "var(--color-info)",
  },
  draft: {
    label: "Draft",
    bg: "var(--color-neutral-soft)",
    fg: "var(--color-text-secondary)",
  },
  completed: {
    label: "Completed",
    bg: "var(--color-success-soft)",
    fg: "var(--color-success)",
  },
  cancelled: {
    label: "Cancelled",
    bg: "var(--color-danger-soft)",
    fg: "var(--color-danger)",
  },
};

function totalPax(b: Booking) {
  return b.paxAdult + b.paxChild + b.paxInfant;
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE.draft;
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {tone.label}
    </span>
  );
}

function Kpi({
  label,
  value,
  note,
  icon: Icon,
  bg,
  fg,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof CalendarCheck2;
  bg: string;
  fg: string;
}) {
  return (
    <article className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-medium text-muted-foreground">
          {label}
        </span>
        <span
          className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px]"
          style={{ background: bg, color: fg }}
        >
          <Icon className="h-[15px] w-[15px]" />
        </span>
      </div>
      <strong className="whitespace-nowrap text-[23px] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]">
        {value}
      </strong>
      <span className="truncate text-[11.5px] text-muted-foreground">{note}</span>
    </article>
  );
}

export default function BookingWorkspace() {
  const { t } = useLang();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [departureFilter, setDepartureFilter] = useState("all");
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Live bookings from D1 (falls back to mock when API unreachable).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchBookings();
      if (!cancelled) setBookings(res.bookings);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const departureOptions = useMemo(
    () =>
      Array.from(
        new Set(bookings.map((b) => b.departureDate).filter(Boolean)),
      ).sort() as string[],
    [bookings],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return bookings.filter((b) => {
      const matchesSearch =
        !needle ||
        b.reference.toLowerCase().includes(needle) ||
        b.customerName.toLowerCase().includes(needle) ||
        b.packageName.toLowerCase().includes(needle);
      const matchesStatus =
        statusFilter === "all" || b.status === statusFilter;
      const matchesDeparture =
        departureFilter === "all" || b.departureDate === departureFilter;
      return matchesSearch && matchesStatus && matchesDeparture;
    });
  }, [bookings, search, statusFilter, departureFilter]);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      all: bookings.length,
      draft: 0,
      hold: 0,
      pending_deposit: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    bookings.forEach((b) => {
      base[b.status] = (base[b.status] ?? 0) + 1;
    });
    return base;
  }, [bookings]);

  const ringgit = (v: number) => `RM ${v.toLocaleString("en-MY")}`;
  const pendingValue = bookings
    .filter((b) => b.status === "hold")
    .reduce((s, b) => s + b.totalAmount, 0);
  const depositValue = bookings
    .filter((b) => b.status === "pending_deposit")
    .reduce((s, b) => s + b.balanceDue, 0);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Page head */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-2xl font-bold leading-tight tracking-tight">
            {t("Tempahan", "Bookings")}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            {t(
              "Urus tempahan, status bayaran dan peruntukan kerusi penumpang.",
              "Manage bookings, payment status and passenger seat allocation.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-semibold hover:bg-[var(--color-surface-muted)]"
          >
            <Download className="h-3.5 w-3.5" />
            {t("Eksport", "Export")}
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("Tempahan Baharu", "New booking")}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label={t("Jumlah Tempahan", "Total bookings")}
          value={String(counts.all)}
          note={t("Semua tempahan", "All bookings")}
          icon={CalendarCheck2}
          bg="var(--color-primary-soft)"
          fg="var(--color-primary)"
        />
        <Kpi
          label={t("Menunggu Bayaran", "Awaiting payment")}
          value={String(counts.hold)}
          note={`${ringgit(pendingValue)} ${t("belum dibayar", "unpaid")}`}
          icon={Hourglass}
          bg="var(--color-info-soft)"
          fg="var(--color-info)"
        />
        <Kpi
          label={t("Deposit Terbuka", "Open deposits")}
          value={String(counts.pending_deposit)}
          note={`${ringgit(depositValue)} ${t("baki", "balance due")}`}
          icon={ReceiptText}
          bg="var(--color-warning-soft)"
          fg="var(--color-warning)"
        />
        <Kpi
          label={t("Disahkan", "Confirmed")}
          value={String(counts.confirmed)}
          note={t("Sedia untuk berangkat", "Ready to depart")}
          icon={BadgeCheck}
          bg="var(--color-success-soft)"
          fg="var(--color-success)"
        />
      </div>

      {/* Table card with toolbar */}
      <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-border)] p-4 sm:px-5">
          <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 text-muted-foreground focus-within:border-[var(--color-primary)] focus-within:bg-[var(--color-surface)] focus-within:shadow-[0_0_0_3px_var(--color-primary-soft)] sm:max-w-[340px]">
            <Search className="h-4 w-4" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Cari kod, nama atau pakej…", "Search code, name or package…")}
              aria-label={t("Cari tempahan", "Search bookings")}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex min-w-0 flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={statusFilter === f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-foreground",
                  statusFilter === f &&
                    "border-[var(--color-primary)]/35 bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
                )}
              >
                {f === "all" ? t("Semua", "All") : bookingStatusLabels[f]}
                <span className="rounded-full bg-[var(--color-surface-muted)] px-1.5 text-[11px] font-bold text-muted-foreground [font-variant-numeric:tabular-nums]">
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>

          <select
            value={departureFilter}
            onChange={(e) => setDepartureFilter(e.target.value)}
            aria-label={t("Tapis mengikut keberangkatan", "Filter by departure")}
            className="ml-auto max-w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-[12.5px] font-medium text-[var(--color-text-secondary)]"
          >
            <option value="all">{t("Semua keberangkatan", "All departures")}</option>
            {departureOptions.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2.5 px-5 py-10 text-center text-muted-foreground">
            <SearchX className="h-6 w-6" />
            <p className="m-0 text-[13px]">
              {t("Tiada tempahan sepadan dengan penapis ini.", "No bookings match these filters.")}
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setSearch("");
                setDepartureFilter("all");
              }}
              className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12.5px] font-semibold hover:bg-[var(--color-surface-muted)]"
            >
              {t("Set semula penapis", "Reset filters")}
            </button>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <caption className="sr-only">
                {t("Senarai tempahan dan status bayaran", "Booking list with payment status")}
              </caption>
              <thead>
                <tr className="bg-[var(--color-surface-raised)]">
                  {[
                    t("Kod", "Code"),
                    t("Pelanggan", "Customer"),
                    t("Pakej & Keberangkatan", "Package & departure"),
                    "Pax",
                    t("Jumlah", "Total"),
                    t("Status", "Status"),
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="whitespace-nowrap border-b border-[var(--color-border)] px-2 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground first:pl-5 last:pr-5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="transition-colors hover:bg-[var(--color-surface-raised)]"
                  >
                    <td className="whitespace-nowrap border-b border-[var(--color-border)] px-2 py-2.5 pl-5 font-semibold [font-variant-numeric:tabular-nums]">
                      {b.reference}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-2 py-2.5">
                      <div className="font-semibold">{b.customerName}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {b.customerPhone}
                      </div>
                    </td>
                    <td className="border-b border-[var(--color-border)] px-2 py-2.5">
                      <div className="font-medium">{b.packageName}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {formatDate(b.departureDate)}
                      </div>
                    </td>
                    <td className="border-b border-[var(--color-border)] px-2 py-2.5 text-center [font-variant-numeric:tabular-nums]">
                      {totalPax(b)}
                    </td>
                    <td className="whitespace-nowrap border-b border-[var(--color-border)] px-2 py-2.5 [font-variant-numeric:tabular-nums]">
                      {formatCurrency(b.totalAmount)}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-2 py-2.5">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="border-b border-[var(--color-border)] px-2 py-2.5 pr-5 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailBooking(b)}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[12.5px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t("Lihat", "View")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CreateBookingForm open={createOpen} onOpenChange={setCreateOpen} />
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

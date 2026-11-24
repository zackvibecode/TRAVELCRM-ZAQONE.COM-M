import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  UsersRound,
  Repeat,
  Wallet,
  Search,
  Download,
  Star,
  Briefcase,
  MessageCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

const SOURCES = ["Instagram", "Website", "Referral", "WhatsApp", "Travel fair"];

/** Prototype customers tab (CONTACTS where kind === "customer"). */
interface CustomerRow {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  city: string;
  source: string;
  value: number;
  trip: string;
  owner: string;
  created: string;
  trips?: number;
  lastTrip?: string;
  note: string;
  history: { icon: "star" | "badge" | "briefcase" | "message"; text: string; time: string }[];
}

const STATIC_CUSTOMERS: CustomerRow[] = [];

const ringgit = (v: number) => `RM ${v.toLocaleString("en-MY")}`;

function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function MetricCard({ label, icon: Icon, value, note }: { label: string; icon: typeof UsersRound; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-display text-[24px] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]">{value}</span>
      <span className="text-[12px] text-muted-foreground">{note}</span>
    </div>
  );
}

export default function Customers() {
  const { t } = useLang();
  const [customers, setCustomers] = useState<CustomerRow[]>(STATIC_CUSTOMERS);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All sources");
  const [selectedId, setSelectedId] = useState<string>("");
  const [notice, setNotice] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live data via dynamic import (same pattern as DashboardOverview).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchCustomers } = await import("@/lib/live-data");
        const res = await fetchCustomers();
        if (cancelled || !res.live || res.customers.length === 0) return;
        setCustomers(
          res.customers.map((c) => ({
            id: c.id,
            name: c.name,
            initials: initialsOf(c.name),
            email: c.email || "Not provided",
            phone: c.phone || "Not provided",
            city: c.city ?? "Not provided",
            source: "Website",
            value: 0,
            trip: "Not decided",
            owner: "—",
            created: c.joinedAt ? `Customer since ${c.joinedAt}` : "Customer",
            note: c.notes ?? "No notes yet.",
            history: [],
          })),
        );
        setSelectedId(res.customers[0]?.id ?? "");
      } catch {
        /* live data unavailable — empty state shown */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      const matchQuery = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.city.toLowerCase().includes(q) || c.trip.toLowerCase().includes(q);
      const matchSource = source === "All sources" || c.source === source;
      return matchQuery && matchSource;
    });
  }, [customers, query, source]);

  const selected = customers.find((c) => c.id === selectedId) ?? visible[0] ?? null;
  const repeatCustomers = customers.filter((c) => (c.trips ?? 0) > 1).length;
  const totalValue = customers.reduce((s, c) => s + c.value, 0);

  function showNotice(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setNotice(message);
    toastTimer.current = setTimeout(() => setNotice(""), 4000);
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight">{t("Pelanggan", "Customers")}</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {customers.length} {t("pelanggan aktif", "active customers")} · {t("jumlah nilai", "total value")} {ringgit(totalValue)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => showNotice(t("Senarai pelanggan (CSV) sedia untuk dimuat turun", "Contact list (CSV) is ready to download"))} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-muted)]">
            <Download className="h-3.5 w-3.5" /> {t("Eksport", "Export")}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("Ringkasan pelanggan", "Customer summary")}>
        <MetricCard label={t("Pelanggan Aktif", "Active customers")} icon={BadgeCheck} value={String(customers.length)} note={t("Pernah menempah", "Have booked before")} />
        <MetricCard label={t("Pelanggan Berulang", "Repeat customers")} icon={Repeat} value={String(repeatCustomers)} note={t("Lebih 1 perjalanan", "More than 1 trip")} />
        <MetricCard label={t("Jumlah Nilai", "Total value")} icon={Wallet} value={ringgit(totalValue)} note={t("Nilai perjalanan direkodkan", "Recorded trip value")} />
        <MetricCard label={t("Jumlah Kontak", "Total contacts")} icon={UsersRound} value={String(customers.length)} note={t("Pelanggan sahaja", "Customers only")} />
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="px-4 pt-4">
            <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)]" role="tablist">
              <button type="button" role="tab" aria-selected="true" className="inline-flex items-center gap-2 border-b-2 border-[var(--color-primary)] px-3 pb-3 pt-1.5 text-[13.5px] font-semibold text-[var(--color-primary)]">
                {t("Pelanggan", "Customers")} <span className="rounded-full bg-[var(--color-primary-soft)] px-1.5 text-[11px] font-bold text-[var(--color-primary)]">{customers.length}</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-2 py-3">
              <div className="flex min-w-0 max-w-[300px] flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Cari nama, emel, bandar…", "Search name, email, city…")} aria-label={t("Cari pelanggan", "Search customers")} className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none" />
              </div>
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                Source
                <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-[13px]">
                  <option>All sources</option>
                  {SOURCES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center text-muted-foreground">
              <p className="m-0 font-semibold text-foreground">{t("Tiada pelanggan sepadan", "No customers match")}</p>
              <p className="mb-4 mt-1.5 text-[13px]">{t("Tukar kata kunci atau pilih sumber lain.", "Change the keyword or pick another source.")}</p>
              <button type="button" onClick={() => { setQuery(""); setSource("All sources"); }} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-semibold">Reset filters</button>
            </div>
          ) : (
            <ul className="m-0 list-none p-0">
              {visible.map((customer) => (
                <li key={customer.id}>
                  <button type="button" onClick={() => setSelectedId(customer.id)} aria-current={selected?.id === customer.id ? "true" : undefined} className={cn("flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-surface-raised)]", selected?.id === customer.id && "bg-[var(--color-primary-soft)]")}>
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--color-neutral-soft)] text-[12px] font-bold text-[var(--color-text-secondary)]">{customer.initials}</span>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate text-[13.5px] font-semibold">{customer.name}</p>
                      <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
                        <span>{customer.trip}</span><span>{customer.source}</span><span className="max-md:hidden">{customer.owner}</span>
                      </div>
                    </div>
                    <div className="flex flex-none flex-col items-end gap-1.5">
                      <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-primary)]">{t("Pelanggan", "Customer")}</span>
                      <span className="text-[12px] font-semibold text-[var(--color-text-secondary)] [font-variant-numeric:tabular-nums]">{customer.value > 0 ? ringgit(customer.value) : "—"}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {!selected ? (
            <div className="flex flex-col gap-1.5 p-5">
              <p className="m-0 font-semibold">{t("Pilih pelanggan", "Select a customer")}</p>
              <p className="m-0 text-[13px] text-muted-foreground">{t("Butiran pelanggan dipaparkan di sini.", "Customer details appear here.")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[var(--color-surface-muted)] text-[14px] font-bold text-[var(--color-primary)]">{selected.initials}</span>
                <div className="min-w-0">
                  <p className="m-0 break-words text-[15px] font-bold">{selected.name}</p>
                  <span className="mt-1 inline-block rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-primary)]">{t("Pelanggan", "Customer")}</span>
                </div>
              </div>
              <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
                <dt className="text-[12px] text-muted-foreground">Email</dt><dd className="m-0 break-words">{selected.email}</dd>
                <dt className="text-[12px] text-muted-foreground">Phone</dt><dd className="m-0 [font-variant-numeric:tabular-nums]">{selected.phone}</dd>
                <dt className="text-[12px] text-muted-foreground">City</dt><dd className="m-0">{selected.city}</dd>
                <dt className="text-[12px] text-muted-foreground">Package</dt><dd className="m-0">{selected.trip}</dd>
                <dt className="text-[12px] text-muted-foreground">Value</dt><dd className="m-0 [font-variant-numeric:tabular-nums]">{selected.value > 0 ? ringgit(selected.value) : t("Tiada nilai lagi", "No value yet")}</dd>
                <dt className="text-[12px] text-muted-foreground">Source</dt><dd className="m-0">{selected.source}</dd>
                <dt className="text-[12px] text-muted-foreground">Owner</dt><dd className="m-0">{selected.owner}</dd>
              </dl>
              <div className="flex flex-col gap-1.5">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
                <p className="m-0 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">{selected.note}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">{t("Sejarah perjalanan", "Trip history")}</p>
                <p className="m-0 text-[13px] text-[var(--color-text-secondary)]">
                  {selected.trips !== undefined
                    ? `${selected.trips} ${t("perjalanan · terakhir", "trips · last")} ${selected.lastTrip}`
                    : selected.created}
                </p>
              </div>
              {selected.history.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">Activity</p>
                  <ul className="m-0 flex flex-col gap-3 p-0">
                    {selected.history.map((entry, i) => {
                      const Icon = entry.icon === "star" ? Star : entry.icon === "briefcase" ? Briefcase : entry.icon === "message" ? MessageCircle : BadgeCheck;
                      return (
                        <li key={i} className="flex gap-2.5 text-[12.5px] text-[var(--color-text-secondary)]">
                          <Icon className="mt-0.5 h-3.5 w-3.5 flex-none text-muted-foreground" />
                          <div><span>{entry.text}</span><time className="mt-0.5 block text-[11px] text-muted-foreground">{entry.time}</time></div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {notice && (
        <div className="fixed bottom-6 right-6 z-[60] flex max-w-[340px] items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-text)] px-3.5 py-3 text-[13px] text-[var(--color-surface)] shadow-2xl" role="status" aria-live="polite">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice("")} className="grid place-items-center"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

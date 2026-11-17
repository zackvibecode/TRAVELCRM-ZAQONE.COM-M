import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  MapPinOff,
  MessageCircle,
  Search,
} from "lucide-react";
import type { Departure, TravelPackage } from "@/lib/types";
import { cn, formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

const IMG_BY_DEST: Record<string, string> = {
  Japan: "https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=900&q=70",
  Korea: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=900&q=70",
  Lombok: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=900&q=70",
  Bromo: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=900&q=70",
  "Raja Ampat": "https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=900&q=70",
  Bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=70",
  Turkey: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=70",
  Vietnam: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=900&q=70",
  Thailand: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=900&q=70",
};

const DURATIONS = [
  { value: "all", ms: "Sebarang tempoh", en: "Any duration" },
  { value: "short", ms: "Hingga 4 hari", en: "Up to 4 days" },
  { value: "medium", ms: "5–7 hari", en: "5–7 days" },
  { value: "long", ms: "8 hari ke atas", en: "8 days or more" },
] as const;

const SORTS = [
  { value: "soon", ms: "Keberangkatan terawal", en: "Earliest departure" },
  { value: "low", ms: "Harga terendah", en: "Lowest price" },
  { value: "high", ms: "Harga tertinggi", en: "Highest price" },
  { value: "seats", ms: "Kerusi paling banyak", en: "Most seats left" },
] as const;

type DurationValue = (typeof DURATIONS)[number]["value"];
type SortValue = (typeof SORTS)[number]["value"];

function ringgit(value: number): string {
  return formatRinggit(value);
}

function seatTone(seats: number): { bg: string; fg: string } {
  if (seats <= 3) return { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" };
  if (seats <= 8) return { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" };
  return { bg: "var(--color-success-soft)", fg: "var(--color-success)" };
}

function matchDuration(days: number, filter: DurationValue): boolean {
  if (filter === "short") return days <= 4;
  if (filter === "medium") return days >= 5 && days <= 7;
  if (filter === "long") return days >= 8;
  return true;
}

function fmtDate(value: string, locale: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function PublicPackages() {
  const { t, lang } = useLang();
  const locale = lang === "ms" ? "ms-MY" : "en-GB";
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState("all");
  const [duration, setDuration] = useState<DurationValue>("all");
  const [sort, setSort] = useState<SortValue>("soon");
  const [packages, setPackages] = useState<TravelPackage[]>([]);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);

  // Live packages + departures from D1 (falls back to mock inside loaders).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchPackages, fetchDepartures } = await import("@/lib/live-data");
        const [p, d] = await Promise.all([fetchPackages(), fetchDepartures()]);
        if (cancelled) return;
        setPackages(p.packages.filter((pkg) => pkg.published !== false));
        setDepartures(d.departures);
      } catch {
        /* live data unavailable — empty grid state renders */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const destinations = useMemo(
    () => ["all", ...[...new Set(packages.map((p) => p.destination))].sort()],
    [packages],
  );

  const today = new Date().toISOString().slice(0, 10);

  const seatsFor = (packageId: string): number => {
    const dep = departures
      .filter((d) => d.packageId === packageId && d.status !== "closed" && d.status !== "full")
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
      .find((d) => d.departureDate >= today);
    if (!dep) return 0;
    return Math.max(0, dep.seatCapacity - dep.seatsBooked - dep.seatsHeld);
  };

  const nextDepDate = (packageId: string): string => {
    const dep = departures
      .filter((d) => d.packageId === packageId && d.status !== "closed" && d.status !== "full")
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
      .find((d) => d.departureDate >= today);
    return dep?.departureDate ?? "";
  };

  const hasil = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = packages.filter(
      (item) =>
        (destination === "all" || item.destination === destination) &&
        matchDuration(item.durationDays, duration) &&
        (!q ||
          `${item.name} ${item.destination} ${(item.highlights ?? []).join(" ")}`
            .toLowerCase()
            .includes(q)),
    );
    const withSeats = list.map((item) => ({ item, seats: seatsFor(item.id), dep: nextDepDate(item.id) }));
    const sorted = [...withSeats];
    if (sort === "low") sorted.sort((a, b) => a.item.adultPrice - b.item.adultPrice);
    if (sort === "high") sorted.sort((a, b) => b.item.adultPrice - a.item.adultPrice);
    if (sort === "seats") sorted.sort((a, b) => b.seats - a.seats);
    if (sort === "soon") sorted.sort((a, b) => (a.dep || "9999").localeCompare(b.dep || "9999"));
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages, departures, query, destination, duration, sort]);

  const filterAktif =
    query !== "" || destination !== "all" || duration !== "all";

  function reset() {
    setQuery("");
    setDestination("all");
    setDuration("all");
    setSort("soon");
  }

  return (
    <div className="bg-[var(--color-surface)]">
      <div className="mx-auto max-w-site px-4">
        <div className="flex flex-col gap-[var(--space-9)] py-[var(--space-9)]">
          {/* Header */}
          <header className="flex flex-wrap items-end justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <nav
                aria-label="Breadcrumb"
                className="text-caption mb-2 text-[var(--color-text-muted)]"
              >
                <Link
                  to="/site"
                  className="text-inherit no-underline hover:text-[var(--color-primary)] focus-ring rounded"
                >
                  {t("Utama", "Home")}
                </Link>
                <span aria-hidden="true" className="px-1.5">
                  /
                </span>
                <span className="text-[var(--color-text)]">
                  {t("Katalog pakej pelancongan", "Package catalogue")}
                </span>
              </nav>
              <h1 className="m-0 text-balance font-display text-[clamp(26px,3.2vw,34px)] font-extrabold leading-[1.15] tracking-[-0.02em]">
                {t("Katalog pakej pelancongan", "Travel package catalogue")}
              </h1>
              <p className="text-body-md m-0 mt-2 text-[var(--color-text-secondary)]">
                {loading
                  ? t("Memuatkan pakej…", "Loading packages…")
                  : t(
                      `${hasil.length} pakej diterbitkan dengan tarikh keberangkatan semasa dan kerusi yang tinggal.`,
                      `${hasil.length} published packages with current departure dates and seats remaining.`,
                    )}
              </p>
            </div>
            <a
              href="https://wa.me/60123880030"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {t("Bual dengan kami", "Talk to us")}
            </a>
          </header>

          {/* Filter bar */}
          <section
            className="grid gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]"
            aria-label={t("Penapis pakej", "Package filters")}
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="catalog-q" className="text-caption font-semibold tracking-[0.02em] text-[var(--color-text-muted)]">
                {t("Cari pakej", "Search packages")}
              </label>
              <div className="flex h-[42px] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_var(--color-primary-soft)]">
                <Search className="h-4 w-4 flex-none text-[var(--color-text-muted)]" aria-hidden="true" />
                <input
                  id="catalog-q"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("cth. Jepun, snorkelling", "e.g. Japan, snorkelling")}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="catalog-dest" className="text-caption font-semibold tracking-[0.02em] text-[var(--color-text-muted)]">
                {t("Destinasi", "Destination")}
              </label>
              <select
                id="catalog-dest"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                className="h-[42px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus-ring"
              >
                {destinations.map((item) => (
                  <option key={item} value={item}>
                    {item === "all" ? t("Semua destinasi", "All destinations") : item}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="catalog-dur" className="text-caption font-semibold tracking-[0.02em] text-[var(--color-text-muted)]">
                {t("Tempoh", "Duration")}
              </label>
              <select
                id="catalog-dur"
                value={duration}
                onChange={(event) => setDuration(event.target.value as DurationValue)}
                className="h-[42px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus-ring"
              >
                {DURATIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.ms, item.en)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="catalog-sort" className="text-caption font-semibold tracking-[0.02em] text-[var(--color-text-muted)]">
                {t("Susun mengikut", "Sort by")}
              </label>
              <select
                id="catalog-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortValue)}
                className="h-[42px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus-ring"
              >
                {SORTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {t(item.ms, item.en)}
                  </option>
                ))}
              </select>
            </div>
            {filterAktif ? (
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
                <span className="text-caption text-[var(--color-text-muted)]">
                  {hasil.length} {t("pakej sepadan", "matching packages")}
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex cursor-pointer items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-label-md font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-text)] focus-ring"
                >
                  {t("Set semula penapis", "Reset filters")}
                </button>
              </div>
            ) : null}
          </section>

          {/* Grid */}
          <section aria-labelledby="catalog-list-title">
            <h2 id="catalog-list-title" className="sr-only">
              {t("Senarai pakej", "Package list")}
            </h2>
            {!loading && hasil.length === 0 ? (
              <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 py-10 text-center">
                <MapPinOff
                  className="mx-auto h-[26px] w-[26px] text-[var(--color-text-muted)]"
                  aria-hidden="true"
                />
                <p className="text-body-lg m-0 mb-1.5 mt-3 font-semibold">
                  {t("Tiada pakej sepadan dengan penapis anda.", "No packages match your filters.")}
                </p>
                <p className="text-body-sm m-0 mb-4 text-[var(--color-text-muted)]">
                  {t(
                    "Cuba tempoh yang lebih luas atau destinasi lain. Pasukan kami juga boleh bina itinerary tersuai.",
                    "Try a wider duration or another destination. Our team can also build a custom itinerary.",
                  )}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
                  >
                    {t("Tunjukkan semua pakej", "Show all packages")}
                  </button>
                  <a
                    href="https://wa.me/60123880030"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] no-underline transition-colors hover:border-[var(--color-text)] focus-ring"
                  >
                    {t("Minta cadangan", "Ask for a recommendation")}
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {hasil.map(({ item, seats, dep }) => {
                  const tone = seatTone(seats);
                  const used = item.durationDays ? Math.round(((item.durationDays * 3 - seats) / (item.durationDays * 3)) * 100) : 0;
                  const fillPct = Math.min(100, Math.max(4, Math.round(100 - (seats / Math.max(1, seats + 8)) * 100)));
                  const bar = Number.isFinite(used) && used > 0 && used <= 100 ? used : fillPct;
                  const image = item.images?.[0] ?? IMG_BY_DEST[item.destination] ?? IMG_BY_DEST.Bali;
                  return (
                    <article
                      key={item.id}
                      className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-border-strong)] hover:shadow-[0_10px_24px_-18px_rgba(20,23,31,0.5)]"
                    >
                      <div className="relative bg-[var(--color-surface-muted)] [aspect-ratio:16/10]">
                        <img
                          src={image}
                          alt={t(
                            `Landskap perjalanan di ${item.destination}`,
                            `Travel scene in ${item.destination}`,
                          )}
                          width={900}
                          height={563}
                          loading="lazy"
                          className="block h-full w-full object-cover"
                        />
                        <span className="absolute left-3 top-3 inline-flex items-center gap-[5px] whitespace-nowrap rounded-[var(--radius-pill)] bg-[var(--color-surface)] px-[9px] py-[3px] text-xs font-semibold text-[var(--color-text)]">
                          {item.destination}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2 p-4">
                        <span className="text-caption text-[var(--color-text-muted)]">
                          {item.destination} · {item.durationDays} {t("hari", "days")}
                        </span>
                        <h3 className="text-heading-sm m-0 font-semibold leading-[var(--leading-tight)]">
                          {item.name}
                        </h3>
                        <p className="text-body-sm m-0 text-[var(--color-text-secondary)]">
                          {(item.highlights ?? []).slice(0, 3).join(" · ")}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <div
                            aria-hidden="true"
                            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface-muted)]"
                          >
                            <div
                              className={cn(
                                "h-full rounded-[var(--radius-pill)]",
                                bar >= 85
                                  ? "bg-[var(--color-danger)]"
                                  : bar >= 65
                                    ? "bg-[var(--color-warning)]"
                                    : "bg-[var(--color-success)]",
                              )}
                              style={{ width: `${bar}%` }}
                            />
                          </div>
                          <span
                            className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-[var(--radius-pill)] px-[9px] py-[3px] text-xs font-semibold"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            {seats} {t("kerusi lagi", "seats left")}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                          <span className="text-[17px] font-bold [font-variant-numeric:tabular-nums]">
                            {ringgit(item.adultPrice)}
                            <span className="text-caption font-normal text-[var(--color-text-muted)]">
                              {" "}
                              /pax
                            </span>
                          </span>
                          <span className="text-caption text-[var(--color-text-muted)]">
                            {t("Berangkat", "Departs")} {dep ? fmtDate(dep, locale) : "—"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            to={`/site/packages/${item.id}`}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] no-underline hover:text-[var(--color-primary-hover)] focus-ring rounded"
                            aria-label={t(
                              `Lihat butiran untuk ${item.name}`,
                              `View details for ${item.name}`,
                            )}
                          >
                            {t("Butiran & tarikh", "Details & dates")}
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                          <Link
                            to={`/site/packages/${item.id}`}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] no-underline hover:text-[var(--color-primary)] focus-ring rounded"
                            aria-label={t(
                              `Bertanya tentang ${item.name}`,
                              `Enquire about ${item.name}`,
                            )}
                          >
                            {t("Bertanya", "Enquire")}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Help strip */}
          <section
            aria-labelledby="catalog-help-title"
            className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 max-sm:p-4"
          >
            <div className="min-w-0">
              <h2 id="catalog-help-title" className="text-heading-sm m-0 font-bold">
                {t("Tiada tarikh yang sesuai?", "Can’t find a date that works?")}
              </h2>
              <p className="text-body-sm m-0 mt-1.5 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                {t(
                  "Beritahu tarikh dan saiz kumpulan anda, dan kami akan semak ketersediaan kerusi secara langsung.",
                  "Tell us your dates and group size, and we will check live seat availability.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="https://wa.me/60123880030"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
              >
                {t("Chat di WhatsApp", "Chat on WhatsApp")}
              </a>
              <Link
                to="/site/contact"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] no-underline transition-colors hover:border-[var(--color-text)] focus-ring"
              >
                {t("Isi borang", "Fill in the form")}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

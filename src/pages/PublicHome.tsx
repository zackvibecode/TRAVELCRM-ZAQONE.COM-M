import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MapPin,
  MessageCircle,
  PlaneTakeoff,
  Users,
} from "lucide-react";
import type { Departure, TravelPackage } from "@/lib/types";
import { formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

const IMG = {
  cover:
    "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=70",
  japan:
    "https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=900&q=70",
  lombok:
    "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=900&q=70",
  turki:
    "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=70",
  korea:
    "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=900&q=70",
  bromo:
    "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=900&q=70",
  rajaampat:
    "https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=900&q=70",
};

const IMG_BY_DEST: Record<string, string> = {
  Japan: IMG.japan,
  Korea: IMG.korea,
  Lombok: IMG.lombok,
  Bromo: IMG.bromo,
  "Raja Ampat": IMG.rajaampat,
  Turkey: IMG.turki,
  Bali: IMG.cover,
};

const LABELS: Record<string, { ms: string; en: string }> = {
  popular: { ms: "Paling popular", en: "Most popular" },
  seats: { ms: "Kerusi banyak", en: "Plenty of seats" },
  almost: { ms: "Hampir penuh", en: "Almost full" },
  newly: { ms: "Baru dibuka", en: "Newly opened" },
  weekend: { ms: "Kegemaran hujung minggu", en: "Weekend favourite" },
  limited: { ms: "Kuota terhad", en: "Limited quota" },
};

function labelFor(_pkg: TravelPackage, seats: number): { ms: string; en: string } {
  if (seats <= 3) return LABELS.almost;
  if (seats <= 8) return LABELS.weekend;
  if (seats <= 14) return LABELS.newly;
  return LABELS.seats;
}

const DESTINATIONS = [
  { id: "japan", name: "Japan", count: 14, image: IMG.japan },
  { id: "lombok", name: "Lombok", count: 9, image: IMG.lombok },
  { id: "bromo", name: "Bromo", count: 6, image: IMG.bromo },
];

function ringgit(value: number): string {
  return formatRinggit(value);
}

function seatsTone(seats: number): { bg: string; fg: string } {
  if (seats <= 3) return { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" };
  if (seats <= 8) return { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" };
  return { bg: "var(--color-success-soft)", fg: "var(--color-success)" };
}

function fmtDate(value: string, locale: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export default function PublicHome() {
  const { t, lang } = useLang();
  const locale = lang === "ms" ? "ms-MY" : "en-GB";
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
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
        /* live data unavailable — page stays empty-safe */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const nextDeparture = (packageId: string): Departure | undefined =>
    departures
      .filter((d) => d.packageId === packageId && d.status !== "closed" && d.status !== "full")
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
      .find((d) => d.departureDate >= today) ??
    departures
      .filter((d) => d.packageId === packageId && d.status !== "closed")
      .sort((a, b) => b.departureDate.localeCompare(a.departureDate))[0];

  const seatsFor = (packageId: string): number => {
    const dep = nextDeparture(packageId);
    if (!dep) return 0;
    return Math.max(0, dep.seatCapacity - dep.seatsBooked - dep.seatsHeld);
  };

  const aktif = query.trim().toLowerCase();
  const hasil = useMemo(
    () =>
      aktif
        ? packages.filter((item) =>
            `${item.name} ${item.destination} ${(item.highlights ?? []).join(" ")}`
              .toLowerCase()
              .includes(aktif),
          )
        : packages,
    [packages, aktif],
  );

  function cari(event: React.FormEvent) {
    event.preventDefault();
    setQuery(draft);
    setSubmitted(true);
  }

  const totalSeats = packages.reduce((sum, item) => sum + seatsFor(item.id), 0);
  const nextDepOverall = departures
    .filter((d) => d.status !== "closed" && d.status !== "full")
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate))[0];
  const nextPkg = nextDepOverall
    ? packages.find((p) => p.id === nextDepOverall.packageId)
    : undefined;

  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-site px-4">
          <div className="grid items-center gap-8 py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="flex min-w-0 flex-col gap-5">
              <span className="inline-flex items-center gap-2 text-caption font-semibold uppercase tracking-[var(--tracking-wide)] text-[var(--color-primary)]">
                <PlaneTakeoff className="h-4 w-4" aria-hidden="true" />
                {t("Open trip, peribadi & kumpulan", "Open trips, private & group")}
              </span>
              <h1 className="m-0 text-balance font-display text-[clamp(30px,4.4vw,46px)] font-extrabold leading-[1.1] tracking-[-0.025em]">
                {t(
                  "Perjalanan tersusun rapi, dari tempat duduk anda hingga itinerary.",
                  "Fully planned journeys, from your seat to the itinerary.",
                )}
              </h1>
              <p className="m-0 max-w-[46ch] text-body-lg leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                {t(
                  "Harga telus dalam Ringgit, tarikh keberangkatan sebenar, dan kerusi yang tinggal dikemas kini pada setiap tempahan.",
                  "Transparent pricing in Ringgit, real departure dates, and seats remaining updated on every booking.",
                )}
              </p>
              <form
                className="flex items-stretch gap-2 rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-2 shadow-[0_1px_2px_rgba(20,23,31,0.06)] focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_var(--color-primary-soft)]"
                role="search"
                onSubmit={cari}
              >
                <label htmlFor="home-destinasi" className="sr-only">
                  {t("Cari destinasi atau pakej", "Search destinations or packages")}
                </label>
                <span
                  className="inline-flex items-center pl-3 text-[var(--color-text-muted)]"
                  aria-hidden="true"
                >
                  <MapPin className="h-[18px] w-[18px]" />
                </span>
                <input
                  id="home-destinasi"
                  type="search"
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (event.target.value === "") setQuery("");
                  }}
                  placeholder={t(
                    "Ke mana seterusnya? Jepun, Bromo, Lombok…",
                    "Where to next? Japan, Bromo, Lombok…",
                  )}
                  className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-base text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-5 py-[11px] text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
                >
                  {t("Cari pakej", "Search packages")}
                </button>
              </form>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("Destinasi popular", "Popular destinations")}>
                {[
                  t("Semua", "All"),
                  "Japan",
                  "Lombok",
                  "Turkey",
                  "Korea",
                  "Bromo",
                  "Raja Ampat",
                ].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="cursor-pointer rounded-[var(--radius-pill)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-text)] hover:text-[var(--color-text)] focus-ring aria-pressed:bg-[var(--color-primary-soft)] aria-pressed:border-[var(--color-primary)] aria-pressed:font-semibold aria-pressed:text-[var(--color-primary)]"
                    aria-pressed={item === t("Semua", "All") ? query === "" : query === item}
                    onClick={() => {
                      setQuery(item === t("Semua", "All") ? "" : item);
                      setDraft(item === t("Semua", "All") ? "" : item);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <figure className="relative m-0 min-w-0 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-surface-muted)] [aspect-ratio:4/3] shadow-[0_12px_28px_-18px_rgba(20,23,31,0.45)]">
              <img
                src={IMG.cover}
                alt={t(
                  "Sawah berbatu dengan kuil di Bali",
                  "Terraced rice fields with a temple in Bali",
                )}
                width={1200}
                height={900}
                loading="eager"
                className="block h-full w-full object-cover"
              />
              <figcaption className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-[var(--color-surface)] px-4 py-3 shadow-[0_6px_18px_-10px_rgba(20,23,31,0.5)]">
                <span className="min-w-0">
                  <span className="block text-caption text-[var(--color-text-muted)]">
                    {t("Keberangkatan seterusnya", "Next departure")}
                  </span>
                  <span className="block text-body-md font-semibold">
                    {nextPkg ? nextPkg.name : "Turkey Classic"} ·{" "}
                    {fmtDate(nextDepOverall?.departureDate ?? "2026-02-27", locale)}
                  </span>
                </span>
                <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-[var(--radius-pill)] bg-[var(--color-danger-soft)] px-[9px] py-[3px] text-xs font-semibold text-[var(--color-danger)]">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {Math.max(0, nextDepOverall ? nextDepOverall.seatCapacity - nextDepOverall.seatsBooked - nextDepOverall.seatsHeld : 3)}{" "}
                  {t("kerusi", "seats")}
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-site px-4">
        <div className="flex flex-col gap-[var(--space-9)] py-[var(--space-9)]">
          {/* Stats */}
          <section aria-label={t("Ringkasan agensi", "Agency summary")}>
            <dl className="m-0 grid grid-cols-2 border border-[var(--color-border)] bg-[var(--color-surface)] lg:grid-cols-4">
              <div className="min-w-0 border-b border-[var(--color-border)] px-5 py-4 lg:border-b-0 lg:border-l-0 [&:first-child]:border-l-0">
                <dt className="text-caption text-[var(--color-text-muted)]">
                  {t("Pakej aktif", "Active packages")}
                </dt>
                <dd className="m-0 mt-1 font-display text-[26px] font-bold [font-variant-numeric:tabular-nums]">
                  {loading ? "…" : packages.length}
                </dd>
              </div>
              <div className="min-w-0 border-b border-l border-[var(--color-border)] px-5 py-4 lg:border-b-0">
                <dt className="text-caption text-[var(--color-text-muted)]">
                  {t("Destinasi", "Destinations")}
                </dt>
                <dd className="m-0 mt-1 font-display text-[26px] font-bold [font-variant-numeric:tabular-nums]">
                  {new Set(packages.map((p) => p.destination)).size || 12}
                </dd>
              </div>
              <div className="min-w-0 border-t border-[var(--color-border)] px-5 py-4 lg:border-l lg:border-t-0">
                <dt className="text-caption text-[var(--color-text-muted)]">
                  {t("Kerusi tersedia", "Seats available")}
                </dt>
                <dd className="m-0 mt-1 font-display text-[26px] font-bold [font-variant-numeric:tabular-nums]">
                  {loading ? "…" : totalSeats}
                </dd>
              </div>
              <div className="min-w-0 border-t border-l border-[var(--color-border)] px-5 py-4 lg:border-t-0">
                <dt className="text-caption text-[var(--color-text-muted)]">
                  {t("Purata tempahan", "Average occupancy")}
                </dt>
                <dd className="m-0 mt-1 font-display text-[26px] font-bold [font-variant-numeric:tabular-nums]">
                  64%
                </dd>
              </div>
            </dl>
          </section>

          {/* Featured packages */}
          <section
            aria-labelledby="home-featured-title"
            className="flex flex-col gap-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="home-featured-title"
                  className="text-heading-md m-0 font-bold tracking-[var(--tracking-tight)]"
                >
                  {aktif
                    ? t(`Pakej untuk “${query}”`, `Packages for “${query}”`)
                    : t("Pakej pilihan bulan ini", "Featured packages this month")}
                </h2>
                <p className="text-body-sm m-0 mt-1.5 text-[var(--color-text-muted)]">
                  {hasil.length} {t("pakej dengan keberangkatan terbuka", "packages with open departures")}
                </p>
              </div>
              <Link
                to="/site/packages"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] no-underline hover:text-[var(--color-primary-hover)] focus-ring rounded"
              >
                {t("Lihat semua pakej", "View all packages")}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {!loading && hasil.length === 0 ? (
              <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 py-10 text-center">
                <p className="text-body-md m-0 font-semibold">
                  {t("Tiada pakej sepadan dengan carian ini.", "No packages match this search.")}
                </p>
                <p className="text-body-sm m-0 mb-4 mt-1.5 text-[var(--color-text-muted)]">
                  {t(
                    "Cuba destinasi lain atau layari katalog penuh.",
                    "Try another destination or browse the full catalogue.",
                  )}
                </p>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-[11px] text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-text)] focus-ring"
                  onClick={() => {
                    setQuery("");
                    setDraft("");
                  }}
                >
                  {t("Tunjukkan semua pakej", "Show all packages")}
                </button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {hasil.map((item) => {
                  const seats = seatsFor(item.id);
                  const tone = seatsTone(seats);
                  const dep = nextDeparture(item.id);
                  const label = labelFor(item, seats);
                  const image =
                    item.images?.[0] ?? IMG_BY_DEST[item.destination] ?? IMG.cover;
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
                          {t(label.ms, label.en)}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-2 px-4 pb-5 pt-4">
                        <span className="text-caption text-[var(--color-text-muted)]">
                          {item.destination} · {item.durationDays}{" "}
                          {t("hari", "days")} {Math.max(0, item.durationDays - 1)}{" "}
                          {t("malam", "nights")}
                        </span>
                        <h3 className="text-heading-sm m-0 font-semibold leading-[var(--leading-tight)]">
                          {item.name}
                        </h3>
                        <ul className="text-body-sm m-0 mt-0.5 flex list-none flex-col gap-1 p-0 text-[var(--color-text-secondary)]">
                          {(item.highlights ?? []).slice(0, 3).map((text) => (
                            <li key={text} className="flex items-start gap-1.5">
                              <Check
                                className="mt-0.5 h-4 w-4 flex-none text-[var(--color-success)]"
                                aria-hidden="true"
                              />
                              <span>{text}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                          <span className="text-[17px] font-bold [font-variant-numeric:tabular-nums]">
                            {ringgit(item.adultPrice)}
                            <span className="text-caption font-normal text-[var(--color-text-muted)]">
                              {" "}
                              /pax
                            </span>
                          </span>
                          <span
                            className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-[var(--radius-pill)] px-[9px] py-[3px] text-xs font-semibold"
                            style={{ background: tone.bg, color: tone.fg }}
                          >
                            {seats} {t("kerusi lagi", "seats left")}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-caption text-[var(--color-text-muted)]">
                            {t("Berangkat", "Departs")}{" "}
                            {dep ? fmtDate(dep.departureDate, locale) : "—"}
                          </span>
                          <Link
                            to={`/site/packages/${item.id}`}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] no-underline hover:text-[var(--color-primary-hover)] focus-ring rounded"
                            aria-label={t(
                              `Lihat butiran untuk ${item.name}`,
                              `View details for ${item.name}`,
                            )}
                          >
                            {t("Lihat butiran", "View details")}
                            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Destinations */}
          <section aria-labelledby="home-dest-title" className="flex flex-col gap-4">
            <h2 id="home-dest-title" className="text-heading-md m-0 font-bold">
              {t("Destinasi paling dicari", "Most searched destinations")}
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {DESTINATIONS.map((item) => (
                <Link
                  key={item.id}
                  to="/site/packages"
                  aria-label={t(
                    `${item.name}, ${item.count} pakej`,
                    `${item.name}, ${item.count} packages`,
                  )}
                  className="relative block min-w-0 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-surface-muted)] no-underline [aspect-ratio:3/2] focus-ring"
                >
                  <img
                    src={item.image}
                    alt={t(`Pemandangan di ${item.name}`, `Scenery in ${item.name}`)}
                    width={900}
                    height={600}
                    loading="lazy"
                    className="block h-full w-full object-cover"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(20,23,31,0.78)] to-transparent px-4 pb-4 pt-5 text-[var(--color-on-primary)]">
                    <span className="block font-display text-[20px] font-bold">{item.name}</span>
                    <span className="block text-caption opacity-85">
                      {item.count} {t("pakej tersedia", "packages available")}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* Promo */}
          <section
            aria-labelledby="home-promo-title"
            className="grid items-center gap-6 rounded-[var(--radius-panel)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
          >
            <div className="min-w-0">
              <span className="text-caption font-semibold uppercase tracking-[var(--tracking-wide)] text-[var(--color-primary)]">
                {t("Promo Website Manager", "Website Manager promo")}
              </span>
              <h2
                id="home-promo-title"
                className="text-heading-md mb-2 mt-1.5 font-bold"
              >
                {t(
                  "Bonus RM 500 untuk setiap kumpulan 6 orang ke Jepun",
                  "RM 500 bonus for every group of 6 travelling to Japan",
                )}
              </h2>
              <p className="text-body-md m-0 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                {t(
                  "Sah untuk keberangkatan April 2026 selagi kerusi masih tersedia.",
                  "Valid for April 2026 departures while seats are still available.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/site/packages"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-5 py-[11px] text-sm font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
              >
                {t("Lihat pakej Jepun", "See Japan packages")}
              </Link>
              <a
                href="https://wa.me/60123880030"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-[11px] text-sm font-semibold text-[var(--color-text)] no-underline transition-colors hover:border-[var(--color-text)] focus-ring"
              >
                {t("Tanya tentang promo", "Ask about the promo")}
              </a>
            </div>
          </section>

          {/* Steps */}
          <section aria-labelledby="home-steps-title" className="flex flex-col gap-5">
            <h2 id="home-steps-title" className="text-heading-md m-0 font-bold">
              {t("Cara tempahan berfungsi", "How booking works")}
            </h2>
            <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
              <li className="min-w-0 border-t-2 border-[var(--color-text)] pt-4">
                <span className="text-caption text-[var(--color-text-muted)]">
                  {t("Langkah 1", "Step 1")}
                </span>
                <h3 className="text-heading-sm my-1.5 font-semibold">
                  {t("Pilih pakej & tarikh", "Choose a package & date")}
                </h3>
                <p className="text-body-sm m-0 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                  {t(
                    "Bandingkan tarikh keberangkatan dan kerusi yang tinggal pada setiap pakej.",
                    "Compare departure dates and the seats remaining on every package.",
                  )}
                </p>
              </li>
              <li className="min-w-0 border-t-2 border-[var(--color-text)] pt-4">
                <span className="text-caption text-[var(--color-text-muted)]">
                  {t("Langkah 2", "Step 2")}
                </span>
                <h3 className="text-heading-sm my-1.5 font-semibold">
                  {t("Hantar pertanyaan", "Send an enquiry")}
                </h3>
                <p className="text-body-sm m-0 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                  {t(
                    "Isi borang atau chat di WhatsApp. Pasukan jualan kami membalas hari yang sama.",
                    "Fill in the form or chat on WhatsApp. Our sales team replies the same day.",
                  )}
                </p>
              </li>
              <li className="min-w-0 border-t-2 border-[var(--color-text)] pt-4">
                <span className="text-caption text-[var(--color-text-muted)]">
                  {t("Langkah 3", "Step 3")}
                </span>
                <h3 className="text-heading-sm my-1.5 font-semibold">
                  {t("Bayar deposit, kerusi dipegang", "Pay the deposit, seats are held")}
                </h3>
                <p className="text-body-sm m-0 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                  {t(
                    "Kerusi dipegang selama 24 jam sehingga Kewangan mengesahkan pemindahan deposit anda.",
                    "Seats are held for 24 hours until Finance verifies your deposit transfer.",
                  )}
                </p>
              </li>
            </ol>
          </section>

          {/* CTA */}
          <section
            aria-labelledby="home-cta-title"
            className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius-panel)] bg-[var(--color-text)] p-8 text-[var(--color-surface)] max-sm:p-5"
          >
            <div className="min-w-0">
              <h2
                id="home-cta-title"
                className="text-heading-md m-0 font-bold text-[var(--color-surface)]"
              >
                {t(
                  "Perlukan itinerary tersuai atau kumpulan anda sendiri?",
                  "Need a custom itinerary or your own group?",
                )}
              </h2>
              <p className="text-body-md m-0 mt-2 max-w-[52ch] leading-[var(--leading-relaxed)] text-[var(--color-surface-muted)]">
                {t(
                  "Kami menyusun tarikh, hotel dan pengangkutan mengikut saiz kumpulan dan bajet anda.",
                  "We arrange dates, hotels and transport around your group size and budget.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 max-sm:w-full max-sm:flex-col">
              <a
                href="https://wa.me/60123880030"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-surface)] bg-[var(--color-surface)] px-5 py-[11px] text-sm font-semibold text-[var(--color-text)] no-underline focus-ring max-sm:w-full"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t("Chat dengan perunding", "Chat a consultant")}
              </a>
              <Link
                to="/site/packages"
                className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-white/45 bg-transparent px-5 py-[11px] text-sm font-semibold text-[var(--color-surface)] no-underline focus-ring max-sm:w-full"
              >
                {t("Lihat pakej contoh", "See a sample package")}
              </Link>
            </div>
          </section>

          {submitted ? (
            <p role="status" className="text-caption m-0 text-[var(--color-text-muted)]">
              {t(
                `Menunjukkan pakej untuk “${query || "semua destinasi"}”.`,
                `Showing packages for “${query || "all destinations"}”.`,
              )}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

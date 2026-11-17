import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  CalendarDays,
  Users,
  ArrowRight,
  ArrowUpRight,
  Megaphone,
  PlaneTakeoff,
  Search,
  MessageCircle,
  Check,
  UserPlus,
  Wallet,
} from "lucide-react";
import { fetchPackages } from "@/lib/live-data";
import { cn } from "@/lib/utils";
import { activeBanners, applySeo } from "@/lib/site-config";
import { useLang, useLocalePath } from "@/lib/i18n";

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

const CHIPS = ["All", "Japan", "Lombok", "Turkey", "Korea", "Bromo", "Raja Ampat"];
const DESTINATION_IMG: Record<string, string> = {
  Japan: IMG.japan,
  Lombok: IMG.lombok,
  Bromo: IMG.bromo,
  Turkey: IMG.turki,
  Korea: IMG.korea,
  "Raja Ampat": IMG.rajaampat,
};

function imageFor(destination: string): string {
  const key = Object.keys(DESTINATION_IMG).find((k) =>
    destination.toLowerCase().includes(k.toLowerCase()),
  );
  return key ? DESTINATION_IMG[key] : IMG.cover;
}

function seatsTone(seats: number) {
  if (seats <= 3)
    return { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" };
  if (seats <= 8)
    return { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" };
  return { bg: "var(--color-success-soft)", fg: "var(--color-success)" };
}

export default function PublicHome() {
  const { t, lang } = useLang();
  const lp = useLocalePath();

  useEffect(() => {
    applySeo("home", lang);
    return () => {
      document.title = "ZAQONE TRAVEL CRM";
    };
  }, []);

  const banners = useMemo(() => activeBanners(), []);
  const [packages, setPackages] = useState<
    Awaited<ReturnType<typeof fetchPackages>>["packages"]
  >([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");

  // Live packages from D1 (falls back to mock inside the loader).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchPackages();
      if (!cancelled) setPackages(res.packages);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = packages.filter(
    (p) => p.status !== "archived" && p.published !== false,
  );
  const needle = query.trim().toLowerCase();
  const hasil = needle
    ? active.filter((p) =>
        `${p.name} ${p.destination} ${(p.highlights ?? []).join(" ")}`
          .toLowerCase()
          .includes(needle),
      )
    : active;
  const featured = hasil.slice(0, 6);

  const destinations = useMemo(() => {
    const byDest = new Map<string, number>();
    for (const p of active) {
      byDest.set(p.destination, (byDest.get(p.destination) ?? 0) + 1);
    }
    return [...byDest.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [active]);

  const ringgit = (v: number) => `RM ${v.toLocaleString("en-MY")}`;

  function cari(e: React.FormEvent) {
    e.preventDefault();
    setQuery(draft);
  }

  return (
    <div>
      {/* Active promo banners (from Banner Manager) */}
      {banners.length > 0 && (
        <div className="bg-red-600 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-xs sm:text-sm">
            {banners.slice(0, 1).map((banner) => (
              <div key={banner.id} className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                <Megaphone className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">{banner.title}</span>
                <span className="hidden text-red-100 sm:inline">{banner.subtitle}</span>
                <Link to={banner.ctaHref} className="ml-auto shrink-0 rounded-full bg-white/15 px-3 py-0.5 font-semibold transition-colors hover:bg-white/25">
                  {banner.ctaLabel} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
          <div className="flex min-w-0 flex-col gap-5">
            <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
              <PlaneTakeoff className="h-4 w-4" />
              {t("Open trip, persendirian & berkumpulan", "Open trips, private & group")}
            </span>
            <h1 className="font-display text-[clamp(30px,4.4vw,46px)] font-extrabold leading-[1.1] tracking-tight [text-wrap:balance]">
              {t(
                "Perjalanan terancang sempurna, dari kerusi anda hingga itinerary.",
                "Fully planned journeys, from your seat to the itinerary.",
              )}
            </h1>
            <p className="m-0 max-w-[46ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
              {t(
                "Harga telus dalam Ringgit, tarikh berlepas sebenar, dan baki kerusi dikemas kini pada setiap tempahan.",
                "Transparent pricing in Ringgit, real departure dates, and seats remaining updated on every booking.",
              )}
            </p>
            <form onSubmit={cari} role="search" className="flex flex-col gap-2 rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-2 shadow-sm focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_var(--color-primary-soft)] sm:flex-row sm:items-stretch">
              <span className="inline-flex items-center pl-2 text-muted-foreground"><MapPin className="h-[18px] w-[18px]" /></span>
              <input
                type="search"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (e.target.value === "") setQuery("");
                }}
                placeholder={t("Ke mana anda pergi? Japan, Bromo, Lombok…", "Where to next? Japan, Bromo, Lombok…")}
                aria-label={t("Cari destinasi atau pakej", "Search destinations or packages")}
                className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[var(--color-primary-hover)]">
                <Search className="h-4 w-4" />
                {t("Cari Pakej", "Search packages")}
              </button>
            </form>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("Destinasi popular", "Popular destinations")}>
              {CHIPS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={item === "All" ? query === "" : query === item}
                  onClick={() => {
                    setQuery(item === "All" ? "" : item);
                    setDraft(item === "All" ? "" : item);
                  }}
                  className={cn(
                    "rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-secondary)] hover:border-[var(--color-text)] hover:text-foreground",
                    (item === "All" ? query === "" : query === item) &&
                      "border-[var(--color-primary)] bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <figure className="relative m-0 aspect-[4/3] min-w-0 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-surface-muted)] shadow-xl">
            <img src={IMG.cover} alt="Terraced rice fields with a temple in Bali" className="h-full w-full object-cover" />
            <figcaption className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-surface)] px-4 py-3 shadow-lg">
              <span className="min-w-0">
                <span className="block text-[11px] text-muted-foreground">{t("Berlepas Seterusnya", "Next departure")}</span>
                <span className="block text-[13.5px] font-semibold">
                  {active[0]?.name ?? t("Pelancongan ZAQONE", "ZAQONE Travel")} · {active[0] ? ringgit(active[0].adultPrice) : "—"}
                </span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-soft)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-success)]">
                <Users className="h-3.5 w-3.5" /> {active.length} {t("pakej", "packages")}
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        {/* Stats */}
        <dl className="m-0 grid grid-cols-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] md:grid-cols-4">
          {[
            { label: t("Pakej Aktif", "Active packages"), value: String(active.length) },
            { label: t("Destinasi", "Destinations"), value: String(destinations.length) },
            { label: t("Pilihan Menarik", "Highlights"), value: String(active.reduce((s, p) => s + (p.highlights?.length ?? 0), 0)) },
            { label: t("Sedia Ditempah", "Ready to book"), value: String(active.length) },
          ].map((s, i) => (
            <div key={i} className="min-w-0 border-b border-[var(--color-border)] px-5 py-4 [&:nth-child(2n)]:border-l md:border-b-0 md:[&:nth-child(2n)]:border-l-0 md:[&:nth-child(n+2)]:border-l">
              <dt className="text-[11.5px] text-muted-foreground">{s.label}</dt>
              <dd className="m-0 mt-1 font-display text-[24px] font-bold [font-variant-numeric:tabular-nums]">{s.value}</dd>
            </div>
          ))}
        </dl>

        {/* Featured packages */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="m-0 font-display text-[22px] font-bold tracking-tight">
                {needle
                  ? `${t("Pakej untuk", "Packages for")} “${query}”`
                  : t("Pakej Pilihan Bulan Ini", "Featured packages this month")}
              </h2>
              <p className="mb-0 mt-1.5 text-[12.5px] text-muted-foreground">
                {featured.length} {t("pakej dengan keberangkatan terbuka", "packages with open departures")}
              </p>
            </div>
            <Link to={lp("/site/packages")} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] no-underline hover:text-[var(--color-primary-hover)]">
              {t("Lihat semua pakej", "View all packages")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {featured.length === 0 ? (
            <div className="rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 py-12 text-center">
              <p className="m-0 text-[14px] font-semibold">{t("Tiada pakej sepadan.", "No packages match this search.")}</p>
              <p className="mb-4 mt-1.5 text-[13px] text-muted-foreground">{t("Cuba destinasi lain atau lihat katalog penuh.", "Try another destination or browse the full catalogue.")}</p>
              <button type="button" onClick={() => { setQuery(""); setDraft(""); }} className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-semibold hover:border-[var(--color-text)]">
                {t("Tunjuk semua pakej", "Show all packages")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((pkg) => {
                const tone = seatsTone(pkg.durationDays % 12 || 5);
                return (
                  <article key={pkg.id} className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-shadow hover:shadow-lg">
                    <Link to={lp(`/site/packages/${pkg.id}`)} className="relative block aspect-[16/10] bg-[var(--color-surface-muted)]">
                      <img src={imageFor(pkg.destination)} alt={`Travel scene in ${pkg.destination}`} className="h-full w-full object-cover" />
                      <span className="absolute left-3 top-3 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[12px] font-semibold text-foreground">
                        {pkg.highlights?.[0] ?? pkg.destination}
                      </span>
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 pb-5">
                      <span className="text-[11.5px] text-muted-foreground">{pkg.destination} · {pkg.durationDays} {t("hari", "days")}</span>
                      <h3 className="m-0 font-display text-[15px] font-semibold leading-tight">{pkg.name}</h3>
                      <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px] text-[var(--color-text-secondary)]">
                        {(pkg.highlights ?? []).slice(0, 3).map((h) => (
                          <li key={h} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 flex-none text-[var(--color-success)]" /><span>{h}</span></li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                        <span className="text-[17px] font-bold [font-variant-numeric:tabular-nums]">{ringgit(pkg.adultPrice)}<span className="text-[11.5px] font-normal text-muted-foreground"> /pax</span></span>
                        <span className="rounded-full px-2.5 py-1 text-[11.5px] font-semibold" style={{ background: tone.bg, color: tone.fg }}>{t("Kerusi tersedia", "Seats available")}</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> {t("Jadual fleksibel", "Flexible schedule")}</span>
                        <Link to={lp(`/site/packages/${pkg.id}`)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-primary)] no-underline hover:text-[var(--color-primary-hover)]">
                          {t("Lihat butiran", "View details")} <ArrowUpRight className="h-3.5 w-3.5" />
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
        {destinations.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="m-0 font-display text-[22px] font-bold tracking-tight">{t("Destinasi Paling Dicari", "Most searched destinations")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {destinations.slice(0, 3).map((dest) => (
                <Link key={dest.name} to={lp("/site/packages")} className="relative block min-w-0 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-surface-muted)] [aspect-ratio:3/2]">
                  <img src={DESTINATION_IMG[dest.name] ?? imageFor(dest.name)} alt={`Scenery in ${dest.name}`} className="h-full w-full object-cover" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-8 text-white">
                    <span className="block font-display text-[16px] font-bold">{dest.name}</span>
                    <span className="text-[11.5px] opacity-85">{dest.count} {t("pakej tersedia", "packages available")}</span>
                  </figcaption>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Promo */}
        <section className="grid items-center gap-6 rounded-[var(--radius-panel)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="min-w-0">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">{t("Promo Website Manager", "Website Manager promo")}</span>
            <h2 className="mb-2 mt-1.5 font-display text-[20px] font-bold leading-tight">
              {t("Bonus RM500 untuk setiap kumpulan 6 orang ke Japan", "RM 500 bonus for every group of 6 travelling to Japan")}
            </h2>
            <p className="m-0 text-[13.5px] leading-relaxed text-[var(--color-text-secondary)]">
              {t("Sah untuk keberangkatan April 2026 selagi kerusi masih ada.", "Valid for April 2026 departures while seats are still available.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={lp("/site/packages")} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[var(--color-primary-hover)]">
              {t("Lihat Pakej Japan", "See Japan packages")}
            </Link>
            <a href="https://wa.me/60123880030" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-2.5 text-[13.5px] font-semibold hover:border-[var(--color-text)]">
              <MessageCircle className="h-4 w-4" /> {t("Tanya promo", "Ask about the promo")}
            </a>
          </div>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-5">
          <h2 className="m-0 font-display text-[22px] font-bold tracking-tight">{t("Bagaimana Tempahan Berfungsi", "How booking works")}</h2>
          <ol className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-3">
            {[
              { icon: CalendarDays, title: t("Pilih pakej & tarikh", "Choose a package & date"), desc: t("Bandingkan tarikh berlepas dan baki kerusi pada setiap pakej.", "Compare departure dates and the seats remaining on every package.") },
              { icon: UserPlus, title: t("Hantar pertanyaan", "Send an enquiry"), desc: t("Isi borang atau sembang di WhatsApp. Pasukan kami balas hari yang sama.", "Fill in the form or chat on WhatsApp. Our sales team replies the same day.") },
              { icon: Wallet, title: t("Bayar deposit, kerusi ditahan", "Pay the deposit, seats are held"), desc: t("Kerusi ditahan 24 jam sehingga Finance mengesahkan transfer deposit.", "Seats are held for 24 hours until Finance verifies your deposit transfer.") },
            ].map((step, i) => (
              <li key={i} className="border-t-2 border-[var(--color-text)] pt-4">
                <span className="text-[11.5px] text-muted-foreground">Step {i + 1}</span>
                <h3 className="mb-2 mt-1.5 flex items-center gap-2 text-[15px] font-semibold"><step.icon className="h-4 w-4 text-[var(--color-primary)]" /> {step.title}</h3>
                <p className="m-0 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="flex flex-wrap items-center justify-between gap-5 rounded-[var(--radius-panel)] bg-[var(--color-text)] p-6 text-[var(--color-surface)] lg:p-8">
          <div className="min-w-0">
            <h2 className="m-0 font-display text-[20px] font-bold text-[var(--color-surface)]">
              {t("Perlukan itinerary khas atau kumpulan sendiri?", "Need a custom itinerary or your own group?")}
            </h2>
            <p className="mb-0 mt-2 max-w-[52ch] text-[13px] leading-relaxed text-[var(--color-surface-muted)]">
              {t("Kami susun tarikh, hotel dan pengangkutan mengikut saiz kumpulan dan bajet anda.", "We arrange dates, hotels and transport around your group size and budget.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="https://wa.me/60123880030" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-surface)] px-5 py-2.5 text-[13.5px] font-semibold text-[var(--color-text)]">
              <MessageCircle className="h-4 w-4" /> {t("Sembang dengan konsultan", "Chat a consultant")}
            </a>
            <Link to={lp("/site/packages")} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-surface)]/40 px-5 py-2.5 text-[13.5px] font-semibold text-[var(--color-surface)]">
              {t("Terokai Pakej", "Explore Packages")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

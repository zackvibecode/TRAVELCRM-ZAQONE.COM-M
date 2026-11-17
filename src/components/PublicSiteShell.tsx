import { Link, Outlet } from "react-router-dom";
import { Menu, X, MessageCircle, MapPin, Phone, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useLang, type Lang } from "@/lib/i18n";

const SITE_META: Record<
  "home" | "packages" | "promos" | "contact" | "default",
  { title: { ms: string; en: string }; description: { ms: string; en: string } }
> = {
  home: {
    title: {
      ms: "ZAQONE Travel — Pakej Umrah, Haji & Pelancongan",
      en: "ZAQONE Travel — Umrah, Hajj & Tour Packages",
    },
    description: {
      ms: "Agensi pelancongan berlesen KPL di Kuala Lumpur. Pakej umrah, haji dan pelancongan domestik serta antarabangsa.",
      en: "KPL-licensed travel agency in Kuala Lumpur. Umrah, hajj, domestic and international tour packages.",
    },
  },
  packages: {
    title: {
      ms: "Pakej Pelancongan — ZAQONE Travel",
      en: "Tour Packages — ZAQONE Travel",
    },
    description: {
      ms: "Lihat semua pakej pelancongan dan keberangkatan tersedia dengan harga dewasa dan kanak-kanak.",
      en: "Browse all tour packages and available departures with adult and child pricing.",
    },
  },
  promos: {
    title: { ms: "Promosi Terkini — ZAQONE Travel", en: "Latest Promos — ZAQONE Travel" },
    description: {
      ms: "Promosi dan tawaran musim terkini daripada ZAQONE Travel.",
      en: "Current seasonal offers and deals from ZAQONE Travel.",
    },
  },
  contact: {
    title: { ms: "Hubungi Kami — ZAQONE Travel", en: "Contact Us — ZAQONE Travel" },
    description: {
      ms: "Hubungi pasukan ZAQONE Travel untuk pertanyaan pakej dan tempahan.",
      en: "Reach the ZAQONE Travel team for package enquiries and bookings.",
    },
  },
  default: {
    title: { ms: "ZAQONE Travel", en: "ZAQONE Travel" },
    description: {
      ms: "Agensi pelancongan berlesen di Kuala Lumpur.",
      en: "Licensed travel agency in Kuala Lumpur.",
    },
  },
};

function metaKeyForPath(path: string): keyof typeof SITE_META {
  if (path === "/site" || path === "/site/" || path.endsWith("/about")) return "home";
  if (path.includes("/packages")) return "packages";
  if (path.includes("/promos")) return "promos";
  if (path.includes("/contact")) return "contact";
  return "default";
}

const WHATSAPP_URL = "https://wa.me/60123880030";

export default function PublicSiteShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, setLang, t, localePath } = useLang();

  const NAV_ITEMS = [
    { to: localePath("/site"), label: t("Utama", "Home"), end: true },
    { to: localePath("/site/packages"), label: t("Pakej Pelancongan", "Tour Packages"), end: false },
    { to: localePath("/site/promos"), label: t("Promosi", "Promos"), end: false },
    { to: localePath("/site/contact"), label: t("Hubungi Kami", "Contact Us"), end: false },
  ];

  // Per-language SEO title & description on every public page.
  useEffect(() => {
    const meta = SITE_META[metaKeyForPath(window.location.pathname)];
    document.title = meta.title[lang];
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", meta.description[lang]);
  }, [lang]);

  return (
    <div className="psite flex min-h-screen flex-col bg-[var(--color-surface)] text-[var(--color-text)]">
      <a href="#main-content" className="absolute -left-[9999px] top-0 focus-ring text-body-sm">
        {t("Langkau ke kandungan", "Skip to content")}
      </a>

      {/* Header — sticky, surface, bottom border (prototype: psite-header) */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-site px-4">
          <div className="flex min-h-[68px] flex-wrap items-center gap-5 min-w-0">
            {/* Brand */}
            <Link
              to={localePath("/site")}
              className="flex flex-none items-center gap-2.5 no-underline text-[var(--color-text)] focus-ring rounded-lg"
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--color-primary)] font-display text-[14px] font-extrabold tracking-[-0.02em] text-[var(--color-on-primary)]"
              >
                ZA
              </span>
              <span className="flex flex-col leading-[1.1]">
                <span className="font-display text-[15px] font-bold tracking-[-0.01em]">
                  ZAQONE Travel
                </span>
                <span className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                  {t("Agensi pelancongan", "Travel agency")}
                </span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav
              aria-label={t("Navigasi utama", "Main navigation")}
              className="hidden min-w-0 flex-wrap items-center gap-1 md:flex"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium leading-[1.3] text-[var(--color-text-secondary)] no-underline transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)] focus-ring",
                    (item.end
                      ? window.location.pathname === item.to
                      : window.location.pathname.startsWith(item.to)) &&
                      "font-semibold text-[var(--color-primary)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="ml-auto flex min-w-0 flex-[0_1_auto] items-center gap-2">
              {/* Language switcher */}
              <div className="hidden items-center rounded-full border border-[var(--color-border-strong)] p-0.5 md:flex">
                {(["ms", "en"] as Lang[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors focus-ring",
                      lang === code
                        ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                    )}
                  >
                    {code === "ms" ? "BM" : "EN"}
                  </button>
                ))}
              </div>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-2 rounded-lg border border-[var(--color-border-strong)] px-4 py-[9px] text-label-md font-medium text-[var(--color-text)] no-underline transition-colors hover:border-[var(--color-text)] focus-ring lg:inline-flex"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                WhatsApp
              </a>
              <Link
                to="/login"
                className="hidden items-center gap-2 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-[9px] text-label-md font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring lg:inline-flex"
              >
                {t("Log Masuk Staf", "Staff login")}
              </Link>

              {/* Mobile toggle */}
              <button
                type="button"
                className="hidden h-10 w-10 place-items-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text)] md:inline-grid focus-ring"
                onClick={() => setMobileOpen((v) => !v)}
                aria-expanded={mobileOpen}
                aria-controls="psite-mobile-menu"
                aria-label={mobileOpen ? t("Tutup menu", "Close menu") : t("Buka menu", "Open menu")}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          <div
            id="psite-mobile-menu"
            className={cn(
              "hidden",
              mobileOpen &&
                "flex flex-col gap-0.5 border-t border-[var(--color-border)] py-3 md:hidden",
            )}
          >
            {mobileOpen &&
              NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-lg px-1 py-3 text-[15px] text-[var(--color-text)] no-underline focus-ring",
                    window.location.pathname.startsWith(item.to) &&
                      "font-semibold text-[var(--color-primary)]",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            {mobileOpen && (
              <>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-1 py-3 text-[15px] text-[var(--color-text)] no-underline focus-ring"
                >
                  {t("Chat di WhatsApp", "Chat on WhatsApp")}
                </a>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-1 py-3 text-[15px] text-[var(--color-text)] no-underline focus-ring"
                >
                  {t("Log Masuk Staf", "Staff login")}
                </Link>
                <div className="mt-1 flex items-center gap-2 px-1 py-2">
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {t("Bahasa", "Language")}:
                  </span>
                  {(["ms", "en"] as Lang[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setLang(code)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-semibold focus-ring",
                        lang === code
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)]",
                      )}
                    >
                      {code === "ms" ? "BM" : "EN"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main id="main-content" className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </main>

      {/* Footer — raised surface, 1.6fr + 3 columns grid (prototype: psite-foot) */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        <div className="mx-auto max-w-site px-4">
          <div className="grid grid-cols-1 gap-6 py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
            <div className="min-w-0">
              <Link
                to={localePath("/site")}
                className="mb-3 flex items-center gap-2.5 no-underline text-[var(--color-text)] focus-ring rounded-lg"
              >
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--color-primary)] font-display text-[14px] font-extrabold text-[var(--color-on-primary)]"
                >
                  ZA
                </span>
                <span className="flex flex-col leading-[1.1]">
                  <span className="font-display text-[15px] font-bold tracking-[-0.01em]">
                    ZAQONE Travel
                  </span>
                  <span className="mt-[3px] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                    {t("Agensi pelancongan", "Travel agency")}
                  </span>
                </span>
              </Link>
              <p className="m-0 max-w-[34ch] text-body-sm leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                {t(
                  "Open trip, perjalanan peribadi dan keberangkatan berkumpulan dengan tarikh keberangkatan langsung dan kerusi yang tinggal.",
                  "Open trips, private journeys and group departures with live departure dates and seats remaining.",
                )}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-body-sm text-[var(--color-text-muted)]">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {t("Jalan Ampang 88, 50450 Kuala Lumpur", "Jalan Ampang 88, 50450 Kuala Lumpur")}
              </p>
            </div>

            <div>
              <h2 className="mb-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {t("Terokai", "Explore")}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                <li>
                  <Link
                    to={localePath("/site")}
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    {t("Utama", "Home")}
                  </Link>
                </li>
                <li>
                  <Link
                    to={localePath("/site/packages")}
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    {t("Katalog pakej", "Package catalogue")}
                  </Link>
                </li>
                <li>
                  <Link
                    to={localePath("/site/packages/japan-sakura")}
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    {t("Butiran trip", "Trip details")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {t("Bantuan", "Help")}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    WhatsApp
                  </a>
                </li>
                <li>
                  <Link
                    to={localePath("/site/contact")}
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    {t("Cara tempahan berfungsi", "How booking works")}
                  </Link>
                </li>
                <li>
                  <Link
                    to={localePath("/site/contact")}
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    {t("Polisi pembatalan", "Cancellation policy")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 font-body text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {t("Hubungi", "Contact")}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                <li>
                  <a
                    href="tel:+60327118899"
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" aria-hidden="true" /> +60 3 2711 8899
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@zaqone.travel"
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" aria-hidden="true" /> hello@zaqone.travel
                    </span>
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> +60 12 388 0030
                    </span>
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] py-4">
            <p className="m-0 text-caption text-[var(--color-text-muted)]">
              © {new Date().getFullYear()} ZAQONE Travel.{" "}
              {t(
                "Semua harga dalam Ringgit Malaysia (MYR) dan boleh berubah mengikut ketersediaan kerusi.",
                "All prices are in Malaysian Ringgit (MYR) and may change with seat availability.",
              )}
            </p>
            <Link
              to="/login"
              className="text-caption font-medium text-[var(--color-text-secondary)] no-underline transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
            >
              {t("Kawasan staf", "Staff area")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

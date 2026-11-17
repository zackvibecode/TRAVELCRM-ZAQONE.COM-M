import { Link, Outlet, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const NAV_ITEMS = [
    { to: localePath("/site"), label: t("Utama", "Home"), end: true },
    { to: localePath("/site/packages"), label: t("Pakej Pelancongan", "Tour Packages") },
    { to: localePath("/site/promos"), label: t("Promosi", "Promos") },
    { to: localePath("/site/contact"), label: t("Hubungi Kami", "Contact Us") },
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
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)] text-foreground">
      <a
        href="#main-content"
        className="absolute -left-[9999px] top-0 focus-ring"
      >
        {t("Langkau ke kandungan", "Skip to content")}
      </a>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto max-w-site px-4">
          <div className="flex min-h-[68px] flex-wrap items-center gap-4">
            {/* Brand */}
            <Link
              to={localePath("/site")}
              className="flex flex-none items-center gap-2.5 text-foreground focus-ring rounded-lg"
            >
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--color-primary)] font-display text-sm font-extrabold tracking-tight text-white">
                ZA
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-display text-[15px] font-bold tracking-tight">
                  ZAQONE Travel
                </span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Travel agency
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
                    "rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring",
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
            <div className="ml-auto flex items-center gap-2">
              {/* Language switcher */}
              <div className="hidden items-center rounded-full border border-[var(--color-border-strong)] p-0.5 md:flex">
                {(["ms", "en"] as Lang[]).map((code) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors focus-ring",
                      lang === code
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-muted-foreground hover:text-foreground",
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
                className="hidden items-center gap-2 rounded-lg border border-[var(--color-border-strong)] px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-foreground focus-ring lg:inline-flex"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
              <button
                onClick={() => navigate("/login")}
                className="hidden items-center gap-2 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] focus-ring lg:inline-flex"
              >
                {t("Log Masuk Staf", "Staff login")}
              </button>

              {/* Mobile toggle */}
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--color-border-strong)] text-foreground md:hidden focus-ring"
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
              "md:hidden",
              mobileOpen &&
                "flex flex-col gap-0.5 border-t border-[var(--color-border)] py-3",
            )}
          >
            {mobileOpen &&
              NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-1 py-3 text-[15px] text-foreground focus-ring"
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
                  className="rounded-lg px-1 py-3 text-[15px] text-foreground focus-ring"
                >
                  {t("Chat di WhatsApp", "Chat on WhatsApp")}
                </a>
                <button
                  onClick={() => navigate("/login")}
                  className="rounded-lg px-1 py-3 text-left text-[15px] text-foreground focus-ring"
                >
                  {t("Log Masuk Staf", "Staff login")}
                </button>
                <div className="mt-1 flex items-center gap-2 px-1 py-2">
                  <span className="text-xs text-muted-foreground">
                    {t("Bahasa", "Language")}:
                  </span>
                  {(["ms", "en"] as Lang[]).map((code) => (
                    <button
                      key={code}
                      onClick={() => setLang(code)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-semibold focus-ring",
                        lang === code
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                          : "border-[var(--color-border)] text-muted-foreground",
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

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        <div className="mx-auto max-w-site px-4">
          <div className="grid grid-cols-1 gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 lg:col-span-1">
              <Link
                to={localePath("/site")}
                className="mb-3 flex items-center gap-2.5 text-foreground focus-ring rounded-lg"
              >
                <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--color-primary)] font-display text-sm font-extrabold text-white">
                  ZA
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-display text-[15px] font-bold tracking-tight">
                    ZAQONE Travel
                  </span>
                  <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Travel agency
                  </span>
                </span>
              </Link>
              <p className="m-0 max-w-[34ch] text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {t(
                  "Open trip, perjalanan peribadi dan keberangkatan berkumpulan dengan tarikh keberangkatan langsung dan kerusi yang tinggal.",
                  "Open trips, private journeys and group departures with live departure dates and seats remaining.",
                )}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {t("Jalan Ampang 88, 50450 Kuala Lumpur", "Jalan Ampang 88, 50450 Kuala Lumpur")}
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {t("Terokai", "Explore")}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {NAV_ITEMS.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {t("Bantuan", "Help")}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    WhatsApp
                  </a>
                </li>
                <li>
                  <Link
                    to={localePath("/site/contact")}
                    className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    {t("Cara tempahan berfungsi", "How booking works")}
                  </Link>
                </li>
                <li>
                  <Link
                    to={localePath("/site/contact")}
                    className="text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    {t("Polisi pembatalan", "Cancellation policy")}
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {t("Hubungi", "Contact")}
              </h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                <li>
                  <a
                    href="tel:+60327118899"
                    className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    <Phone className="h-3.5 w-3.5" /> +60 3 2711 8899
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@zaqone.travel"
                    className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    <Mail className="h-3.5 w-3.5" /> hello@zaqone.travel
                  </a>
                </li>
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> +60 12 388 0030
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] py-4">
            <p className="m-0 text-xs text-muted-foreground">
              © {new Date().getFullYear()} ZAQONE Travel.{" "}
              {t(
                "Semua harga dalam Ringgit Malaysia (MYR) dan boleh berubah mengikut ketersediaan kerusi.",
                "All prices are in Malaysian Ringgit (MYR) and may change with seat availability.",
              )}
            </p>
            <button
              onClick={() => navigate("/login")}
              className="text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus-ring rounded"
            >
              {t("Kawasan staf", "Staff area")}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

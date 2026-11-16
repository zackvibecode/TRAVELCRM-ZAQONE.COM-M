import { Link, Outlet } from "react-router-dom";
import { Plane, Menu, X, Phone, Mail, Instagram, Facebook } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLang, type Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export default function PublicSiteShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { lang, setLang, t } = useLang();

  const NAV_ITEMS = [
    { to: "/site", label: t("Utama", "Home"), end: true },
    { to: "/site/packages", label: t("Pakej Pelancongan", "Tour Packages") },
    { to: "/site/promos", label: t("Promosi", "Promos") },
    { to: "/site/contact", label: t("Hubungi Kami", "Contact Us") },
  ];

  return (
    <div className="min-h-screen bg-white text-stone-900">
      {/* Top bar */}
      <div className="hidden border-b bg-stone-900 text-stone-300 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> +60 3 5555 0123
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> hello@zaqonetravel.com
            </span>
          </div>
          <span>{t("Isnin–Sabtu, 09.00–18.00", "Mon–Sat, 9am–6pm")}</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/site" className="flex items-center gap-2">
            <div className="rounded-lg bg-red-600 p-1.5">
              <Plane className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="block text-base font-bold leading-tight tracking-tight">
                ZAQONE
                <span className="text-red-600"> TRAVEL</span>
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Tour &amp; Travel
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="text-sm font-medium text-stone-700 transition-colors hover:text-red-600"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {/* Language switcher */}
            <div className="flex items-center rounded-full border p-0.5">
              {(["ms", "en"] as Lang[]).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
                    lang === code
                      ? "bg-red-600 text-white"
                      : "text-stone-500 hover:text-stone-900",
                  )}
                >
                  {code === "ms" ? "BM" : "EN"}
                </button>
              ))}
            </div>
            <Button size="sm" asChild>
              <Link to="/site/contact">
                {t("Konsultasi Percuma", "Free Consultation")}
              </Link>
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="rounded-lg border p-2 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="border-t bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 flex items-center gap-2 px-3">
                <span className="text-xs text-stone-500">
                  {t("Bahasa", "Language")}:
                </span>
                {(["ms", "en"] as Lang[]).map((code) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      lang === code
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-stone-200 text-stone-500",
                    )}
                  >
                    {code === "ms" ? "BM" : "EN"}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        )}
      </header>

      {/* Page content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t bg-stone-900 text-stone-300">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-red-600 p-1.5">
                <Plane className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold text-white">
                ZAQONE <span className="text-red-500">TRAVEL</span>
              </span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-400">
              {t(
                "Agensi pelancongan serba lengkap: pakej pelancongan domestik dan antarabangsa, trip berkumpulan, dan korporat.",
                "All-in-one travel agency: domestic and international tour packages, group trips, and corporate travel.",
              )}
            </p>
            <div className="mt-4 flex gap-3">
              <a href="#" aria-label="Instagram" className="rounded-lg border border-stone-700 p-2 hover:border-red-500">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="#" aria-label="Facebook" className="rounded-lg border border-stone-700 p-2 hover:border-red-500">
                <Facebook className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              {t("Navigasi", "Navigation")}
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="hover:text-red-400">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              {t("Hubungi", "Contact")}
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-stone-400">
              <li>{t("Jalan Sultan Ismail, Kuala Lumpur", "Jalan Sultan Ismail, Kuala Lumpur")}</li>
              <li>+60 3 5555 0123</li>
              <li>hello@zaqonetravel.com</li>
              <li>WA: +60 12 345 6789</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">
              {t("Waktu Operasi", "Operating Hours")}
            </h3>
            <ul className="mt-3 space-y-2 text-xs text-stone-400">
              <li>{t("Isnin–Jumaat: 09.00–18.00", "Mon–Fri: 9am–6pm")}</li>
              <li>{t("Sabtu: 09.00–15.00", "Sat: 9am–3pm")}</li>
              <li>{t("Ahad & Cuti: Tutup", "Sun & Holidays: Closed")}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-stone-800 py-4 text-center text-[11px] text-stone-500">
          © {new Date().getFullYear()} ZAQONE TRAVEL CRM. {t("Hak cipta terpelihara.", "All rights reserved.")}
        </div>
      </footer>
    </div>
  );
}

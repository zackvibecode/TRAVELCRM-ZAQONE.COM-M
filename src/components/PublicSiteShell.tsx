import { Link, Outlet } from "react-router-dom";
import { Plane, Menu, X, Phone, Mail, Instagram, Facebook } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { to: "/site", label: "Home", end: true },
  { to: "/site/packages", label: "Paket Wisata" },
  { to: "/site/about", label: "Tentang Kami" },
  { to: "/site/contact", label: "Kontak" },
];

export default function PublicSiteShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-stone-900">
      {/* Top bar */}
      <div className="hidden border-b bg-stone-900 text-stone-300 md:block">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> +62 21 5555 0123
            </span>
            <span className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> hello@travelos.id
            </span>
          </div>
          <span>Senin–Sabtu, 09.00–18.00 WIB</span>
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
                TravelOS
              </span>
              <span className="block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Tour & Travel
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

          <div className="hidden md:block">
            <Button size="sm" asChild>
              <Link to="/site/contact">Konsultasi Gratis</Link>
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
              <span className="text-base font-bold text-white">TravelOS</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-stone-400">
              Travel agency all-in-one: paket wisata domestik dan internasional,
              group trip, dan corporate travel.
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
            <h3 className="text-sm font-semibold text-white">Navigasi</h3>
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
            <h3 className="text-sm font-semibold text-white">Kontak</h3>
            <ul className="mt-3 space-y-2 text-xs text-stone-400">
              <li>Jl. Sudirman Kav. 52, Jakarta</li>
              <li>+62 21 5555 0123</li>
              <li>hello@travelos.id</li>
              <li>WA: +62 812 3456 7890</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Jam Operasional</h3>
            <ul className="mt-3 space-y-2 text-xs text-stone-400">
              <li>Senin–Jumat: 09.00–18.00</li>
              <li>Sabtu: 09.00–15.00</li>
              <li>Minggu & Libur: Tutup</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-stone-800 py-4 text-center text-[11px] text-stone-500">
          © {new Date().getFullYear()} TravelOS Suite. Semua hak dilindungi.
        </div>
      </footer>
    </div>
  );
}

import { useState } from "react";
import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Luggage,
  BookOpenCheck,
  Banknote,
  Globe,
  Settings,
  Building2,
  Mail,
  KeyRound,
  Database,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  TrendingUp,
  FileBarChart,
  Languages,
  Bot,
  ScrollText,
  ChevronDown,
  ChevronRight,
  Bell,
  LogOut,
  Search,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang, type Lang } from "@/lib/i18n";
import { getSession, logout, type StaffRole } from "@/lib/auth";
import { canAccess } from "@/lib/roles";

const ROLE_BADGE: Record<StaffRole, { ms: string; en: string }> = {
  super_admin: { ms: "Super Admin", en: "Super Admin" },
  management: { ms: "Pengurusan", en: "Management" },
  sales: { ms: "Jualan", en: "Sales" },
  finance: { ms: "Kewangan", en: "Finance" },
  operations: { ms: "Operasi", en: "Operations" },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { lang, setLang, t } = useLang();
  const navigate = useNavigate();
  const session = getSession();

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  const navSections = [
    {
      title: t("Ruang Kerja", "Workspace"),
      items: [
        { to: "/", label: t("Papan Pemuka", "Dashboard"), icon: LayoutDashboard, end: true },
        { to: "/bookings", label: t("Tempahan", "Bookings"), icon: BookOpenCheck },
        { to: "/trips", label: t("Trip & Kerusi", "Trips & Seats"), icon: CalendarDays },
        { to: "/packages", label: t("Pakej", "Packages"), icon: Luggage },
      ],
    },
    {
      title: t("Jualan & Kewangan", "Sales & Finance"),
      items: [
        { to: "/customers", label: t("Pelanggan", "Customers"), icon: Users },
        { to: "/leads", label: t("Saluran Leads", "Leads Pipeline"), icon: TrendingUp },
        { to: "/billing", label: t("Billing & Pembayaran", "Billing & Payments"), icon: Banknote },
        { to: "/reports", label: t("Laporan", "Reports"), icon: FileBarChart },
      ],
    },
    {
      title: t("Sistem", "Platform"),
      items: [
        { to: "/website", label: t("Pengurus Laman", "Website Manager"), icon: Globe },
        { to: "/ai-tokens", label: t("Token Akses AI", "AI Access Tokens"), icon: Bot },
        { to: "/mcp-audit", label: t("Log Audit MCP", "MCP Audit Log"), icon: ScrollText },
        { to: "/staff", label: t("Peranan Staf", "Staff Roles"), icon: Users },
        { to: "/staff-audit", label: t("Log Audit Staf", "Staff Audit Log"), icon: ScrollText },
        { to: "/company-profile", label: t("Profil Syarikat", "Company Profile"), icon: Building2 },
        { to: "/bank-accounts", label: t("Akaun Bank", "Bank Accounts"), icon: Banknote },
        { to: "/document-numbering", label: t("Penomboran Dokumen", "Document Numbering"), icon: FileBarChart },
        { to: "/booking-defaults", label: t("Lalai Tempahan", "Booking Defaults"), icon: CalendarDays },
        { to: "/notification-templates", label: t("Templat Pemberitahuan", "Notification Templates"), icon: Mail },
        { to: "/api-tokens", label: t("Token API", "API Tokens"), icon: KeyRound },
        { to: "/data-maintenance", label: t("Penyelenggaraan Data", "Data Maintenance"), icon: Database },
        { to: "/settings-audit", label: t("Log Audit Tetapan", "Settings Audit Log"), icon: ScrollText },
        { to: "/settings", label: t("Tetapan", "Settings"), icon: Settings },
      ],
    },
  ];

  const pageTitle = (() => {
    for (const section of navSections) {
      const match = section.items.find((i) =>
        i.end ? window.location.pathname === i.to : window.location.pathname.startsWith(i.to),
      );
      if (match) return match.label;
    }
    return t("Papan Pemuka", "Dashboard");
  })();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Scrim for mobile nav */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — 268px expanded / 76px collapsed, per travelos-shell */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 lg:static",
          collapsed ? "w-[76px]" : "w-[268px]",
          mobileOpen ? "translate-x-0 shadow-panel" : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Mobile close */}
        <button
          type="button"
          aria-label={t("Tutup menu", "Close menu")}
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center text-muted-foreground lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 px-4 pb-5 pt-5">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--color-primary)] font-display text-[15px] font-bold tracking-tight text-white">
            ZA
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-display text-base font-bold leading-tight tracking-tight">
                ZAQONE
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                Travel
              </span>
            </span>
          )}
        </div>

        <nav
          aria-label={t("Navigasi utama", "Main navigation")}
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6 [scrollbar-width:thin]"
        >
          {navSections
            .map((section) => ({
              ...section,
              items: section.items.filter((item) => canAccess(item.to, session?.role)),
            }))
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div key={section.title}>
                {!collapsed && (
                  <div className="px-3 pb-2 pt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {section.title}
                  </div>
                )}
                {collapsed && <div className="pb-2 pt-4" />}
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium leading-snug text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring",
                          isActive &&
                            "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]",
                          collapsed && "justify-center px-0",
                        )
                      }
                    >
                      <item.icon className="h-[17px] w-[17px] shrink-0 opacity-80" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
        </nav>

        {/* Help card — bottom of sidebar, per prototype */}
        {!collapsed && (
          <div className="mx-3 mb-6 rounded-xl bg-[var(--color-surface-muted)] p-4">
            <p className="m-0 text-[12.5px] font-semibold text-foreground">
              {t("Perlukan bantuan?", "Need a hand?")}
            </p>
            <p className="mb-2.5 mt-1 text-xs leading-relaxed text-muted-foreground">
              {t(
                "Panduan aliran tempahan, tahanan kerusi dan pengesahan bayaran.",
                "Guides for the booking flow, seat holds and payment verification.",
              )}
            </p>
            <Link
              to="/website"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              {t("Buka pusat bantuan", "Open help centre")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Collapse control */}
        <div className="border-t border-[var(--color-border)] p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden w-full items-center justify-center rounded-lg border border-[var(--color-border)] p-2 text-muted-foreground hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring lg:flex"
            title={collapsed ? t("Kembangkan", "Expand") : t("Kuncupkan", "Collapse")}
            aria-pressed={collapsed}
            aria-label={collapsed ? t("Kembangkan sidebar", "Expand sidebar") : t("Kuncupkan sidebar", "Collapse sidebar")}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--color-background)]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:px-6">
          <button
            className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t("Buka menu navigasi", "Open navigation menu")}
            aria-expanded={mobileOpen}
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Breadcrumbs */}
          <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="hidden sm:inline">ZAQONE</span>
            <ChevronRight className="hidden h-3 w-3 sm:inline" />
            <strong className="truncate font-semibold text-foreground">{pageTitle}</strong>
          </div>

          {/* Global search */}
          <div className="hidden h-9 flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 text-muted-foreground transition-colors focus-within:border-[var(--color-border-strong)] focus-within:bg-[var(--color-surface)] md:flex md:max-w-[340px] md:ml-auto">
            <Search className="h-4 w-4" />
            <input
              type="search"
              placeholder={t("Cari tempahan, pelanggan, pakej…", "Search bookings, customers, packages…")}
              aria-label={t("Carian sejagat", "Global search")}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            {/* Language switcher */}
            <div className="flex items-center rounded-full border border-[var(--color-border)] p-0.5">
              <Languages className="mx-1.5 h-3.5 w-3.5 text-muted-foreground" />
              {(["ms", "en"] as Lang[]).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
                    lang === code
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {code === "ms" ? "BM" : "EN"}
                </button>
              ))}
            </div>

            {/* Notifications */}
            <button
              className="relative grid h-9 w-9 place-items-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring"
              aria-label={t("Pemberitahuan", "Notifications")}
              onClick={() => navigate("/reports")}
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-1.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-[var(--color-surface)] bg-[var(--color-primary)]" />
            </button>

            {/* User menu */}
            <div className="relative flex items-center gap-2.5 border-l border-[var(--color-border)] pl-3">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2.5 focus-ring rounded-lg"
                aria-expanded={userMenuOpen}
              >
                <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white">
                  {session ? initials(session.name) : "ZA"}
                </span>
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="text-[13px] font-semibold text-foreground">
                    {session ? session.name.split("(")[0].trim() : t("Staf", "Staff")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {session ? t(ROLE_BADGE[session.role].ms, ROLE_BADGE[session.role].en) : ""}
                  </span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:inline" />
              </button>
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-[var(--color-border)] bg-white p-1 shadow-lg">
                    <div className="border-b border-[var(--color-border)] px-3 py-2">
                      <div className="text-sm font-semibold">
                        {session?.name ?? t("Staf", "Staff")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {session?.email ?? ""}
                      </div>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("Log Keluar", "Sign Out")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-clip p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

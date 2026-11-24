import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
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
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Bell,
  LogOut,
  Search,
  ArrowRight,
  SlidersHorizontal,
  ListChecks,
  UserCircle2,
  FileSpreadsheet,
  Trophy,
  MessageCircle,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang, type Lang } from "@/lib/i18n";
import { AiAssistantFab } from "@/pages/AiAssistant";
import { getSession, logout, type StaffRole } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { useBranding } from "@/lib/useBranding";

const ROLE_BADGE: Record<StaffRole, { ms: string; en: string }> = {
  super_admin: { ms: "Super Admin", en: "Super Admin" },
  management: { ms: "Pengurusan", en: "Management" },
  sales: { ms: "Jualan", en: "Sales" },
  finance: { ms: "Kewangan", en: "Finance" },
  operations: { ms: "Operasi", en: "Operations" },
};

type NavItem = {
  to: string;
  label: string;
  icon: typeof Globe;
  end?: boolean;
  /** Items grouped under a collapsible parent, not shown at the top level. */
  children?: NavItem[];
};

/**
 * The collapsible sidebar groups. Declared at module level so the auto-expand
 * effect and the renderer always agree on which routes belong to which group.
 * Labels are translated in `navSections`; these are the raw route groups.
 */
const COLLAPSIBLE_GROUPS: NavItem[] = [
  {
    to: "/ai-tokens",
    label: "AI & Integrasi",
    icon: Bot,
    children: [
      { to: "/ai-tokens", label: "Token Akses AI", icon: KeyRound },
      { to: "/mcp-audit", label: "Log Audit MCP", icon: ScrollText },
    ],
  },
  {
    to: "/settings",
    label: "Tetapan",
    icon: Settings,
    children: [
      { to: "/settings", label: "Tetapan Umum", icon: SlidersHorizontal },
      { to: "/company-profile", label: "Profil Syarikat", icon: Building2 },
      { to: "/bank-accounts", label: "Akaun Bank", icon: Banknote },
      { to: "/document-numbering", label: "Penomboran Dokumen", icon: FileBarChart },
      { to: "/booking-defaults", label: "Lalai Tempahan", icon: CalendarDays },
      { to: "/notification-templates", label: "Templat Pemberitahuan", icon: Mail },
      { to: "/api-tokens", label: "Token API", icon: KeyRound },
      { to: "/staff", label: "Akses Staf", icon: ShieldCheck },
      { to: "/staff-audit", label: "Log Audit Staf", icon: ScrollText },
      { to: "/data-maintenance", label: "Penyelenggaraan Data", icon: Database },
      { to: "/settings-audit", label: "Log Audit Tetapan", icon: ScrollText },
    ],
  },
];

/** Translates a collapsible child's label using the active language. */
function translateChildLabel(
  to: string,
  t: (ms: string, en: string) => string,
): string {
  const map: Record<string, [string, string]> = {
    "/settings": ["Tetapan Umum", "General Settings"],
    "/company-profile": ["Profil Syarikat", "Company Profile"],
    "/bank-accounts": ["Akaun Bank", "Bank Accounts"],
    "/document-numbering": ["Penomboran Dokumen", "Document Numbering"],
    "/booking-defaults": ["Lalai Tempahan", "Booking Defaults"],
    "/notification-templates": ["Templat Pemberitahuan", "Notification Templates"],
    "/api-tokens": ["Token API", "API Tokens"],
    "/staff": ["Akses Staf", "Staff Access"],
    "/staff-audit": ["Log Audit Staf", "Staff Audit Log"],
    "/data-maintenance": ["Penyelenggaraan Data", "Data Maintenance"],
    "/settings-audit": ["Log Audit Tetapan", "Settings Audit Log"],
    "/ai-tokens": ["Token Akses AI", "AI Access Tokens"],
    "/mcp-audit": ["Log Audit MCP", "MCP Audit Log"],
  };
  const entry = map[to];
  return entry ? t(entry[0], entry[1]) : to;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * A nav entry that groups several sub-pages behind a collapsible parent, so
 * the sidebar stays short instead of listing every admin screen flat.
 */
function CollapsibleNavItem({
  item,
  collapsed,
  open,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const { pathname } = useLocation();
  const children = item.children ?? [];
  const isChildActive = children.some((c) =>
    pathname === c.to || pathname.startsWith(`${c.to}/`),
  );

  if (collapsed) {
    // Collapsed sidebar: the parent icon links straight to its first child.
    const first = children[0];
    if (!first) return null;
    return (
      <NavLink
        to={first.to}
        title={item.label}
        className={({ isActive }) =>
          cn(
            "flex items-center justify-center rounded-[var(--radius-control)] px-0 py-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring",
            (isActive || isChildActive) &&
              "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]",
          )
        }
      >
        <item.icon className="h-[17px] w-[17px] shrink-0 opacity-80" />
      </NavLink>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13.5px] font-medium leading-snug text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring",
          isChildActive && "font-semibold text-[var(--color-primary)]",
        )}
      >
        <item.icon className="h-[17px] w-[17px] shrink-0 opacity-80" />
        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 flex-none opacity-60" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-none opacity-60" />
        )}
      </button>
      {open && (
        <ul className="ml-[21px] flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-2.5">
          {children.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "block truncate rounded-[var(--radius-control)] px-2.5 py-1.5 text-[12.5px] font-medium leading-snug text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring",
                    isActive &&
                      "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]",
                  )
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const { pathname: navPathname } = useLocation();

  // Auto-expand the collapsible groups when the user is already inside one
  // of their pages, so the current location is never hidden.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const group of COLLAPSIBLE_GROUPS) {
        if (
          group.children?.some(
            (c) => navPathname === c.to || navPathname.startsWith(`${c.to}/`),
          )
        ) {
          if (!next[group.to]) {
            next[group.to] = true;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [navPathname]);
  const { lang, setLang, t } = useLang();
  const branding = useBranding();
  const navigate = useNavigate();
  const session = getSession();

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  };

  // Susunan navigasi ikut shell prototaip DesainPakeAI: Overview / Operations
  // / Platform. Semua rute sedia ada dikekalkan supaya tak ada functionality
  // hilang — hanya pengelompokan labelnya yang selaras dengan prototaip.
  const navSections: { title: string; items: NavItem[] }[] = [
    {
      title: t("Gambaran Keseluruhan", "Overview"),
      items: [
        { to: "/", label: t("Papan Pemuka", "Dashboard"), icon: LayoutDashboard, end: true },
        { to: "/customers", label: t("Pelanggan & Leads", "Customers & Leads"), icon: Users },
        { to: "/leads", label: t("Saluran Leads", "Leads Pipeline"), icon: TrendingUp },
        { to: "/followups", label: t("Pusat Susulan", "Follow-Up Center"), icon: ListChecks },
        { to: "/lead-import", label: t("Import Lead", "Import Leads"), icon: FileSpreadsheet },
        { to: "/lead-management", label: t("Pengurusan Lead", "Lead Management"), icon: UserCircle2 },
        { to: "/leaderboard", label: t("Dashboard & Peringkat", "Leaderboard"), icon: Trophy },
        { to: "/whatsapp-templates", label: t("Templat WhatsApp", "WhatsApp Templates"), icon: MessageCircle },
        { to: "/admin-console", label: t("Konsol Admin", "Admin Console"), icon: Settings2 },
        { to: "/bookings", label: t("Tempahan", "Bookings"), icon: BookOpenCheck },
        { to: "/billing", label: t("Bil & Pembayaran", "Billing & Payments"), icon: Banknote },
        { to: "/reports", label: t("Laporan", "Reports"), icon: FileBarChart },
      ],
    },
    {
      title: t("Operasi", "Operations"),
      items: [
        { to: "/packages", label: t("Pakej", "Packages"), icon: Luggage },
        { to: "/trips", label: t("Trip & Kerusi", "Trips & Seats"), icon: CalendarDays },
      ],
    },
    {
      title: t("Platform", "Platform"),
      items: [
        { to: "/website", label: t("Pengurus Laman", "Website Manager"), icon: Globe },
        { to: "/ai-assistant", label: t("Tony — Pembantu AI", "Tony — AI Assistant"), icon: Sparkles },
        {
          to: "/ai-tokens",
          label: t("AI & Integrasi", "AI & Integrations"),
          icon: Bot,
          children: COLLAPSIBLE_GROUPS[0].children?.map((c) => ({
            ...c,
            label: translateChildLabel(c.to, t),
          })),
        },
        {
          to: "/settings",
          label: t("Tetapan", "Settings"),
          icon: Settings,
          children: COLLAPSIBLE_GROUPS[1].children?.map((c) => ({
            ...c,
            label: translateChildLabel(c.to, t),
          })),
        },
      ],
    },
  ];

  const pageTitle = (() => {
    // Collect every navigable route (including collapsible children) and pick
    // the longest matching prefix so "/settings-audit" does not get labelled
    // as "/settings".
    const flat: Array<{ to: string; label: string; end?: boolean; exact?: boolean }> = [];
    for (const section of navSections) {
      for (const item of section.items) {
        flat.push({ to: item.to, label: item.label, end: item.end });
        for (const child of item.children ?? []) {
          flat.push({ to: child.to, label: child.label, exact: true });
        }
      }
    }
    const match = flat
      .filter((i) => {
        const path = window.location.pathname;
        if (i.exact) return path === i.to || path.startsWith(`${i.to}/`);
        if (i.end) return path === i.to;
        return path === i.to || path.startsWith(`${i.to}/`);
      })
      .sort((a, b) => b.to.length - a.to.length)[0];
    if (match) return match.label;
    return t("Papan Pemuka", "Dashboard");
  })();

  return (
    <div className="flex min-h-screen bg-background" data-layout-system="travelos-shell">
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

        <div className="flex items-center gap-2 px-4 pb-5 pt-5">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.brandName}
              className={cn(
                "min-w-0 flex-1 object-contain",
                collapsed ? "h-9 w-full" : "mx-auto h-[64px] w-[200px]",
              )}
              decoding="async"
              fetchPriority="high"
            />
          ) : (
            <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--color-primary)] font-display text-[15px] font-bold tracking-[-0.02em] text-white">
              {branding.brandName.slice(0, 2).toUpperCase()}
            </span>
          )}
          {!collapsed && !branding.logoUrl && (
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-display text-[16px] font-bold leading-tight tracking-[-0.01em]">
                {branding.brandName}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {branding.tagline}
              </span>
            </span>
          )}
          {/* Collapse control — top right of sidebar, next to the logo */}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden h-8 w-8 flex-none place-items-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring lg:grid"
            title={collapsed ? t("Kembangkan", "Expand") : t("Kuncupkan", "Collapse")}
            aria-pressed={collapsed}
            aria-label={collapsed ? t("Kembangkan sidebar", "Expand sidebar") : t("Kuncupkan sidebar", "Collapse sidebar")}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4 mx-auto" /> : <PanelLeftClose className="h-4 w-4 mx-auto" />}
          </button>
        </div>

        <nav
          aria-label={t("Navigasi utama", "Main navigation")}
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6 [scrollbar-width:thin]"
        >
          {navSections
            .map((section) => ({
              ...section,
              items: section.items
                // A collapsible parent stays visible when at least one of its
                // children is accessible to the current role.
                .map((item) =>
                  item.children?.length
                    ? {
                        ...item,
                        children: item.children.filter((c) =>
                          canAccess(c.to, session?.role),
                        ),
                      }
                    : item,
                )
                .filter((item) =>
                  item.children?.length
                    ? item.children.length > 0
                    : canAccess(item.to, session?.role),
                ),
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
                  {section.items.map((item) =>
                    item.children && item.children.length > 0 ? (
                      <CollapsibleNavItem
                        key={item.to}
                        item={item}
                        collapsed={collapsed}
                        open={Boolean(openGroups[item.to])}
                        onToggle={() =>
                          setOpenGroups((prev) => ({
                            ...prev,
                            [item.to]: !prev[item.to],
                          }))
                        }
                        onNavigate={() => setMobileOpen(false)}
                      />
                    ) : (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13.5px] font-medium leading-snug text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring",
                            isActive &&
                              "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]",
                            collapsed && "justify-center px-0",
                          )
                        }
                      >
                        <item.icon className="h-[17px] w-[17px] shrink-0 opacity-80" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    ),
                  )}
                </div>
              </div>
            ))}
        </nav>

        {/* Help card — bottom of sidebar, per prototype */}
        {!collapsed && (
          <div className="mx-3 mb-6 rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] p-4">
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
            <span className="hidden sm:inline">{branding.brandName}</span>
            <ChevronRight className="hidden h-3 w-3 sm:inline" />
            <strong className="truncate font-semibold text-foreground">{pageTitle}</strong>
          </div>

          {/* Global search */}
          <div className="hidden h-9 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 text-muted-foreground transition-colors focus-within:border-[var(--color-border-strong)] focus-within:bg-[var(--color-surface)] md:flex md:max-w-[340px] md:ml-auto">
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
              className="relative grid h-9 w-9 place-items-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-foreground focus-ring"
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

        {/* Page content — prototaip: badan penuh lebar, halaman susun grid sendiri */}
        <main className="min-w-0 flex-1 overflow-x-clip p-4 md:p-6">
          <Outlet />
        </main>

        {/* Floating AI assistant — available on every CRM page. */}
        <AiAssistantFab />
      </div>
    </div>
  );
}

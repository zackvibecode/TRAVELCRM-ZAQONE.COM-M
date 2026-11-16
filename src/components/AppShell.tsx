import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Luggage,
  BookOpenCheck,
  Banknote,
  Globe,
  Settings,
  Menu,
  X,
  Plane,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navSections = [
  {
    title: "Workspace",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/bookings", label: "Bookings", icon: BookOpenCheck },
      { to: "/trips", label: "Trips & Seats", icon: CalendarDays },
      { to: "/packages", label: "Packages", icon: Luggage },
    ],
  },
  {
    title: "Sales & Finance",
    items: [
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/leads", label: "Leads Pipeline", icon: TrendingUp },
      { to: "/billing", label: "Billing & Payments", icon: Banknote },
    ],
  },
  {
    title: "System",
    items: [
      { to: "/website", label: "Website Manager", icon: Globe },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-white transition-all duration-200 lg:static",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <Plane className="h-4 w-4" />
          </div>
          {!collapsed && (
            <span className="font-display text-lg font-bold tracking-tight">
              Travel<span className="text-primary">OS</span>
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navSections.map((section) => (
            <div key={section.title} className="mb-6">
              {!collapsed && (
                <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        isActive && "bg-primary/10 text-primary",
                        collapsed && "justify-center px-0",
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="hidden w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted lg:flex"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-white px-4">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium text-muted-foreground">
              Travel Agency Management
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              SA
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

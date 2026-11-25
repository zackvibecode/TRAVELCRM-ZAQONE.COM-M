import type { StaffRole } from "@/lib/auth";
import { canAccessWithMatrix } from "@/lib/permission-store";

/**
 * Central access map. Every protected route declares the roles allowed to
 * see it. Kept in one place so the sidebar and the route guard never drift.
 */
export const ROUTE_ROLES: Record<string, StaffRole[]> = {
  "/": ["super_admin", "management", "sales", "finance", "operations"],
  "/bookings": ["super_admin", "management", "sales", "operations"],
  "/trips": ["super_admin", "management", "sales", "operations"],
  "/packages": ["super_admin", "management", "sales", "operations"],
  "/customers": ["super_admin", "management", "sales"],
  "/leads": ["super_admin", "management", "sales"],
  "/followups": ["super_admin", "management", "sales"],
  "/lead-import": ["super_admin", "management", "sales"],
  "/lead-management": ["super_admin", "management", "sales"],
  "/mesin-follow-up": ["super_admin", "management", "sales"],
  "/akses-kepemilikan": ["super_admin", "management", "sales"],
  "/leaderboard": ["super_admin", "management", "sales"],
  "/whatsapp-templates": ["super_admin", "management", "sales"],
  "/admin-console": ["super_admin", "management"],
  "/billing": ["super_admin", "management", "finance"],
  "/reports": ["super_admin", "management"],
  "/website": ["super_admin", "management"],
  "/ai-tokens": ["super_admin", "management"],
  "/ai-assistant": ["super_admin", "management"],
  "/mcp-audit": ["super_admin", "management"],
  "/staff": ["super_admin"],
  "/staff-audit": ["super_admin", "management"],
  "/company-profile": ["super_admin", "management"],
  "/bank-accounts": ["super_admin", "finance"],
  "/document-numbering": ["super_admin", "management"],
  "/booking-defaults": ["super_admin", "management", "sales", "operations"],
  "/notification-templates": ["super_admin", "management"],
  "/api-tokens": ["super_admin"],
  "/data-maintenance": ["super_admin"],
  "/settings-audit": ["super_admin"],
  "/settings": ["super_admin"],
};

const ALL_ROLES: StaffRole[] = [
  "super_admin",
  "management",
  "sales",
  "finance",
  "operations",
];

/** True when `role` may access `path`. Unknown paths default to all roles. */
export function canAccess(path: string, role: StaffRole | undefined): boolean {
  if (!role) return false;
  const allowed = ROUTE_ROLES[path];
  if (!allowed) return true;
  const fallback = allowed === ALL_ROLES || allowed.includes(role);
  // Honour the admin-configured matrix when it has been loaded.
  return canAccessWithMatrix(path, role, fallback);
}

export function allowedRolesLabel(path: string): StaffRole[] {
  return ROUTE_ROLES[path] ?? ALL_ROLES;
}

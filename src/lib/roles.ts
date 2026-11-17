import type { StaffRole } from "@/lib/auth";

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
  "/billing": ["super_admin", "management", "finance"],
  "/reports": ["super_admin", "management"],
  "/website": ["super_admin", "management"],
  "/ai-tokens": ["super_admin", "management"],
  "/mcp-audit": ["super_admin", "management"],
  "/staff": ["super_admin"],
  "/staff-audit": ["super_admin", "management"],
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
  return allowed === ALL_ROLES || allowed.includes(role);
}

export function allowedRolesLabel(path: string): StaffRole[] {
  return ROUTE_ROLES[path] ?? ALL_ROLES;
}

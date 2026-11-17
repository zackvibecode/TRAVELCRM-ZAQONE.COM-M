import type { AuthRole } from "./auth";

/**
 * Central permission matrix for the CRM API.
 * Actions are `resource:action` strings mirroring the MCP scope convention.
 * The server-side guards call `canPerform(role, action)` before any mutating
 * or sensitive read, keeping enforcement in one auditable place.
 */

export type PermissionAction =
  | "bookings:read"
  | "bookings:write"
  | "bookings:cancel"
  | "trips:read"
  | "trips:write"
  | "packages:read"
  | "packages:write"
  | "customers:read"
  | "customers:write"
  | "leads:read"
  | "leads:write"
  | "invoices:read"
  | "invoices:write"
  | "payments:write"
  | "refunds:write"
  | "reports:read"
  | "reports:export"
  | "alerts:read"
  | "website:read"
  | "website:write"
  | "mcp:manage"
  | "staff:manage"
  | "settings:read"
  | "settings:write";

const ALL: AuthRole[] = [
  "super_admin",
  "management",
  "sales",
  "finance",
  "operations",
];

export const PERMISSIONS: Record<PermissionAction, AuthRole[]> = {
  // Bookings
  "bookings:read": ALL,
  "bookings:write": ["super_admin", "management", "sales", "operations"],
  "bookings:cancel": ["super_admin", "management"],

  // Trips & seats
  "trips:read": ALL,
  "trips:write": ["super_admin", "management", "operations"],

  // Packages
  "packages:read": ALL,
  "packages:write": ["super_admin", "management", "operations"],

  // Customers & leads
  "customers:read": ["super_admin", "management", "sales"],
  "customers:write": ["super_admin", "management", "sales"],
  "leads:read": ["super_admin", "management", "sales"],
  "leads:write": ["super_admin", "management", "sales"],

  // Finance
  "invoices:read": ["super_admin", "management", "finance"],
  "invoices:write": ["super_admin", "management", "finance"],
  "payments:write": ["super_admin", "finance"],
  "refunds:write": ["super_admin", "management", "finance"],

  // Reports & alerts
  "reports:read": ["super_admin", "management", "finance"],
  "reports:export": ["super_admin", "management", "finance"],
  "alerts:read": ALL,

  // Website CMS
  "website:read": ["super_admin", "management", "sales", "operations"],
  "website:write": ["super_admin", "management"],

  // System
  "mcp:manage": ["super_admin", "management"],
  "staff:manage": ["super_admin"],
  "settings:read": ["super_admin", "management"],
  "settings:write": ["super_admin"],
};

/** True when `role` may perform `action`. */
export function canPerform(
  role: AuthRole | undefined,
  action: PermissionAction,
): boolean {
  if (!role) return false;
  return PERMISSIONS[action]?.includes(role) ?? false;
}

export function permissionsFor(role: AuthRole): PermissionAction[] {
  return (Object.keys(PERMISSIONS) as PermissionAction[]).filter((a) =>
    PERMISSIONS[a].includes(role),
  );
}

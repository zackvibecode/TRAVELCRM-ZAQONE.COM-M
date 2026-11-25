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

/**
 * The Staff Access "Role Permission Matrix" shape as stored in app_settings
 * under the key `permissions`: `{ [role]: { [moduleId]: boolean } }`.
 * Modules mirror the coarse CRM modules (bookings, packages, trips, ...).
 */
export type PermissionMatrix = Record<
  string,
  Record<string, boolean> | undefined
>;

/** Map a module id from the permission matrix onto its fine-grained action. */
const MODULE_WRITE_ACTION: Record<string, PermissionAction> = {
  bookings: "bookings:write",
  customers: "customers:write",
  billing: "invoices:write",
  packages: "packages:write",
  trips: "trips:write",
  website: "website:write",
  staff: "staff:manage",
  mcp: "mcp:manage",
};

const MODULE_READ_ACTION: Record<string, PermissionAction> = {
  bookings: "bookings:read",
  customers: "customers:read",
  billing: "invoices:read",
  packages: "packages:read",
  trips: "trips:read",
  website: "website:read",
  staff: "staff:manage",
  mcp: "mcp:manage",
};

/**
 * Resolve whether `role` may perform `action`, preferring the admin-configured
 * matrix (from app_settings) and falling back to the hardcoded PERMISSIONS.
 *
 * The matrix only carries coarse module booleans, so we map an action to the
 * module that owns it and treat that module's boolean as the source of truth.
 * If the matrix has no entry for the owning module, we fall back to the static
 * PERMISSIONS map so behaviour never breaks when a module is unconfigured.
 */
export function canPerformWithMatrix(
  role: AuthRole | undefined,
  action: PermissionAction,
  matrix: PermissionMatrix | null | undefined,
): boolean {
  if (!role) return false;

  // super_admin always passes (defence in depth — matrix can't lock them out).
  if (role === "super_admin") return true;

  if (matrix && typeof matrix === "object") {
    const row = matrix[role];
    if (row && typeof row === "object") {
      // Prefer the write module first, then the read module.
      for (const map of [MODULE_WRITE_ACTION, MODULE_READ_ACTION]) {
        for (const [moduleId, mappedAction] of Object.entries(map)) {
          if (mappedAction === action && typeof row[moduleId] === "boolean") {
            return row[moduleId] as boolean;
          }
        }
      }
    }
  }

  // Fall back to the static matrix.
  return canPerform(role, action);
}

export function permissionsFor(role: AuthRole): PermissionAction[] {
  return (Object.keys(PERMISSIONS) as PermissionAction[]).filter((a) =>
    PERMISSIONS[a].includes(role),
  );
}

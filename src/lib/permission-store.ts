import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { StaffRole } from "@/lib/auth";

/**
 * Frontend mirror of the admin-configured Role Permission Matrix stored in
 * app_settings under the key `permissions` (shape: `{ [role]: { [module]: bool } }`).
 *
 * The sidebar and route guards read this store so the checkbox matrix in Staff
 * Access actually controls what each role can open, instead of the hardcoded
 * ROUTE_ROLES map drifting from the saved matrix.
 */

export type PermissionMatrix = Record<
  string,
  Record<string, boolean> | undefined
>;

/** Route path -> coarse module id (must match the Staff Access MODULES ids). */
const ROUTE_TO_MODULE: Record<string, string> = {
  "/": "bookings",
  "/bookings": "bookings",
  "/trips": "trips",
  "/packages": "packages",
  "/customers": "customers",
  "/leads": "followup",
  "/followups": "followup",
  "/lead-import": "followup",
  "/lead-management": "followup",
  "/mesin-follow-up": "followup",
  "/akses-kepemilikan": "followup",
  "/leaderboard": "followup",
  "/whatsapp-templates": "followup",
  "/admin-console": "staff",
  "/billing": "billing",
  "/reports": "billing",
  "/website": "website",
  "/website/editor": "website",
  "/ai-tokens": "mcp",
  "/mcp-audit": "mcp",
  "/ai-assistant": "mcp",
  "/staff": "staff",
  "/staff-audit": "staff",
  "/company-profile": "staff",
  "/bank-accounts": "billing",
  "/document-numbering": "staff",
  "/booking-defaults": "bookings",
  "/notification-templates": "staff",
  "/api-tokens": "mcp",
  "/data-maintenance": "staff",
  "/settings-audit": "staff",
  "/settings": "staff",
};

/**
 * Roles that may always open the Staff Access / system pages regardless of the
 * matrix (super_admin manages staff; management can view but the matrix may
 * still gate write actions server-side).
 */
const SYSTEM_ALWAYS_ALLOWED: StaffRole[] = ["super_admin"];

let cachedMatrix: PermissionMatrix | null = null;
let cacheLoaded = false;
let loadPromise: Promise<PermissionMatrix | null> | null = null;

/** Fetch the matrix once; subsequent calls reuse the in-flight promise. */
function loadMatrix(): Promise<PermissionMatrix | null> {
  if (loadPromise) return loadPromise;
  loadPromise = apiFetch<{ settings?: Record<string, unknown> }>("/settings")
    .then((res) => {
      const stored = res.settings?.permissions as PermissionMatrix | undefined;
      cachedMatrix = stored && typeof stored === "object" ? stored : null;
      cacheLoaded = true;
      return cachedMatrix;
    })
    .catch(() => {
      cachedMatrix = null;
      cacheLoaded = true;
      return null;
    });
  return loadPromise;
}

/** Synchronous accessor used by sidebar/route guards (falls back safely). */
export function getPermissionMatrix(): PermissionMatrix | null {
  return cachedMatrix;
}

export function isPermissionMatrixLoaded(): boolean {
  return cacheLoaded;
}

/**
 * Whether `role` may open `path`, honouring the admin matrix when loaded and
 * falling back to the caller-provided hardcoded decision otherwise.
 */
export function canAccessWithMatrix(
  path: string,
  role: StaffRole | undefined,
  fallback: boolean,
): boolean {
  if (!role) return false;
  if (SYSTEM_ALWAYS_ALLOWED.includes(role)) return true;

  const moduleId = ROUTE_TO_MODULE[path];
  if (!moduleId) return fallback;

  const matrix = cachedMatrix;
  if (!matrix) return fallback;

  const row = matrix[role];
  if (!row || typeof row !== "object") return fallback;

  const allowed = row[moduleId];
  return typeof allowed === "boolean" ? allowed : fallback;
}

/**
 * React hook: loads the matrix (once) and re-renders subscribers when ready.
 * Returns the matrix and a ready flag. Use this in components that must react
 * to the matrix (e.g. AppShell sidebar) so items appear/disappear correctly.
 */
export function usePermissionMatrix(): {
  matrix: PermissionMatrix | null;
  loaded: boolean;
} {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(cachedMatrix);
  const [loaded, setLoaded] = useState(cacheLoaded);

  useEffect(() => {
    let active = true;
    loadMatrix().then((m) => {
      if (!active) return;
      setMatrix(m);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  return { matrix, loaded };
}

/** Re-fetch the matrix (call after saving in Staff Access). */
export function refreshPermissionMatrix(): Promise<PermissionMatrix | null> {
  loadPromise = null;
  return loadMatrix();
}

/**
 * Whether `role` may write to a coarse module (e.g. "packages"), honouring the
 * admin matrix when loaded and falling back to the static allowlist otherwise.
 */
const MODULE_WRITE_FALLBACK: Record<string, StaffRole[]> = {
  bookings: ["super_admin", "management", "sales", "operations"],
  customers: ["super_admin", "management", "sales"],
  billing: ["super_admin", "management", "finance"],
  packages: ["super_admin", "management", "operations"],
  trips: ["super_admin", "management", "operations"],
  website: ["super_admin", "management"],
  staff: ["super_admin"],
  mcp: ["super_admin", "management"],
};

export function canWriteModule(
  moduleId: string,
  role: StaffRole | undefined,
): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;

  const matrix = cachedMatrix;
  if (matrix) {
    const row = matrix[role];
    if (row && typeof row === "object" && typeof row[moduleId] === "boolean") {
      return row[moduleId] as boolean;
    }
  }

  return (MODULE_WRITE_FALLBACK[moduleId] ?? []).includes(role);
}

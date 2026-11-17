import type { Context, MiddlewareHandler, Next } from "hono";
import { getAuth } from "../lib/auth-context";
import type { AuthEnv, StaffIdentity } from "../lib/auth-context";
import { canPerform, type PermissionAction } from "../lib/permissions";

export type Role =
  | "super_admin"
  | "management"
  | "sales"
  | "finance"
  | "operations";

export const ROLES: Role[] = [
  "super_admin",
  "management",
  "sales",
  "finance",
  "operations",
];

/**
 * Resolve the Better Auth session from the request cookies and attach the
 * staff identity (with role/status) to `c.var.staff`.
 * Falls back to the legacy `x-user-role` header only when no session exists,
 * so existing Phase-3 clients keep working during the auth migration.
 */
export async function requireStaffSession(c: Context<AuthEnv>, next: Next) {
  const auth = getAuth(c);
  // The bearer plugin (see server/lib/auth.ts) converts a mobile client's
  // `Authorization: Bearer <token>` header into a session cookie before the
  // getSession endpoint runs, so session resolution works even when mobile
  // browsers block the third-party session cookie.
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json({ error: "unauthorized", message: "Sign-in required" }, 401);
  }

  const user = session.user as unknown as {
    id: string;
    name: string;
    email: string;
    role?: string;
    status?: string;
  };

  if (user.status && user.status !== "active") {
    return c.json({ error: "forbidden", message: "Account suspended" }, 403);
  }

  const staff: StaffIdentity = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user.role ?? "sales") as StaffIdentity["role"],
    sessionId: session.session.id,
  };
  c.set("staff", staff);
  c.set("userRole", staff.role);
  await next();
}

/**
 * Role-based authorisation middleware. Resolves the role from the Better Auth
 * session when present, otherwise from the legacy `x-user-role` header
 * (Phase-3 mock flow, kept until the frontend switches to real sessions).
 */
export function requireRole(...allowed: Role[]): MiddlewareHandler {
  return async (c, next) => {
    // Try the authenticated session first.
    try {
      const auth = getAuth(c as unknown as Context<AuthEnv>);
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (session?.user) {
        const user = session.user as unknown as {
          id: string;
          name: string;
          email: string;
          role?: string;
          status?: string;
        };
        if (user.status && user.status !== "active") {
          return c.json({ success: false, error: "Account suspended" }, 403);
        }
        const role = (user.role ?? "sales") as Role;
        if (role === "super_admin" || allowed.includes(role)) {
          (c as unknown as Context<AuthEnv>).set("userRole", role);
          (c as unknown as Context<AuthEnv>).set("staff", {
            id: user.id,
            name: user.name,
            email: user.email,
            role,
            sessionId: session.session.id,
          });
          await next();
          return;
        }
        return c.json(
          { success: false, error: "Forbidden", required: allowed },
          403,
        );
      }
    } catch {
      // Session resolution failed; fall through to the legacy header.
    }

    // Legacy mock flow: x-user-role header.
    const role = c.req.header("x-user-role") as Role | undefined;

    if (!role || !ROLES.includes(role)) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    // super_admin has full access.
    if (role === "super_admin" || allowed.includes(role)) {
      c.set("userRole", role);
      await next();
      return;
    }

    return c.json(
      { success: false, error: "Forbidden", required: allowed },
      403,
    );
  };
}

/**
 * Fine-grained permission enforcement (after requireStaffSession/requireRole).
 * Checks the central PERMISSIONS matrix for `resource:action`.
 */
export function requirePermission(action: PermissionAction): MiddlewareHandler {
  return async (c, next) => {
    const staff = (c as unknown as Context<AuthEnv>).get("staff") as
      | StaffIdentity
      | undefined;
    const role =
      staff?.role ??
      ((c.get("userRole") as Role | undefined) ?? undefined);

    if (!role) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (!canPerform(role, action)) {
      return c.json(
        {
          error: "forbidden",
          message: `Role '${role}' lacks permission '${action}'`,
        },
        403,
      );
    }
    await next();
  };
}

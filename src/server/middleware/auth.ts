import type { Context, MiddlewareHandler } from "hono";

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
 * Authorization is enforced via a `x-user-role` header for now. This will be
 * replaced by a verified session (Better Auth) in the authentication phase.
 * Until then, absence of a valid role returns 401; a present-but-insufficient
 * role returns 403.
 */
export function requireRole(...allowed: Role[]): MiddlewareHandler {
  return async (c: Context, next) => {
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

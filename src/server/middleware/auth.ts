import type { Context, Next } from "hono";
import { getAuth } from "./auth-context";
import type { StaffIdentity } from "./auth-context";

type AuthEnv = {
  Bindings: {
    DB: D1Database;
    DOCUMENTS: R2Bucket;
    BETTER_AUTH_SECRET?: string;
  };
};

/**
 * Hono middleware: resolve the Better Auth session from the request cookies.
 * On success, attaches the staff identity (with role/status) to `c.var.staff`.
 */
export async function requireStaffSession(c: Context<AuthEnv>, next: Next) {
  const auth = getAuth(c);
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
  await next();
}

/** Role-based authorisation middleware, used after requireStaffSession. */
export function requireRoles(...roles: StaffIdentity["role"][]) {
  return async (c: Context<AuthEnv>, next: Next) => {
    const staff = c.get("staff") as StaffIdentity | undefined;
    if (!staff) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (!roles.includes(staff.role)) {
      return c.json(
        { error: "forbidden", message: "Insufficient role" },
        403,
      );
    }
    await next();
  };
}

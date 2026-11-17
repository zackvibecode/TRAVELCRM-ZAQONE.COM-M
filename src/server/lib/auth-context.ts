import type { Context } from "hono";
import { createAuth, type Auth, type Env } from "./auth";

export interface StaffIdentity {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "management" | "sales" | "finance" | "operations";
  sessionId: string;
}

type AuthEnv = {
  Bindings: Env;
  Variables: {
    staff: StaffIdentity;
    auth: Auth;
    userRole: StaffIdentity["role"];
    db: import("drizzle-orm/d1").DrizzleD1Database<
      typeof import("../db/schema")
    >;
  };
};

/** Resolve (or lazily create) the per-request Better Auth instance. */
export function getAuth(c: Context<AuthEnv>): Auth {
  let auth = c.get("auth");
  if (!auth) {
    auth = createAuth(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c as any).get("db"),
      c.env,
    );
    c.set("auth", auth);
  }
  return auth;
}

export type { AuthEnv };

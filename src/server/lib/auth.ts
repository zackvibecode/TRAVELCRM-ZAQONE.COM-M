import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export type AuthRole =
  | "super_admin"
  | "management"
  | "sales"
  | "finance"
  | "operations";

export type Env = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  BETTER_AUTH_SECRET?: string;
};

/**
 * Create a Better Auth instance bound to a per-request Drizzle/D1 client.
 * Called from the Hono handler so every request gets `c.env.DB`.
 */
export function createAuth(db: DrizzleD1Database<typeof schema>, env: Env) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production",
    basePath: "/auth",
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      // Password reset uses the verification table; delivery is logged for
      // now (no mail provider configured in this environment).
      sendResetPassword: async ({ user, url }) => {
        console.log(
          `[auth] password reset requested for ${user.email}: ${url}`,
        );
      },
      requireEmailVerification: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh session daily
    },
    advanced: {
      // Cross-subdomain cookies so the Pages frontend can hold the session
      // against the workers.dev API domain (SameSite=None + Secure).
      cookiePrefix: "zaqone",
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
        path: "/",
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "sales",
          input: false, // set via admin API only, never self-service
        },
        status: {
          type: "string",
          required: true,
          defaultValue: "active",
          input: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

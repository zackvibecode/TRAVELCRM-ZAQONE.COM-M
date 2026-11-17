import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";

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
    database: drizzleAdapter(db, {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // refresh session daily
    },
    advanced: {
      // Workers: no Node crypto reliance issues; use default Web Crypto.
      cookiePrefix: "zaqone",
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

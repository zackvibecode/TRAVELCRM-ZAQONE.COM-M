import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
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
    // Better Auth validates the request Origin for cookie/CSRF security.
    // Without this, credentialed requests from the Pages frontend are 403'd
    // (curl works because it sends no Origin header).
    trustedOrigins: [
      "https://travelcrm.zaqone.com",
      "https://travelos-suite-web.pages.dev",
      "https://*.travelos-suite-web.pages.dev",
      "https://travelos-suite-api.zarulzaqwan1234.workers.dev",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "http://127.0.0.1:5173",
    ],
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
      // 30 days with daily refresh: as long as the user opens the app at
      // least once a day (typical for the installed mobile/PWA app), the
      // session slides forward and sign-in is effectively "stay logged in".
      expiresIn: 60 * 60 * 24 * 30, // 30 days
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
    // Mobile browsers (iOS Safari/ITP) block the cross-origin third-party
    // session cookie. The bearer plugin lets those clients send the session
    // token via `Authorization: Bearer <token>` instead: it rewrites the
    // header into a signed session cookie before routing, and exposes the
    // token via the `set-auth-token` response header on sign-in responses.
    // Note: the plugin hook only runs inside auth.handler (/auth/*); the
    // CRM data routes below resolve sessions via requireStaffSession, which
    // performs the same bearer->cookie rewrite itself (see middleware/auth).
    plugins: [bearer()],
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
          defaultValue: "pending",
          input: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

import { createAuthClient } from "better-auth/react";

export type StaffRole =
  | "super_admin"
  | "management"
  | "sales"
  | "finance"
  | "operations";

export interface StaffSession {
  userId: string;
  name: string;
  email: string;
  role: StaffRole;
}

/**
 * Backend API base URL. The Worker serves Better Auth under /auth.
 * In local dev the Vite dev server can proxy /auth to the Worker; in
 * production the frontend is served from Pages and talks to the Worker
 * domain directly.
 */
export const API_BASE_URL =
  ((import.meta as { env?: Record<string, string> }).env?.VITE_API_URL) ??
  "https://travelos-suite-api.zarulzaqwan1234.workers.dev";

/**
 * Real Better Auth client backed by the Cloudflare Worker.
 * Replaces the previous mock accounts while keeping the same exported
 * helpers used by the UI (getSession / logout).
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  // The Worker mounts Better Auth under /auth (see src/server/index.ts).
  // Without this the client calls /api/auth/* by default and gets a 404,
  // which the UI misreports as "invalid email or password".
  basePath: "/auth",
});

const SESSION_KEY = "zaqone_staff_session";

/** Cache the last-known session so getSession() stays synchronous. */
function cacheSession(session: StaffSession | null): void {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // storage unavailable — ignore
  }
}

function readCachedSession(): StaffSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StaffSession) : null;
  } catch {
    return null;
  }
}

/** Map a Better Auth user payload onto the UI's StaffSession shape. */
function toStaffSession(user: {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}): StaffSession | null {
  if (!user?.id) return null;
  return {
    userId: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    role: (user.role as StaffRole) ?? "sales",
  };
}

/**
 * Fetch the authoritative session from the server.
 * Returns null when signed out; updates the local cache either way.
 */
export async function fetchSession(): Promise<StaffSession | null> {
  try {
    const res = await authClient.getSession();
    const user = (res.data?.user ?? null) as Parameters<typeof toStaffSession>[0] | null;
    const session = user ? toStaffSession(user) : null;
    cacheSession(session);
    return session;
  } catch {
    cacheSession(null);
    return null;
  }
}

/**
 * Synchronous cached session — same contract as the old mock helper.
 * Use fetchSession() for the authoritative server check (e.g. route guards).
 */
export function getSession(): StaffSession | null {
  return readCachedSession();
}

/** Sign in with email + password through Better Auth. */
export async function login(
  email: string,
  password: string,
): Promise<{ ok: boolean; session: StaffSession | null; error?: string }> {
  try {
    const res = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    });
    if (res.error) {
      return {
        ok: false,
        session: null,
        error: res.error.message ?? "Invalid email or password",
      };
    }
    const session = res.data?.user
      ? toStaffSession(res.data.user as Parameters<typeof toStaffSession>[0])
      : null;
    cacheSession(session);
    return { ok: session !== null, session };
  } catch (err) {
    return {
      ok: false,
      session: null,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/** Sign out server-side and clear the local cache. */
export async function logout(): Promise<void> {
  try {
    await authClient.signOut();
  } catch {
    // best-effort — clear local state regardless
  }
  cacheSession(null);
}

/** Request a password-reset email through Better Auth. */
export async function requestPasswordReset(email: string): Promise<void> {
  await authClient.$fetch("/forget-password", {
    method: "POST",
    body: { email: email.trim().toLowerCase() },
  });
}

/** Complete a password reset with the token from the email link. */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  await authClient.resetPassword({ newPassword, token });
}

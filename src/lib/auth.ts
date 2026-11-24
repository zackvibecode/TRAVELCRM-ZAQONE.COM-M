import { createAuthClient } from "better-auth/react";
import type { ClientFetchOption } from "@better-auth/core";

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
  "";

/**
 * Mobile browsers (iOS Safari / ITP) block the cross-origin third-party
 * session cookie, so cookie-only sessions silently fail on phones. The
 * Better Auth bearer plugin solves this: the sign-in response carries the
 * session token in the `set-auth-token` header; we persist it here and send
 * it back as `Authorization: Bearer <token>` on every request. The server
 * converts the header into a session cookie before routing, so both the
 * cookie path (laptop) and the bearer path (mobile) work.
 */
const TOKEN_KEY = "zaqone_session_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // storage unavailable — ignore
  }
}

type FetchOptions = ClientFetchOption;

/**
 * Shared fetchOptions: attach the bearer token (if stored) to outgoing
 * requests and capture the `set-auth-token` header from sign-in responses.
 */
const bearerFetchOptions: FetchOptions = {
  onRequest: (context) => {
    const token = getStoredToken();
    if (token) {
      const headers = new Headers(context.headers);
      headers.set("Authorization", `Bearer ${token}`);
      context.headers = headers;
    }
    return context;
  },
  onSuccess: (context) => {
    const token = context.response.headers.get("set-auth-token");
    if (token) {
      storeToken(token);
    }
  },
};

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
  fetchOptions: bearerFetchOptions,
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
    // The shared bearerFetchOptions.onSuccess captures `set-auth-token`.
    const res = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    });
    if ("error" in res && res.error) {
      return {
        ok: false,
        session: null,
        error: res.error.message ?? "Invalid email or password",
      };
    }
    const payload = res as { data?: { user?: Parameters<typeof toStaffSession>[0] } | null };
    const session = payload.data?.user
      ? toStaffSession(payload.data.user)
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
  storeToken(null);
  cacheSession(null);
}

/**
 * Self-service sign up. Creates the account with a "pending" approval status
 * (set server-side) — the user cannot sign in until an admin approves them.
 */
export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    if ("error" in res && res.error) {
      return { ok: false, error: res.error.message ?? "Unable to create account" };
    }
    // Do NOT auto sign in or cache a session — the account is pending approval.
    storeToken(null);
    cacheSession(null);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
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

/** Verify a Turnstile token server-side before allowing login/signup. */
export async function verifyTurnstile(
  token: string,
  action: "login" | "signup",
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/turnstile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

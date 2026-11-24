import { authClient, API_BASE_URL, getStoredToken } from "@/lib/auth";

/**
 * Thin API client for the Hono Worker. Cookies (Better Auth session) are
 * sent automatically via credentials: "include" — the Worker's CORS policy
 * allows the Pages origin. On mobile browsers that block the third-party
 * cookie, the stored bearer token is attached via the Authorization header
 * instead (the server's bearer plugin converts it into a session).
 */
/**
 * Paths that are NOT data routes and must stay outside the /api prefix:
 * /auth (Better Auth), /public (anonymous website branding/enquiry), /mcp
 * (external MCP clients). Everything else is a Worker data route, which is
 * mounted under /api/* so it can never collide with a React Router page
 * path (e.g. the CRM page /api-tokens).
 */
const UNPREFIXED = ["/auth", "/api/", "/public", "/mcp"];

function withApiPrefix(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (UNPREFIXED.some((p) => normalized.startsWith(p))) return normalized;
  return `/api${normalized}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${withApiPrefix(path)}`;

  const headers = new Headers(options.headers);
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const token = getStoredToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      detail = j.error || j.message || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  return (await res.json()) as T;
}

/** Alias so callers can use the established Better Auth base client too. */
export { authClient };

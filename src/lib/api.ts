import { authClient, API_BASE_URL } from "@/lib/auth";

/**
 * Thin API client for the Hono Worker. Cookies (Better Auth session) are
 * sent automatically via credentials: "include" — the Worker's CORS policy
 * allows the Pages origin.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
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

/**
 * ZAQONE Travel CRM service worker.
 *
 * Strategy:
 * - App shell (same-origin GET, not /api//auth): cache-first with background
 *   refresh (stale-while-revalidate) so the installed app opens instantly.
 * - API/auth/MCP: network-only — CRM data must always be fresh; offline
 *   simply shows the browser/app error state.
 * - Never cache non-GET or cross-origin requests.
 */
const CACHE = "zaqone-crm-v1";
const SHELL_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

const BYPASS = ["/api/", "/auth", "/mcp", "/public"];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (BYPASS.some((p) => url.pathname.startsWith(p))) return;

  // stale-while-revalidate for the app shell
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    }),
  );
});

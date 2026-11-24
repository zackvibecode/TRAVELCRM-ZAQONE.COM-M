import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The Cloudflare Worker (src/server/index.ts) is the single backend that
// serves both the Better Auth endpoints (/auth, /api/auth) and every CRM
// data route (/bookings, /invoices, /api/followup, …). In production the
// SPA and the Worker share one origin, so the client talks to "" (same
// origin). In local dev the two run on different ports — Vite on 5173 and
// Wrangler on 8787 — so we proxy every backend namespace to the Worker.
const WORKER_ORIGIN = "http://127.0.0.1:8787";

// Backend namespaces mounted on the Worker (see src/server/index.ts).
// Every CRM data route lives under /api/* so a page path such as
// /api-tokens, /bookings or /settings can never be shadowed by the proxy —
// previously those returned the Worker's JSON instead of the React app on a
// hard reload. Only genuinely non-/api endpoints are listed here.
const API_PATHS = [
  "/api",
  "/auth",
  "/public",
  "/branding",
  "/mcp",
  "/health",
];

const proxy = Object.fromEntries(
  API_PATHS.map((p) => [
    // Vite matches string keys by PREFIX, so a plain "/api" key would also
    // swallow the CRM page /api-tokens and send it to the Worker (which then
    // falls back to the stale SPA shell). A key starting with "^" is treated
    // as a RegExp by Vite, so anchor it to "/api" and "/api/…" only.
    // (Object keys must be strings — a real RegExp would be stringified.)
    p === "/api" ? "^/api($|/)" : p,
    {
      target: WORKER_ORIGIN,
      changeOrigin: true,
      // Preserve the session cookie across the proxy boundary. Without
      // this, Better Auth's Set-Cookie (SameSite=None; Secure) is dropped
      // by the browser on the http:// localhost origin.
      cookieDomainRewrite: "localhost",
    },
  ]),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy,
  },
});

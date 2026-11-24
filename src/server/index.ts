import { Hono } from "hono";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import bookingsRouter from "./routes/bookings";
import passengersRouter from "./routes/passengers";
import departuresRouter from "./routes/departures";
import checklistRouter from "./routes/checklist";
import documentsRouter from "./routes/documents";
import suppliersRouter from "./routes/suppliers";
import packagesRouter from "./routes/packages";
import leadsRouter from "./routes/leads";
import followupRouter from "./routes/followup";
import whatsappTemplatesRouter from "./routes/whatsapp-templates";
import followupAdminRouter from "./routes/followup-admin";
import customersRouter from "./routes/customers";
import leadSourcesRouter from "./routes/lead-sources";
import quotationsRouter from "./routes/quotations";
import invoicesRouter from "./routes/invoices";
import paymentsRouter from "./routes/payments";
import refundsRouter from "./routes/refunds";
import paymentRemindersRouter from "./routes/payment-reminders";
import dashboardRouter from "./routes/dashboard";
import reportsRouter from "./routes/reports";
import alertsRouter from "./routes/alerts";
import websiteRouter from "./routes/website";
import mcpAdminRouter from "./routes/mcp-admin";
import mcpRouter from "./routes/mcp";
import authRouter, { apiAuthRouter } from "./routes/auth";
import staffRouter from "./routes/staff";
import staffAuditRouter from "./routes/staff-audit";
import settingsRouter from "./routes/settings";
import templatesRouter from "./routes/notification-templates";
import apiTokensRouter from "./routes/api-tokens";
import maintenanceRouter from "./routes/data-maintenance";
import bootstrapRouter from "./routes/bootstrap";
import publicEnquiryRouter from "./routes/public-enquiry";
import aiRouter from "./routes/ai";
import turnstileRouter from "./routes/turnstile";
import { releaseExpiredHolds } from "./lib/seat-availability";
import { runScheduledContent } from "./lib/scheduled-content";
import { runAutoPause } from "./lib/followup-auto-pause";
import { cors } from "hono/cors";

export type Env = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  ASSETS?: Fetcher;
  BETTER_AUTH_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_HOSTNAMES?: string;
};

type AppEnv = {
  Bindings: Env;
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    auth: import("./lib/auth").Auth;
    staff: import("./lib/auth-context").StaffIdentity;
  };
};

const app = new Hono<AppEnv>();

// Allow the Pages frontend (and local dev) to call this Worker, including
// credentialed Better Auth requests (cookies must be sent & accepted).
// `set-auth-token` is exposed so mobile clients (cookie-blocked) can read
// the bearer session token from sign-in responses (bearer plugin).
const ALLOWED_ORIGINS = new Set([
  "https://travelcrm.zaqone.com",
  "https://travelos-suite-web.pages.dev",
]);
function isAllowedOrigin(origin: string): boolean {
  return (
    ALLOWED_ORIGINS.has(origin) ||
    // Per-deployment preview URLs of the Pages project.
    /^https:\/\/[a-z0-9]+\.travelos-suite-web\.pages\.dev$/.test(origin) ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}
app.use(
  "*",
  cors({
    origin: (origin) => (origin && isAllowedOrigin(origin) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["set-auth-token"],
    credentials: true,
  }),
);

// Attach a Drizzle client to every request.
app.use("*", async (c, next) => {
  const db = drizzle(c.env.DB, { schema });
  c.set("db", db);
  await next();
});

app.get("/", (c) => {
  return c.json({
    name: "ZAQONE TRAVEL CRM API",
    status: "ok",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/auth", authRouter);
// Compatibility alias: the Better Auth JS client calls /api/auth/* by
// default. Rewrite the path to /auth/* before the Better Auth handler.
app.route("/api/auth", apiAuthRouter);
app.route("/api/bootstrap", bootstrapRouter);
app.route("/public", publicEnquiryRouter);
app.route("/api/turnstile", turnstileRouter);
app.route("/api/staff", staffRouter);
app.route("/api/staff-audit", staffAuditRouter);
app.route("/api/settings", settingsRouter);
app.route("/api/notification-templates", templatesRouter);
app.route("/api/api-tokens", apiTokensRouter);
app.route("/api/data-maintenance", maintenanceRouter);

// Public branding assets (company logo) served from R2, cacheable.
app.get("/branding/*", async (c) => {
  const key = c.req.path.replace(/^\/branding\//, "");
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    return c.json({ error: "invalid key" }, 400);
  }
  const obj = await c.env.DOCUMENTS.get(`branding/${key}`);
  if (!obj) {
    return c.json({ error: "not found" }, 404);
  }
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(obj.body, { headers });
});
// Data routes live under /api/* so they can never collide with a React
// Router page path (e.g. the CRM page /api-tokens vs the old API
// /api-tokens). Only /auth (Better Auth), /public (anonymous website
// branding), /mcp (external MCP clients) and /branding/* stay outside.
app.route("/api/bookings", bookingsRouter);
app.route("/api", passengersRouter);
app.route("/api/departures", departuresRouter);
app.route("/api", checklistRouter);
app.route("/api", documentsRouter);
app.route("/api", suppliersRouter);
app.route("/api", packagesRouter);
app.route("/api/leads", leadsRouter);
app.route("/api/followup", followupRouter);
app.route("/api/followup/templates", whatsappTemplatesRouter);
app.route("/api/followup/admin", followupAdminRouter);
app.route("/api/customers", customersRouter);
app.route("/api/lead-sources", leadSourcesRouter);
app.route("/api/quotations", quotationsRouter);
app.route("/api/invoices", invoicesRouter);
app.route("/api/payments", paymentsRouter);
app.route("/api/refunds", refundsRouter);
app.route("/api/payment-reminders", paymentRemindersRouter);
app.route("/api/dashboard", dashboardRouter);
app.route("/api/reports", reportsRouter);
app.route("/api/alerts", alertsRouter);
app.route("/api/website", websiteRouter);
app.route("/api/mcp-admin", mcpAdminRouter);
app.route("/mcp", mcpRouter);
app.route("/api/ai", aiRouter);

// SPA fallback: serve the React frontend for any path not matched by an
// API route or a static asset. Assets binding handles hashed files; this
// catch-all returns index.html so client-side routes (e.g. /login) work.
app.get("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json({ error: "not found" }, 404);
});

export default app;

// Scheduled job: release expired seat holds (run by Cloudflare cron).
export async function scheduled(
  _event: ScheduledEvent,
  env: Env,
  _ctx: ExecutionContext,
): Promise<void> {
  const db = drizzle(env.DB, { schema });
  const released = await releaseExpiredHolds(db);
  console.log(`[seat-holds] released ${released} expired hold(s)`);

  const content = await runScheduledContent(db);
  console.log(
    `[scheduled-content] ${content.bannersActivated} banner(s) activated, ` +
      `${content.bannersDeactivated} deactivated, ${content.pagesPublished} page(s) published`,
  );

  // Follow-up engine: auto-pause leads that have been abandoned.
  const autoPause = await runAutoPause(db);
  console.log(
    `[followup-auto-pause] scanned ${autoPause.scanned}, paused ${autoPause.paused}`,
  );
}

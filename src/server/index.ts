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
import authRouter from "./routes/auth";
import staffRouter from "./routes/staff";
import staffAuditRouter from "./routes/staff-audit";
import settingsRouter from "./routes/settings";
import { releaseExpiredHolds } from "./lib/seat-availability";
import { runScheduledContent } from "./lib/scheduled-content";

export type Env = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
  BETTER_AUTH_SECRET?: string;
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
app.route("/staff", staffRouter);
app.route("/staff-audit", staffAuditRouter);
app.route("/settings", settingsRouter);

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
app.route("/bookings", bookingsRouter);
app.route("/", passengersRouter);
app.route("/departures", departuresRouter);
app.route("/", checklistRouter);
app.route("/", documentsRouter);
app.route("/", suppliersRouter);
app.route("/", packagesRouter);
app.route("/leads", leadsRouter);
app.route("/customers", customersRouter);
app.route("/lead-sources", leadSourcesRouter);
app.route("/quotations", quotationsRouter);
app.route("/invoices", invoicesRouter);
app.route("/payments", paymentsRouter);
app.route("/refunds", refundsRouter);
app.route("/payment-reminders", paymentRemindersRouter);
app.route("/dashboard", dashboardRouter);
app.route("/reports", reportsRouter);
app.route("/alerts", alertsRouter);
app.route("/website", websiteRouter);
app.route("/mcp-admin", mcpAdminRouter);
app.route("/mcp", mcpRouter);

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
}

import { Hono } from "hono";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import bookingsRouter from "./routes/bookings";
import passengersRouter from "./routes/passengers";
import departuresRouter from "./routes/departures";
import checklistRouter from "./routes/checklist";
import documentsRouter from "./routes/documents";
import suppliersRouter from "./routes/suppliers";
import { releaseExpiredHolds } from "./lib/seat-availability";

export type Env = {
  DB: D1Database;
  DOCUMENTS: R2Bucket;
};

type AppEnv = {
  Bindings: Env;
  Variables: {
    db: DrizzleD1Database<typeof schema>;
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
    name: "TravelOS Suite API",
    status: "ok",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.route("/bookings", bookingsRouter);
app.route("/", passengersRouter);
app.route("/departures", departuresRouter);
app.route("/", checklistRouter);
app.route("/", documentsRouter);
app.route("/", suppliersRouter);

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
}

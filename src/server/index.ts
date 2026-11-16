import { Hono } from "hono";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import bookingsRouter from "./routes/bookings";
import passengersRouter from "./routes/passengers";
import departuresRouter from "./routes/departures";

export type Env = {
  DB: D1Database;
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

export default app;

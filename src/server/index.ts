import { Hono } from "hono";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./db/schema";
import bookingsRouter from "./routes/bookings";

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

// Placeholder: bookings endpoint wired to the schema.
app.get("/bookings", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(schema.bookings).all();
  return c.json({ bookings: rows });
});

app.route("/bookings", bookingsRouter);

export default app;

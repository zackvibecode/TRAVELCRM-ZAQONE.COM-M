import { Hono } from "hono";
import { count, eq } from "drizzle-orm";
import type { AuthEnv } from "../lib/auth-context";
import { getAuth } from "../lib/auth-context";
import * as schema from "../db/schema";

/**
 * One-time bootstrap: creates the first super admin when the user table is
 * empty. After the first admin exists, this endpoint permanently returns 403
 * so it can never be used to add more admins or change passwords.
 */
const bootstrapRouter = new Hono<AuthEnv>();

bootstrapRouter.post("/super-admin", async (c) => {
  const db = c.get("db");

  const [{ value: userCount }] = await db
    .select({ value: count() })
    .from(schema.user);
  if (userCount > 0) {
    return c.json(
      { success: false, error: "Bootstrap already completed" },
      403,
    );
  }

  const body = (await c.req.json()) as {
    name?: string;
    email?: string;
    password?: string;
  };

  const email = body.email?.trim().toLowerCase();
  if (!body.name?.trim() || !email || !body.password || body.password.length < 8) {
    return c.json(
      { success: false, error: "name, email and a password (min 8 chars) are required" },
      400,
    );
  }

  // Create the account through Better Auth so the password is hashed
  // exactly like any other sign-up.
  const auth = getAuth(c);
  const headers = new Headers({ "content-type": "application/json" });
  const request = new Request(
    "http://bootstrap.local/auth/sign-up/email",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: body.name.trim(),
        email,
        password: body.password,
      }),
    },
  );
  const response = await auth.handler(request);
  if (response.status >= 400) {
    const detail = await response.text();
    return c.json(
      { success: false, error: "sign-up failed", detail },
      response.status as 400,
    );
  }

  // Promote to super_admin (sign-up defaults to the "sales" role).
  await db
    .update(schema.user)
    .set({ role: "super_admin", emailVerified: true })
    .where(eq(schema.user.email, email));

  await db.insert(schema.auditLogs).values({
    id: crypto.randomUUID(),
    actor: email,
    role: "super_admin",
    action: "bootstrap.super_admin",
    entityType: "user",
    entityId: email,
    detail: "Initial super admin created via one-time bootstrap",
  });

  return c.json({ success: true, email }, 201);
});

export default bootstrapRouter;

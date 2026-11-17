import { Hono } from "hono";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";

export type PublicEnv = {
  DB: D1Database;
};

type Variables = {
  db: DrizzleD1Database<typeof schema>;
};

const publicRouter = new Hono<{
  Bindings: PublicEnv;
  Variables: Variables;
}>();

/**
 * POST /public/enquiry — public (unauthenticated) endpoint used by the
 * website contact form. Creates a CRM lead in stage "new" with a rate limit
 * per IP to deter spam. No raw code or secrets are exposed.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

publicRouter.post("/enquiry", async (c) => {
  const db = c.get("db");

  let body: {
    name?: string;
    phone?: string;
    email?: string;
    packageName?: string;
    pax?: number;
    departureDate?: string;
    message?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!body.name?.trim() || !body.phone?.trim()) {
    return c.json({ success: false, error: "name and phone are required" }, 400);
  }

  // Very basic per-IP rate limiting (in-memory, per isolate).
  const ip =
    c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return c.json(
      { success: false, error: "Too many requests, try again shortly" },
      429,
    );
  }
  recent.push(now);
  hits.set(ip, recent);

  const leadId = crypto.randomUUID();
  const notes = [
    body.packageName ? `Package: ${body.packageName}` : null,
    body.departureDate ? `Planned date: ${body.departureDate}` : null,
    body.message ? `Message: ${body.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await db
    .insert(schema.leads)
    .values({
      id: leadId,
      name: body.name.trim(),
      phone: body.phone.trim(),
      email: body.email?.trim() || null,
      destination: body.packageName?.trim() || null,
      pax: Number(body.pax) > 0 ? Number(body.pax) : 1,
      budget: 0,
      stage: "new",
      notes: notes || null,
      customerId: null,
    })
    .run();

  await logAudit(db, {
    actor: null,
    role: "public",
    action: "lead.public_enquiry",
    entityType: "lead",
    entityId: leadId,
  });

  return c.json({ success: true, data: { id: leadId } }, 201);
});

export default publicRouter;

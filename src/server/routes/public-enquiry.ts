import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { logAudit } from "../lib/audit";
import { firstFollowupAt } from "../lib/followup-schedule";

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

  // Public enquiries have no session — assign a mandatory owner by
  // falling back to the first super_admin (same rule as the 0027 backfill).
  const [fallbackOwner] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.role, "super_admin"))
    .orderBy(schema.user.id)
    .limit(1)
    .all();

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
      ownerUserId: fallbackOwner?.id ?? "unassigned",
      followupStatus: "new",
      followupState: "active",
      followupStage: "FU1",
      followupStageAt: new Date().toISOString(),
      // FU1 from config, snapped to KL business hours.
      nextFollowupAt: (await firstFollowupAt(db)).toISOString(),
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

/**
 * GET /public/branding — public, unauthenticated. Returns the company
 * profile + site chrome (brand name, contact details, WhatsApp link, theme
 * tokens) that the public website renders. This is what keeps the website
 * and the CRM reading the SAME settings: the CRM writes them under the
 * `company` settings key, and the website reads them here.
 */
publicRouter.get("/branding", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, "company"))
    .limit(1);
  const company = (rows[0]?.value ?? {}) as Record<string, unknown>;

  const siteRows = await db
    .select()
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, "site"))
    .limit(1);
  const site = (siteRows[0]?.value ?? {}) as Record<string, unknown>;

  const str = (v: unknown, fallback = ""): string =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;

  return c.json({
    success: true,
    branding: {
      name: str(company.name, "ZAQONE Travel"),
      brandName: str(company.brandName, str(company.name, "ZAQONE Travel")),
      tagline: str(site.tagline, "Agensi pelancongan"),
      phone: str(company.phone, "+60 3-2711 8899"),
      email: str(company.email, "hello@zaqone.travel"),
      address: str(company.address, "Jalan Ampang 88, 50450 Kuala Lumpur"),
      website: str(company.website, "https://travelcrm.zaqone.com"),
      logoUrl: str(company.logoUrl, "/brand/zaqone-logo.png"),
      whatsapp: str(site.whatsapp, "60123880030"),
      currency: str(site.currency, "MYR"),
      defaultLang: str(site.defaultLang, "ms"),
    },
  });
});

export default publicRouter;

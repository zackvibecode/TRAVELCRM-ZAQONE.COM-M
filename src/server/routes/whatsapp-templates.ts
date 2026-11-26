import { Hono } from "hono";
import { and, asc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireStaffSession } from "../middleware/auth";
import type { StaffIdentity } from "../lib/auth-context";
import { followupAccessRole, requireOwnedLead } from "../lib/owned-lead";
import { logAudit } from "../lib/audit";
import { unknownTokensIn, renderTemplateWithMeta, formatKlDate, WA_MESSAGE_LIMIT } from "../lib/template-render";
import { validateWhatsAppNumber, waMeLink, waRejectMessage } from "../lib/wa-link";

export type TemplateEnv = {
  Bindings: { DB: D1Database };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: StaffIdentity;
  };
};

const templatesRouter = new Hono<TemplateEnv>();

/**
 * /api/followup/templates — WhatsApp template management.
 * Templates are shared team content, so every CRM role (ADMIN + SALES) may
 * read, create, update or deactivate them. Roles outside the CRM get a
 * neutral 404 (same contract as lead access).
 */
templatesRouter.use("*", requireStaffSession);

/** Resolves the caller's CRM role or returns a 404 response. */
function resolveAccess(staff: StaffIdentity): { access: "ADMIN" | "SALES" } | Response {
  const access = followupAccessRole(staff.role);
  if (!access) {
    return Response.json(
      { error: "not_found", message: "Follow-up CRM not available for this role" },
      { status: 404 },
    );
  }
  return { access };
}

/** Guards template mutations — any CRM role (ADMIN or SALES) may proceed. */
function requireCrmAccess(staff: StaffIdentity): Response | null {
  const resolved = resolveAccess(staff);
  return resolved instanceof Response ? resolved : null;
}

/** One logical template (code) with its EN and MS variants. */
export interface TemplateGroup {
  code: string;
  name: string;
  stage: string | null;
  active: boolean;
  updatedAt: string;
  variants: {
    en?: { id: string; body: string; updatedAt: string };
    ms?: { id: string; body: string; updatedAt: string };
  };
}

/** Groups per-locale rows by code. Name comes from the EN row, else MS. */
function groupTemplates(rows: schema.WhatsappTemplateRow[]): TemplateGroup[] {
  const byCode = new Map<string, TemplateGroup>();
  for (const r of rows) {
    let g = byCode.get(r.code);
    if (!g) {
      g = { code: r.code, name: r.name, stage: r.stage, active: r.active, updatedAt: r.updatedAt, variants: {} };
      byCode.set(r.code, g);
    }
    if (r.locale === "en") g.name = r.name;
    if (r.updatedAt > g.updatedAt) g.updatedAt = r.updatedAt;
    g.active = g.active && r.active;
    g.variants[r.locale] = { id: r.id, body: r.body, updatedAt: r.updatedAt };
  }
  return [...byCode.values()];
}

async function loadTemplates(
  db: DrizzleD1Database<typeof schema>,
  opts?: { stage?: string; activeOnly?: boolean },
): Promise<schema.WhatsappTemplateRow[]> {
  const conds = [];
  if (opts?.stage) conds.push(eq(schema.whatsappTemplates.stage, opts.stage));
  if (opts?.activeOnly) conds.push(eq(schema.whatsappTemplates.active, true));
  return db
    .select()
    .from(schema.whatsappTemplates)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(schema.whatsappTemplates.code), asc(schema.whatsappTemplates.locale));
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * GET /api/followup/templates — list templates grouped by code.
 * Query params:
 *   stage  — FU1 | FU2 | FU3 (optional)
 *   active — "1" to return active templates only (the picker uses this)
 */
templatesRouter.get("/", async (c) => {
  const staff = c.get("staff");
  const resolved = resolveAccess(staff);
  if (resolved instanceof Response) return resolved;

  const stage = c.req.query("stage")?.trim() || undefined;
  const activeOnly = c.req.query("active") === "1";
  const rows = await loadTemplates(c.get("db"), { stage, activeOnly });

  return c.json({ success: true, data: groupTemplates(rows) });
});

/**
 * GET /api/followup/templates/:code — one template group with both locales.
 */
templatesRouter.get("/:code", async (c) => {
  const staff = c.get("staff");
  const resolved = resolveAccess(staff);
  if (resolved instanceof Response) return resolved;

  const code = c.req.param("code");
  const rows = await loadTemplates(c.get("db"));
  const group = groupTemplates(rows).find((g) => g.code === code);
  if (!group) {
    return c.json({ success: false, error: "not_found" }, 404);
  }
  return c.json({ success: true, data: group });
});

// ---------------------------------------------------------------------------
// Mutations (ADMIN only)
// ---------------------------------------------------------------------------

/** Shape of a create/update body: both locale bodies under one code. */
interface TemplateBody {
  code?: string;
  name?: string;
  stage?: string | null;
  active?: boolean;
  enBody?: string;
  msBody?: string;
}

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;
const STAGES = new Set(["FU1", "FU2", "FU3"]);

/** Validates a mutation body. Returns an error message or null. */
function validateTemplate(body: TemplateBody, { requireCode }: { requireCode: boolean }): string | null {
  const code = body.code?.trim();
  if (requireCode && !code) return "code is required";
  if (code && !CODE_RE.test(code)) return "code must be lowercase letters, digits and hyphens (2-49 chars)";
  if (!body.name?.trim()) return "name is required";
  if (body.name && body.name.length > 120) return "name must be at most 120 characters";
  if (!body.enBody?.trim()) return "English body is required";
  if (!body.msBody?.trim()) return "Malay body is required";
  if (body.stage != null && !STAGES.has(body.stage)) return "stage must be one of FU1, FU2, FU3";
  const badEn = unknownTokensIn(body.enBody ?? "");
  if (badEn.length) return `English body has unknown placeholder(s): ${badEn.join(", ")}`;
  const badMs = unknownTokensIn(body.msBody ?? "");
  if (badMs.length) return `Malay body has unknown placeholder(s): ${badMs.join(", ")}`;
  return null;
}

/**
 * POST /api/followup/templates — create a template with both locales.
 * Body: { code, name, stage, enBody, msBody, active? }
 */
templatesRouter.post("/", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const denied = requireCrmAccess(staff);
  if (denied) return denied;

  const body = (await c.req.json().catch(() => ({}))) as TemplateBody;
  const error = validateTemplate(body, { requireCode: true });
  if (error) return c.json({ success: false, error }, 400);

  const code = body.code!.trim();
  const existing = await loadTemplates(db);
  if (existing.some((r) => r.code === code)) {
    return c.json({ success: false, error: "A template with this code already exists" }, 409);
  }

  const now = new Date().toISOString();
  const stage = body.stage?.trim() || null;
  const active = body.active ?? true;
  await db.insert(schema.whatsappTemplates).values([
    {
      id: crypto.randomUUID(),
      code,
      name: body.name!.trim(),
      locale: "en",
      body: body.enBody!.trim(),
      stage,
      active,
      createdBy: staff.id,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      code,
      name: body.name!.trim(),
      locale: "ms",
      body: body.msBody!.trim(),
      stage,
      active,
      createdBy: staff.id,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await logAudit(db, {
    action: "whatsapp_template.create",
    entityType: "whatsapp_template",
    entityId: code,
    actor: staff.email,
    role: staff.role,
  });

  const rows = await loadTemplates(db);
  return c.json({ success: true, data: groupTemplates(rows).find((g) => g.code === code) }, 201);
});

/**
 * PUT /api/followup/templates/:code — update name/stage/bodies/active.
 * Both locale rows are written together so the pair never drifts.
 * Body: { name?, stage?, enBody?, msBody?, active? }
 */
templatesRouter.put("/:code", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const denied = requireCrmAccess(staff);
  if (denied) return denied;

  const code = c.req.param("code");
  const rows = await loadTemplates(db);
  const current = rows.filter((r) => r.code === code);
  if (current.length === 0) {
    return c.json({ success: false, error: "not_found" }, 404);
  }

  const body = (await c.req.json().catch(() => ({}))) as TemplateBody;
  // Merge onto the current pair so partial updates keep the other fields.
  const en = current.find((r) => r.locale === "en");
  const ms = current.find((r) => r.locale === "ms");
  const merged: TemplateBody = {
    code,
    name: body.name ?? current[0].name,
    stage: body.stage !== undefined ? body.stage : current[0].stage,
    active: body.active ?? current[0].active,
    enBody: body.enBody ?? en?.body ?? "",
    msBody: body.msBody ?? ms?.body ?? "",
  };
  const error = validateTemplate(merged, { requireCode: false });
  if (error) return c.json({ success: false, error }, 400);

  const now = new Date().toISOString();
  const stage = merged.stage?.trim() || null;
  for (const r of current) {
    const nextBody = r.locale === "en" ? merged.enBody! : merged.msBody!;
    await db
      .update(schema.whatsappTemplates)
      .set({
        name: merged.name!.trim(),
        stage,
        active: merged.active ?? true,
        body: nextBody.trim(),
        updatedAt: now,
      })
      .where(eq(schema.whatsappTemplates.id, r.id));
  }

  await logAudit(db, {
    action: "whatsapp_template.update",
    entityType: "whatsapp_template",
    entityId: code,
    actor: staff.email,
    role: staff.role,
  });

  const updated = await loadTemplates(db);
  return c.json({ success: true, data: groupTemplates(updated).find((g) => g.code === code) });
});

/**
 * POST /api/followup/templates/:code/toggle — activate or deactivate
 * both locale rows of a template. Body: { active: boolean }
 */
templatesRouter.post("/:code/toggle", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const denied = requireCrmAccess(staff);
  if (denied) return denied;

  const code = c.req.param("code");
  const rows = await loadTemplates(db);
  const current = rows.filter((r) => r.code === code);
  if (current.length === 0) {
    return c.json({ success: false, error: "not_found" }, 404);
  }

  const body = (await c.req.json().catch(() => ({}))) as { active?: boolean };
  if (typeof body.active !== "boolean") {
    return c.json({ success: false, error: "active (boolean) is required" }, 400);
  }

  const now = new Date().toISOString();
  await db
    .update(schema.whatsappTemplates)
    .set({ active: body.active, updatedAt: now })
    .where(eq(schema.whatsappTemplates.code, code));

  await logAudit(db, {
    action: body.active ? "whatsapp_template.activate" : "whatsapp_template.deactivate",
    entityType: "whatsapp_template",
    entityId: code,
    actor: staff.email,
    role: staff.role,
  });

  return c.json({ success: true, data: { code, active: body.active } });
});

/**
 * POST /api/followup/templates/preview — render a template for one lead.
 * Body: { leadId, code, locale?, dateMs? }
 *   leadId  — lead to personalise for (ownership-guarded, 404 if not yours)
 *   code    — template code (both locales exist; pick one to preview)
 *   locale  — "en" | "ms" (default: template's MS variant if present)
 *   dateMs  — epoch ms the {{date}} token should show (default: now)
 * Returns the rendered body, still-missing placeholders, length vs the
 * WhatsApp limit, and a ready wa.me deep link.
 */
templatesRouter.post("/preview", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const resolved = resolveAccess(staff);
  if (resolved instanceof Response) return resolved;

  const body = (await c.req.json().catch(() => ({}))) as {
    leadId?: string;
    code?: string;
    locale?: string;
    dateMs?: number;
  };
  if (!body.leadId || !body.code) {
    return c.json({ success: false, error: "leadId and code are required" }, 400);
  }

  // Ownership guard: 404 (not 403) for leads the caller may not see.
  const owned = await requireOwnedLead(db, body.leadId, staff);
  if (!owned.ok) return owned.response;
  const lead = owned.lead;

  const rows = await loadTemplates(db);
  const group = groupTemplates(rows).find((g) => g.code === body.code);
  if (!group) {
    return c.json({ success: false, error: "not_found" }, 404);
  }

  const locale = body.locale === "en" ? "en" : body.locale === "ms" ? "ms" : group.variants.ms ? "ms" : "en";
  const variant = group.variants[locale];
  if (!variant) {
    return c.json({ success: false, error: `Template has no ${locale} variant` }, 400);
  }

  const dateMs = typeof body.dateMs === "number" && Number.isFinite(body.dateMs) ? body.dateMs : Date.now();
  const rendered = renderTemplateWithMeta(
    { code: group.code, name: group.name, locale, body: variant.body, stage: group.stage, active: group.active },
    {
      leadName: lead.name,
      packageName: lead.destination ?? "",
      date: formatKlDate(dateMs, locale),
      salesName: staff.name,
    },
  );

  const phone = validateWhatsAppNumber(lead.phone);
  const waUrl = phone.ok ? waMeLink(lead.phone, rendered.body) : null;

  return c.json({
    success: true,
    data: {
      leadId: lead.id,
      code: group.code,
      locale,
      name: group.name,
      stage: group.stage,
      body: rendered.body,
      missing: rendered.missing,
      packageName: lead.destination ?? "",
      length: rendered.length,
      limit: WA_MESSAGE_LIMIT,
      tooLong: rendered.length > WA_MESSAGE_LIMIT,
      phone: lead.phone,
      /** E.164 digits wa.me will dial, or "" when the number is unusable. */
      phoneDigits: phone.ok ? phone.digits : "",
      /** Why the number was rejected, or null when it is usable. */
      phoneError: phone.ok ? null : waRejectMessage(phone.reason, locale),
      waUrl,
    },
  });
});

export default templatesRouter;

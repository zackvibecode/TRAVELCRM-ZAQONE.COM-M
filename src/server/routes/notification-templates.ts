import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import {
  requireStaffSession,
  requireRole,
  requirePermission,
} from "../middleware/auth";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: { id: string; name: string; email: string; role: string; sessionId: string };
    userRole: string;
  };
};

const templatesRouter = new Hono<Env>();

templatesRouter.use("*", requireStaffSession);
templatesRouter.use(
  "*",
  requireRole("super_admin", "management"),
  requirePermission("settings:read"),
);

/** GET /notification-templates — list all templates. */
templatesRouter.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(schema.notificationTemplates)
    .orderBy(desc(schema.notificationTemplates.updatedAt));
  return c.json({ success: true, templates: rows });
});

/** GET /notification-templates/:id — one template with parsed variables. */
templatesRouter.get("/:id", async (c) => {
  const db = c.get("db");
  const row = await db
    .select()
    .from(schema.notificationTemplates)
    .where(eq(schema.notificationTemplates.id, c.req.param("id")))
    .limit(1);
  if (row.length === 0) {
    return c.json({ success: false, error: "Template not found" }, 404);
  }
  const variables = extractVariables(row[0]!.subject + " " + row[0]!.body);
  return c.json({ success: true, template: row[0], variables });
});

/** PUT /notification-templates/:id — edit a template (super admin). */
templatesRouter.put(
  "/:id",
  requireRole("super_admin"),
  requirePermission("settings:write"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const existing = await db
      .select()
      .from(schema.notificationTemplates)
      .where(eq(schema.notificationTemplates.id, id))
      .limit(1);
    if (existing.length === 0) {
      return c.json({ success: false, error: "Template not found" }, 404);
    }

    const body = (await c.req.json()) as {
      nameMs?: string;
      nameEn?: string;
      subject?: string;
      body?: string;
      enabled?: boolean;
    };
    const patch: Partial<typeof schema.notificationTemplates.$inferInsert> = {};
    if (body.nameMs !== undefined) patch.nameMs = body.nameMs;
    if (body.nameEn !== undefined) patch.nameEn = body.nameEn;
    if (body.subject !== undefined) patch.subject = body.subject;
    if (body.body !== undefined) patch.body = body.body;
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    patch.updatedBy = c.get("staff")?.email ?? "system";
    patch.updatedAt = new Date();

    await db
      .update(schema.notificationTemplates)
      .set(patch)
      .where(eq(schema.notificationTemplates.id, id));

    await db.insert(schema.settingsAuditLogs).values({
      id: crypto.randomUUID(),
      actor: c.get("staff")?.email ?? "system",
      role: "super_admin",
      module: "notification-templates",
      field: existing[0]!.code,
      beforeValue: JSON.stringify(existing[0]),
      afterValue: JSON.stringify({ ...existing[0], ...body }),
      changeType: "updated",
    });

    return c.json({ success: true });
  },
);

/** POST /notification-templates/:id/preview — render {{placeholders}}. */
templatesRouter.post("/:id/preview", async (c) => {
  const body = (await c.req.json()) as {
    subject?: string;
    body?: string;
    values?: Record<string, string>;
  };
  const values = body.values ?? DEFAULT_VALUES;
  return c.json({
    success: true,
    subject: interpolate(body.subject ?? "", values),
    body: interpolate(body.body ?? "", values),
  });
});

const DEFAULT_VALUES: Record<string, string> = {
  customer_name: "Ahmad Zulkifli",
  booking_ref: "ZQK-2026-000118",
  package_name: "Umrah Ramadan 2027",
  departure_date: "15 Mac 2027",
  amount: "RM 3,850.00",
  due_date: "1 Mac 2027",
};

function extractVariables(text: string): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) out.add(match[1]!);
  return Array.from(out);
}

function interpolate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_all, key: string) =>
    values[key] !== undefined ? values[key]! : `{{${key}}}`,
  );
}

export default templatesRouter;

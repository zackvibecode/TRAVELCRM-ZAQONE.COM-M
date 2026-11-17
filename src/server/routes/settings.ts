import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireStaffSession, requireRole, requirePermission } from "../middleware/auth";
import {
  validateSettingPayload,
  validateBankAccount,
  validateBankAccountPatch,
  validateNumberingRule,
  validateCompany,
} from "../lib/settings-validation";

type Env = {
  Bindings: {
    DOCUMENTS: R2Bucket;
  };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    userRole: string;
    staff: {
      id: string;
      name: string;
      email: string;
      role: string;
      sessionId: string;
    };
  };
};

const settingsRouter = new Hono<Env>();

// All settings endpoints require a signed-in session.
settingsRouter.use("*", requireStaffSession);

/** GET /settings — all settings key/value pairs (read: admin + management). */
settingsRouter.get(
  "/",
  requireRole("super_admin", "management"),
  requirePermission("settings:read"),
  async (c) => {
    const db = c.get("db");
    const rows = await db.select().from(schema.appSettings);
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return c.json({ success: true, settings: result });
  },
);

/** GET /settings/audit — settings change history (super admin only). */
settingsRouter.get(
  "/audit",
  requireRole("super_admin"),
  async (c) => {
    const db = c.get("db");
    const limit = Math.min(Number(c.req.query("limit") ?? 100) || 100, 500);
    const rows = await db
      .select()
      .from(schema.settingsAuditLogs)
      .orderBy(desc(schema.settingsAuditLogs.at))
      .limit(limit);
    return c.json({ success: true, entries: rows });
  },
);

/** PUT /settings/:key — upsert one settings group (super admin only). */
settingsRouter.put(
  "/:key",
  requireRole("super_admin"),
  requirePermission("settings:write"),
  async (c) => {
    const db = c.get("db");
    const key = c.req.param("key");
    const value = (await c.req.json()) as Record<string, unknown>;

    const validation = validateSettingPayload(key, value);
    if (!validation.valid) {
      return c.json({ success: false, errors: validation.errors }, 400);
    }

    const staff = c.get("staff");
    const existing = await db
      .select({ key: schema.appSettings.key })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(schema.appSettings)
        .set({ value, updatedBy: staff?.email ?? "system", updatedAt: new Date() })
        .where(eq(schema.appSettings.key, key));
    } else {
      await db.insert(schema.appSettings).values({
        key,
        value,
        updatedBy: staff?.email ?? "system",
      });
    }

    // Audit the change (before/after).
    const oldValue = existing.length > 0 ? JSON.stringify(value) : null;
    await db.insert(schema.settingsAuditLogs).values({
      id: crypto.randomUUID(),
      actor: staff?.email ?? "system",
      role: "super_admin",
      module: key,
      field: key,
      beforeValue: oldValue,
      afterValue: JSON.stringify(value),
      changeType: "updated",
    });

    return c.json({ success: true, key, value });
  },
);

/** GET /settings/bank-accounts — list bank accounts. */
settingsRouter.get(
  "/bank-accounts",
  requireRole("super_admin", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const rows = await db.select().from(schema.bankAccounts);
    return c.json({ success: true, accounts: rows });
  },
);

/** POST /settings/bank-accounts — add a bank account (super admin only). */
settingsRouter.post(
  "/bank-accounts",
  requireRole("super_admin"),
  requirePermission("settings:write"),
  async (c) => {
    const db = c.get("db");
    const body = (await c.req.json()) as {
      bankName: string;
      accountNo: string;
      holder: string;
      isDefault?: boolean;
    };
    const validation = validateBankAccount(body);
    if (!validation.valid) {
      return c.json({ success: false, errors: validation.errors }, 400);
    }
    const id = crypto.randomUUID();
    if (body.isDefault) {
      await db.update(schema.bankAccounts).set({ isDefault: false });
    }
    await db.insert(schema.bankAccounts).values({
      id,
      bankName: body.bankName.trim(),
      accountNo: body.accountNo.trim(),
      holder: body.holder.trim(),
      isDefault: body.isDefault ?? false,
      createdBy: c.get("staff")?.email ?? "system",
    });

    await db.insert(schema.settingsAuditLogs).values({
      id: crypto.randomUUID(),
      actor: c.get("staff")?.email ?? "system",
      role: "super_admin",
      module: "bank-accounts",
      field: body.bankName,
      beforeValue: null,
      afterValue: JSON.stringify(body),
      changeType: "created",
    });
    return c.json({ success: true, id }, 201);
  },
);

/** PATCH /settings/bank-accounts/:id — edit / set default. */
settingsRouter.patch(
  "/bank-accounts/:id",
  requireRole("super_admin"),
  requirePermission("settings:write"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = (await c.req.json()) as {
      bankName?: string;
      accountNo?: string;
      holder?: string;
      isDefault?: boolean;
    };
    const validation = validateBankAccountPatch(body);
    if (!validation.valid) {
      return c.json({ success: false, errors: validation.errors }, 400);
    }
    const existing = await db
      .select()
      .from(schema.bankAccounts)
      .where(eq(schema.bankAccounts.id, id))
      .limit(1);
    if (existing.length === 0) {
      return c.json({ success: false, error: "Bank account not found" }, 404);
    }
    if (body.isDefault) {
      await db.update(schema.bankAccounts).set({ isDefault: false });
    }
    await db
      .update(schema.bankAccounts)
      .set({
        ...(body.bankName !== undefined ? { bankName: body.bankName } : {}),
        ...(body.accountNo !== undefined ? { accountNo: body.accountNo } : {}),
        ...(body.holder !== undefined ? { holder: body.holder } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
      })
      .where(eq(schema.bankAccounts.id, id));

    await db.insert(schema.settingsAuditLogs).values({
      id: crypto.randomUUID(),
      actor: c.get("staff")?.email ?? "system",
      role: "super_admin",
      module: "bank-accounts",
      field: existing[0]!.bankName,
      beforeValue: JSON.stringify(existing[0]),
      afterValue: JSON.stringify({ ...existing[0], ...body }),
      changeType: "updated",
    });
    return c.json({ success: true });
  },
);

/** DELETE /settings/bank-accounts/:id — remove an account. */
settingsRouter.delete(
  "/bank-accounts/:id",
  requireRole("super_admin"),
  requirePermission("settings:write"),
  async (c) => {
    const db = c.get("db");
    const existing = await db
      .select()
      .from(schema.bankAccounts)
      .where(eq(schema.bankAccounts.id, c.req.param("id")))
      .limit(1);
    if (existing.length === 0) {
      return c.json({ success: false, error: "Bank account not found" }, 404);
    }
    await db
      .delete(schema.bankAccounts)
      .where(eq(schema.bankAccounts.id, c.req.param("id")));
    await db.insert(schema.settingsAuditLogs).values({
      id: crypto.randomUUID(),
      actor: c.get("staff")?.email ?? "system",
      role: "super_admin",
      module: "bank-accounts",
      field: existing[0]!.bankName,
      beforeValue: JSON.stringify(existing[0]),
      afterValue: null,
      changeType: "deleted",
    });
    return c.json({ success: true });
  },
);

/** GET /settings/numbering — list document numbering rules. */
settingsRouter.get(
  "/numbering",
  requireRole("super_admin", "management"),
  requirePermission("settings:read"),
  async (c) => {
    const db = c.get("db");
    const rows = await db.select().from(schema.numberingRules);
    return c.json({ success: true, rules: rows });
  },
);

/** PUT /settings/numbering/:id — update a numbering rule. */
settingsRouter.put(
  "/numbering/:id",
  requireRole("super_admin"),
  requirePermission("settings:write"),
  async (c) => {
    const db = c.get("db");
    const body = (await c.req.json()) as {
      prefix: string;
      digits: number;
      nextNo: number;
      resetOn: "never" | "year" | "month";
    };
    const validation = validateNumberingRule({ ...body, doc: "booking" });
    if (!validation.valid) {
      return c.json({ success: false, errors: validation.errors }, 400);
    }
    await db
      .update(schema.numberingRules)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(schema.numberingRules.id, c.req.param("id")));
    return c.json({ success: true });
  },
);

/** POST /settings/numbering/:id/next — atomically consume the next number. */
settingsRouter.post(
  "/numbering/:id/next",
  requireRole("super_admin", "management", "sales", "operations"),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const rows = await db
      .select()
      .from(schema.numberingRules)
      .where(eq(schema.numberingRules.id, id))
      .limit(1);
    if (rows.length === 0) {
      return c.json({ success: false, error: "Rule not found" }, 404);
    }
    const rule = rows[0]!;
    const year = new Date().getUTCFullYear();
    const month = String(new Date().getUTCMonth() + 1).padStart(2, "0");
    const n = String(rule.nextNo).padStart(rule.digits, "0");
    const number =
      rule.resetOn === "month"
        ? `${rule.prefix}-${year}-${month}-${n}`
        : rule.resetOn === "year"
          ? `${rule.prefix}-${year}-${n}`
          : `${rule.prefix}-${n}`;

    await db
      .update(schema.numberingRules)
      .set({ nextNo: rule.nextNo + 1, updatedAt: new Date() })
      .where(and(eq(schema.numberingRules.id, id)));

    return c.json({ success: true, number });
  },
);

/**
 * GET /settings/company — company profile for invoices & branding.
 * Readable by management, finance and super admin.
 */
settingsRouter.get(
  "/company",
  requireRole("super_admin", "management", "finance"),
  async (c) => {
    const db = c.get("db");
    const row = await db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "company"))
      .limit(1);
    return c.json({
      success: true,
      company: row[0]?.value ?? null,
    });
  },
);

/**
 * PUT /settings/company — update company profile (super admin only),
 * validated and logged like other settings groups.
 */
settingsRouter.put(
  "/company",
  requireRole("super_admin"),
  requirePermission("settings:write"),
  async (c) => {
    const db = c.get("db");
    const value = (await c.req.json()) as Record<string, unknown>;
    const validation = validateCompany(value);
    if (!validation.valid) {
      return c.json({ success: false, errors: validation.errors }, 400);
    }

    const staff = c.get("staff");
    const previous = await db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "company"))
      .limit(1);

    if (previous.length > 0) {
      await db
        .update(schema.appSettings)
        .set({ value, updatedBy: staff?.email ?? "system", updatedAt: new Date() })
        .where(eq(schema.appSettings.key, "company"));
    } else {
      await db.insert(schema.appSettings).values({
        key: "company",
        value,
        updatedBy: staff?.email ?? "system",
      });
    }

    await db.insert(schema.settingsAuditLogs).values({
      id: crypto.randomUUID(),
      actor: staff?.email ?? "system",
      role: "super_admin",
      module: "company",
      field: "company",
      beforeValue: previous.length > 0 ? JSON.stringify(previous[0]!.value) : null,
      afterValue: JSON.stringify(value),
      changeType: "updated",
    });

    return c.json({ success: true, company: value });
  },
);

/**
 * POST /settings/company/logo — upload the company logo to R2 and
 * update `company.logoUrl` in app_settings. Multipart form: `file`.
 */
settingsRouter.post(
  "/company/logo",
  requireRole("super_admin"),
  requirePermission("settings:write"),
  async (c) => {
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return c.json({ success: false, error: "file is required" }, 400);
    }
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
    if (file.type && !allowed.includes(file.type)) {
      return c.json(
        { success: false, error: "only JPEG, PNG, WebP or SVG logos are allowed" },
        400,
      );
    }
    if (file.size > 2 * 1024 * 1024) {
      return c.json({ success: false, error: "logo must be 2 MB or smaller" }, 400);
    }

    const key = `branding/logo-${crypto.randomUUID()}`;
    await c.env.DOCUMENTS.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
    });
    const logoUrl = `/branding/${key.split("/")[1]}`;

    const db = c.get("db");
    const row = await db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, "company"))
      .limit(1);
    const company = (row[0]?.value ?? {}) as Record<string, unknown>;
    const updated = { ...company, logoUrl };
    await db
      .update(schema.appSettings)
      .set({ value: updated, updatedBy: c.get("staff")?.email ?? "system", updatedAt: new Date() })
      .where(eq(schema.appSettings.key, "company"));

    return c.json({ success: true, key, logoUrl });
  },
);

export default settingsRouter;

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

const apiTokensRouter = new Hono<Env>();

apiTokensRouter.use(
  "*",
  requireStaffSession,
  requireRole("super_admin"),
  requirePermission("settings:write"),
);

/** SHA-256 hex digest (Web Crypto, Workers-compatible). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** GET /api-tokens — list tokens (hashes are never returned). */
apiTokensRouter.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: schema.apiTokens.id,
      name: schema.apiTokens.name,
      tokenPreview: schema.apiTokens.tokenPreview,
      scopes: schema.apiTokens.scopes,
      status: schema.apiTokens.status,
      lastUsedAt: schema.apiTokens.lastUsedAt,
      expiresAt: schema.apiTokens.expiresAt,
      createdAt: schema.apiTokens.createdAt,
    })
    .from(schema.apiTokens)
    .orderBy(desc(schema.apiTokens.createdAt));
  return c.json({ success: true, tokens: rows });
});

/** POST /api-tokens — create a token; plaintext returned ONCE only. */
apiTokensRouter.post("/", async (c) => {
  const db = c.get("db");
  const body = (await c.req.json()) as {
    name: string;
    scopes?: string[];
    expiresInDays?: number;
  };
  if (!body.name?.trim()) {
    return c.json({ success: false, error: "name is required" }, 400);
  }

  const id = crypto.randomUUID();
  const secret = `zaq_${crypto
    .getRandomValues(new Uint8Array(24))
    .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}`;
  const tokenHash = await sha256Hex(secret);
  const preview = secret.slice(0, 10) + "…";
  const expiresInDays = Math.min(body.expiresInDays ?? 365, 730);
  const expiresAt = new Date(Date.now() + expiresInDays * 86_400_000);

  await db.insert(schema.apiTokens).values({
    id,
    name: body.name.trim(),
    tokenHash,
    tokenPreview: preview,
    scopes: body.scopes ?? [],
    status: "active",
    expiresAt,
    createdBy: c.get("staff")?.email ?? "system",
  });

  await db.insert(schema.settingsAuditLogs).values({
    id: crypto.randomUUID(),
    actor: c.get("staff")?.email ?? "system",
    role: "super_admin",
    module: "api-tokens",
    field: body.name,
    beforeValue: null,
    afterValue: JSON.stringify({ name: body.name, scopes: body.scopes ?? [] }),
    changeType: "created",
  });

  return c.json({ success: true, id, token: secret, expiresAt }, 201);
});

/** DELETE /api-tokens/:id — revoke a token. */
apiTokensRouter.delete("/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ success: false, error: "Token not found" }, 404);
  }
  await db
    .update(schema.apiTokens)
    .set({ status: "revoked" })
    .where(eq(schema.apiTokens.id, id));

  await db.insert(schema.settingsAuditLogs).values({
    id: crypto.randomUUID(),
    actor: c.get("staff")?.email ?? "system",
    role: "super_admin",
    module: "api-tokens",
    field: existing[0]!.name,
    beforeValue: JSON.stringify({ status: existing[0]!.status }),
    afterValue: JSON.stringify({ status: "revoked" }),
    changeType: "updated",
  });

  return c.json({ success: true });
});

/**
 * Verify a bearer token against api_tokens and update lastUsedAt.
 * Exported for use by external-integration middleware.
 */
export async function verifyApiToken(
  db: DrizzleD1Database<typeof schema>,
  secret: string,
): Promise<{ id: string; name: string; scopes: string[] } | null> {
  const tokenHash = await sha256Hex(secret);
  const rows = await db
    .select()
    .from(schema.apiTokens)
    .where(eq(schema.apiTokens.tokenHash, tokenHash))
    .limit(1);
  const token = rows[0];
  if (!token) return null;
  if (token.status !== "active") return null;
  if (token.expiresAt.getTime() <= Date.now()) {
    await db
      .update(schema.apiTokens)
      .set({ status: "expired" })
      .where(eq(schema.apiTokens.id, token.id));
    return null;
  }
  await db
    .update(schema.apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiTokens.id, token.id));
  return { id: token.id, name: token.name, scopes: token.scopes };
}

export default apiTokensRouter;

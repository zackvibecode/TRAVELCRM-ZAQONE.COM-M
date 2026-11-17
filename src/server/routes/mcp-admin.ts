import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
  };
};

const mcpAdminRouter = new Hono<Env>();

// All token-management endpoints require Super Admin or Management.
mcpAdminRouter.use("*", requireRole("super_admin", "management"));

/** SHA-256 hash of a bearer token (Web Crypto, Workers-compatible). */
async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a cryptographically random bearer token with the zqk_live_ prefix. */
function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `zqk_live_${hex}`;
}

/**
 * POST /mcp-admin/tokens — issue a new access token.
 * The full secret is returned ONCE in this response; only its hash is stored.
 */
mcpAdminRouter.post("/tokens", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<{
    name?: string;
    role?: schema.McpTokenRow["role"];
    scopes?: string[];
    expiresAt?: string;
  }>();

  const name = (body.name ?? "").trim();
  if (!name) return c.json({ error: "name is required" }, 400);

  const secret = generateSecret();
  const hash = await hashToken(secret);
  const id = crypto.randomUUID();
  const preview = `${secret.slice(0, 13)}…${secret.slice(-4)}`;
  const role = body.role ?? "sales";
  const scopes = Array.isArray(body.scopes) ? body.scopes : ["leads:read"];

  // Default expiry: 1 year from now.
  const expiresAt =
    body.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await db.insert(schema.mcpTokens).values({
    id,
    name,
    tokenHash: hash,
    tokenPreview: preview,
    role,
    scopes,
    status: "active",
    createdBy: c.req.header("x-user-id") ?? null,
    expiresAt,
    callsLast30d: 0,
  }).run();

  return c.json(
    {
      token: {
        id,
        name,
        secret, // shown only once
        preview,
        role,
        scopes,
        status: "active",
        expiresAt,
      },
    },
    201,
  );
});

/**
 * GET /mcp-admin/tokens — list tokens (metadata only, never the secret).
 */
mcpAdminRouter.get("/tokens", async (c) => {
  const db = c.get("db");

  const rows = await db.all<schema.McpTokenRow>(sql`
    SELECT id, name, token_preview AS tokenPreview, role, scopes,
           status, created_by AS createdBy, created_at AS createdAt,
           last_used_at AS lastUsedAt, expires_at AS expiresAt,
           calls_last_30d AS callsLast30d
    FROM mcp_tokens
    ORDER BY created_at DESC
  `);

  const parsed = rows.map((r) => ({
    ...r,
    scopes: typeof r.scopes === "string" ? JSON.parse(r.scopes) : r.scopes,
  }));

  return c.json({ tokens: parsed });
});

/**
 * GET /mcp-admin/audit — query MCP call history with filters.
 * Query: ?outcome=denied&tool=list_leads&tokenId=...&from=...&to=...&limit=...
 */
mcpAdminRouter.get("/audit", async (c) => {
  const db = c.get("db");
  const outcome = c.req.query("outcome");
  const tool = c.req.query("tool");
  const tokenId = c.req.query("tokenId");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const limit = Math.min(Number(c.req.query("limit")) || 100, 500);

  const rows = await db.all<schema.McpAuditLogRow>(sql`
    SELECT id, token_id AS tokenId, tool, arguments, outcome,
           denied_reason AS deniedReason, duration_ms AS durationMs,
           created_at AS createdAt
    FROM mcp_audit_logs
    WHERE 1 = 1
      ${outcome ? sql`AND outcome = ${outcome}` : sql``}
      ${tool ? sql`AND tool = ${tool}` : sql``}
      ${tokenId ? sql`AND token_id = ${tokenId}` : sql``}
      ${from ? sql`AND created_at >= ${from}` : sql``}
      ${to ? sql`AND created_at <= ${to}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return c.json({
    entries: rows.map((r) => ({
      ...r,
      arguments: r.arguments
        ? typeof r.arguments === "string"
          ? JSON.parse(r.arguments)
          : r.arguments
        : null,
    })),
  });
});

/**
 * POST /mcp-admin/tokens/:id/revoke — revoke a token immediately.
 */
mcpAdminRouter.post("/tokens/:id/revoke", async (c) => {
  const db = c.get("db");
  await db.execute(sql`
    UPDATE mcp_tokens SET status = 'revoked' WHERE id = ${c.req.param("id")}
  `);
  return c.json({ ok: true });
});

/**
 * Verify a bearer token and return its auth context (used by the MCP server).
 * Internal helper exported for reuse by the MCP route module.
 */
export async function verifyBearerToken(
  db: DrizzleD1Database<typeof schema>,
  authHeader: string | undefined,
): Promise<schema.McpTokenRow | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const secret = authHeader.slice(7);
  const hash = await hashToken(secret);

  const rows = await db.all<schema.McpTokenRow>(sql`
    SELECT * FROM mcp_tokens
    WHERE token_hash = ${hash} AND status = 'active'
      AND expires_at >= date('now')
    LIMIT 1
  `);
  if (rows.length === 0) return null;

  const row = rows[0];
  // Update last used (best-effort; non-blocking for auth).
  await db.execute(sql`
    UPDATE mcp_tokens SET last_used_at = datetime('now'),
      calls_last_30d = calls_last_30d + 1
    WHERE id = ${row.id}
  `).catch(() => undefined);

  return row;
}

export default mcpAdminRouter;

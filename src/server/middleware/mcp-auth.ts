import type { Context, MiddlewareHandler } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { verifyBearerToken } from "../routes/mcp-admin";

type McpContext = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    mcpToken: schema.McpTokenRow;
  };
};

/**
 * MCP bearer-token authentication + scope enforcement.
 *
 * Usage: app.use("/mcp/*", mcpAuth("leads:read"))
 * - Invalid / revoked / expired token → 401
 * - Token missing the required scope → 403 + audit log entry
 * - Authorized → sets `mcpToken` in context for the handler.
 */
export function mcpAuth(requiredScope: string): MiddlewareHandler<McpContext> {
  return async (c: Context<McpContext>, next) => {
    const db = c.get("db");
    const token = await verifyBearerToken(db, c.req.header("Authorization"));

    if (!token) {
      return c.json({ error: "invalid or expired MCP token" }, 401);
    }

    const scopes = Array.isArray(token.scopes)
      ? token.scopes
      : typeof token.scopes === "string"
        ? JSON.parse(token.scopes)
        : [];

    if (!scopes.includes(requiredScope) && !scopes.includes("*")) {
      // Audit the denied scope check.
      await db.run(sql`
        INSERT INTO mcp_audit_logs (id, token_id, tool, arguments, outcome, denied_reason, duration_ms)
        VALUES (${crypto.randomUUID()}, ${token.id}, ${c.req.path}, null, 'denied', ${`missing scope: ${requiredScope}`}, 0)
      `).catch(() => undefined);

      return c.json(
        { error: "forbidden", requiredScope, role: token.role },
        403,
      );
    }

    c.set("mcpToken", token);
    await next();
  };
}

/**
 * Write a successful MCP tool-call audit entry. Called by MCP handlers.
 */
export async function auditMcpCall(
  db: DrizzleD1Database<typeof schema>,
  params: {
    tokenId: string | null;
    tool: string;
    args?: unknown;
    outcome?: "success" | "denied" | "error";
    deniedReason?: string;
    durationMs?: number;
  },
): Promise<void> {
  await db.run(sql`
    INSERT INTO mcp_audit_logs (id, token_id, tool, arguments, outcome, denied_reason, duration_ms)
    VALUES (
      ${crypto.randomUUID()}, ${params.tokenId}, ${params.tool},
      ${params.args ? JSON.stringify(params.args) : null},
      ${params.outcome ?? "success"}, ${params.deniedReason ?? null},
      ${params.durationMs ?? 0}
    )
  `).catch(() => undefined);
}

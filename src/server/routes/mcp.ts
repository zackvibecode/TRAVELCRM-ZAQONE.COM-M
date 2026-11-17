import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type * as schema from "../db/schema";
import { auditMcpCall } from "../middleware/mcp-auth";

type Env = {
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    mcpToken: schema.McpTokenRow;
  };
};

const mcpRouter = new Hono<Env>();

const PROTOCOL_VERSION = "2025-03-26";
const SERVER_INFO = { name: "zaqone-travel-crm-mcp", version: "1.0.0" };

interface RpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

/** MCP tools exposed to AI clients (read-only; scoped by token). */
const TOOLS = [
  {
    name: "search_customers",
    description: "Search customers by name or phone.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
    },
    requiredScope: "customers:read",
  },
  {
    name: "list_leads",
    description: "List CRM leads, optionally filtered by stage.",
    inputSchema: {
      type: "object",
      properties: { stage: { type: "string" }, limit: { type: "number" } },
    },
    requiredScope: "leads:read",
  },
  {
    name: "list_departures",
    description: "List upcoming departures and seat availability.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
    requiredScope: "departures:read",
  },
];

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/**
 * POST /mcp — JSON-RPC 2.0 Streamable endpoint.
 * Requires a valid bearer token (verified by mcpAuth on all methods except
 * initialize, which still validates the token but needs no specific scope).
 */
mcpRouter.post("/", async (c) => {
  const db = c.get("db");
  const body = await c.req.json<RpcRequest>().catch(() => ({} as RpcRequest));
  const { id, method, params } = body;

  // Handshake: validate token via mcpAuth semantics without requiring a scope.
  const token = await verifyTokenForMcp(db, c.req.header("Authorization"));
  if (!token) {
    return c.json(rpcError(id, -32001, "Unauthorized: invalid or expired MCP token"), 401);
  }

  const started = Date.now();
  const audit = (tool: string, outcome: "success" | "denied" | "error", reason?: string) =>
    auditMcpCall(db, {
      tokenId: token.id,
      tool,
      args: params,
      outcome,
      deniedReason: reason,
      durationMs: Date.now() - started,
    });

  // initialize — capability handshake.
  if (method === "initialize") {
    await audit("initialize", "success");
    return c.json(
      rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      }),
    );
  }

  // notifications/initialized — no response body required by JSON-RPC.
  if (method === "notifications/initialized") {
    return c.json(rpcResult(id, {}));
  }

  // tools/list — advertise tools allowed by this token's scopes.
  if (method === "tools/list") {
    const scopes = Array.isArray(token.scopes)
      ? token.scopes
      : typeof token.scopes === "string"
        ? JSON.parse(token.scopes)
        : [];
    const allowed = TOOLS.filter(
      (t) => scopes.includes(t.requiredScope) || scopes.includes("*"),
    );
    await audit("tools/list", "success");
    return c.json(
      rpcResult(id, {
        tools: allowed.map(({ requiredScope: _s, ...t }) => t),
      }),
    );
  }

  // tools/call — execute a read-only tool.
  if (method === "tools/call") {
    const name = String(params?.name ?? "");
    const args = (params?.arguments ?? {}) as Record<string, unknown>;
    const tool = TOOLS.find((t) => t.name === name);

    if (!tool) {
      await audit(name || "unknown", "error", "unknown tool");
      return c.json(rpcError(id, -32601, `Unknown tool: ${name}`));
    }

    // Scope check.
    const scopes = Array.isArray(token.scopes)
      ? token.scopes
      : typeof token.scopes === "string"
        ? JSON.parse(token.scopes)
        : [];
    if (!scopes.includes(tool.requiredScope) && !scopes.includes("*")) {
      await audit(name, "denied", `missing scope: ${tool.requiredScope}`);
      return c.json(
        rpcResult(id, {
          content: [{ type: "text", text: `Forbidden: missing scope ${tool.requiredScope}` }],
          isError: true,
        }),
      );
    }

    try {
      let text: string;
      if (name === "search_customers") {
        const q = String(args.query ?? "");
        const rows = await db.all<{ id: string; name: string; phone: string }>(sql`
          SELECT id, name, phone FROM customers
          WHERE name LIKE ${`%${q}%`} OR phone LIKE ${`%${q}%`}
          LIMIT 20
        `);
        text = JSON.stringify(rows);
      } else if (name === "list_leads") {
        const stage = args.stage ? String(args.stage) : null;
        const limit = Math.min(Number(args.limit) || 20, 100);
        const rows = await db.all<{ id: string; name: string; stage: string }>(sql`
          SELECT id, name, stage FROM leads
          WHERE ${stage ? sql`stage = ${stage}` : sql`1 = 1`}
          ORDER BY created_at DESC LIMIT ${limit}
        `);
        text = JSON.stringify(rows);
      } else if (name === "list_departures") {
        const limit = Math.min(Number(args.limit) || 20, 100);
        const rows = await db.all<{
          id: string;
          departureDate: string;
          status: string;
          seatsLeft: number;
        }>(sql`
          SELECT id, departure_date AS departureDate, status,
                 (seat_capacity - seats_booked - seats_held) AS seatsLeft
          FROM departures
          WHERE departure_date >= date('now')
          ORDER BY departure_date ASC LIMIT ${limit}
        `);
        text = JSON.stringify(rows);
      } else {
        text = "[]";
      }

      await audit(name, "success");
      return c.json(rpcResult(id, { content: [{ type: "text", text }] }));
    } catch (err) {
      await audit(name, "error", String(err));
      return c.json(rpcError(id, -32000, "tool execution failed"));
    }
  }

  return c.json(rpcError(id, -32601, `Method not found: ${method}`));
});

/** GET /mcp — handshake info / health for the endpoint. */
mcpRouter.get("/", (c) => {
  return c.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocolVersion: PROTOCOL_VERSION,
    transport: "JSON-RPC 2.0 over HTTP POST",
  });
});

/** Local verify helper reusing the mcp-admin verifier (no scope requirement). */
async function verifyTokenForMcp(
  db: DrizzleD1Database<typeof schema>,
  authHeader: string | undefined,
): Promise<schema.McpTokenRow | null> {
  const { verifyBearerToken } = await import("../routes/mcp-admin");
  return verifyBearerToken(db, authHeader);
}

export default mcpRouter;

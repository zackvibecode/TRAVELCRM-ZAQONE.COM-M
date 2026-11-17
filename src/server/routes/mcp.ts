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
    name: "get_booking",
    description: "Look up one booking by reference (e.g. ZQK-2026-0114).",
    inputSchema: {
      type: "object",
      properties: { reference: { type: "string" } },
      required: ["reference"],
    },
    requiredScope: "bookings:read",
  },
  {
    name: "list_bookings",
    description: "List bookings, optionally filtered by status.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string" }, limit: { type: "number" } },
    },
    requiredScope: "bookings:read",
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
  {
    name: "list_packages",
    description: "List published travel packages.",
    inputSchema: {
      type: "object",
      properties: { destination: { type: "string" }, limit: { type: "number" } },
    },
    requiredScope: "packages:read",
  },
  {
    name: "get_package",
    description: "Look up one published package by id, with its departure dates.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    requiredScope: "packages:read",
  },
  {
    name: "get_seat_availability",
    description: "Confirmed/held/available seats for one departure.",
    inputSchema: {
      type: "object",
      properties: { departureId: { type: "string" } },
      required: ["departureId"],
    },
    requiredScope: "seats:read",
  },
  {
    name: "get_invoice_balance",
    description: "Outstanding balance for an invoice number (no payment proofs).",
    inputSchema: {
      type: "object",
      properties: { number: { type: "string" } },
      required: ["number"],
    },
    requiredScope: "invoices:read",
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

  const tokenScopes = Array.isArray(token.scopes)
    ? token.scopes
    : typeof token.scopes === "string"
      ? JSON.parse(token.scopes)
      : [];
  const has = (scope: string) => tokenScopes.includes(scope) || tokenScopes.includes("*");

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
        capabilities: {
          tools: {},
          resources: { listChanged: false },
          prompts: { listChanged: false },
        },
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
    const allowed = TOOLS.filter((t) => has(t.requiredScope));
    await audit("tools/list", "success");
    return c.json(
      rpcResult(id, {
        tools: allowed.map(({ requiredScope: _s, ...t }) => t),
      }),
    );
  }

  // resources/list — read-only resources exposed by scope.
  if (method === "resources/list") {
    const resources: { uri: string; name: string; description: string; mimeType?: string }[] = [];
    if (has("packages:read"))
      resources.push({
        uri: "zaqone://packages",
        name: "Published packages",
        description: "Public travel package catalogue",
      });
    if (has("departures:read"))
      resources.push({
        uri: "zaqone://departures",
        name: "Upcoming departures",
        description: "Departure dates with seat availability",
      });
    if (has("invoices:read"))
      resources.push({
        uri: "zaqone://invoices",
        name: "Invoices",
        description: "Invoice records (no payment proofs)",
      });
    await audit("resources/list", "success");
    return c.json(rpcResult(id, { resources }));
  }

  // prompts/list — role-aware prompt templates (no sensitive data).
  if (method === "prompts/list") {
    const prompts: { name: string; description: string; arguments?: { name: string; required?: boolean }[] }[] = [
      {
        name: "summarize-bookings",
        description: "Summarize recent bookings for a date range",
        arguments: [{ name: "from", required: true }, { name: "to", required: true }],
      },
    ];
    if (has("leads:write"))
      prompts.push({
        name: "draft-lead-followup",
        description: "Draft a WhatsApp follow-up message for a lead",
        arguments: [{ name: "leadName", required: true }],
      });
    if (has("finance:read") || has("invoices:read"))
      prompts.push({
        name: "explain-outstanding",
        description: "Explain outstanding balances for a customer",
        arguments: [{ name: "customerName", required: true }],
      });
    await audit("prompts/list", "success");
    return c.json(rpcResult(id, { prompts }));
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

    if (!has(tool.requiredScope)) {
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
      } else if (name === "get_booking") {
        const reference = String(args.reference ?? "");
        const rows = await db.all<{
          id: string;
          reference: string;
          status: string;
          paymentStatus: string;
          totalAmount: number;
          paidAmount: number;
          balanceDue: number;
        }>(sql`
          SELECT id, reference, status, payment_status AS paymentStatus,
                 total_amount AS totalAmount, paid_amount AS paidAmount,
                 balance_due AS balanceDue
          FROM bookings WHERE reference = ${reference} LIMIT 1
        `);
        text = rows.length ? JSON.stringify(rows[0]) : JSON.stringify({ error: "booking not found" });
      } else if (name === "list_bookings") {
        const status = args.status ? String(args.status) : null;
        const limit = Math.min(Number(args.limit) || 20, 100);
        const rows = await db.all<{
          id: string;
          reference: string;
          status: string;
          paymentStatus: string;
          totalAmount: number;
          balanceDue: number;
        }>(sql`
          SELECT id, reference, status, payment_status AS paymentStatus,
                 total_amount AS totalAmount, balance_due AS balanceDue
          FROM bookings
          WHERE ${status ? sql`status = ${status}` : sql`1 = 1`}
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
      } else if (name === "list_packages") {
        const destination = args.destination ? String(args.destination) : null;
        const limit = Math.min(Number(args.limit) || 20, 100);
        const rows = await db.all<{
          id: string;
          name: string;
          destination: string;
          durationDays: number;
          adultPrice: number;
        }>(sql`
          SELECT id, name, destination, duration_days AS durationDays,
                 adult_price AS adultPrice
          FROM packages
          WHERE publish_status = 'published'
            ${destination ? sql`AND destination = ${destination}` : sql``}
          ORDER BY name ASC LIMIT ${limit}
        `);
        text = JSON.stringify(rows);
      } else if (name === "get_package") {
        const id = String(args.id ?? "");
        const rows = await db.all<{
          id: string;
          name: string;
          destination: string;
          durationDays: number;
          adultPrice: number;
          childPrice: number;
        }>(sql`
          SELECT id, name, destination, duration_days AS durationDays,
                 adult_price AS adultPrice, child_price AS childPrice
          FROM packages
          WHERE id = ${id} AND publish_status = 'published' LIMIT 1
        `);
        if (rows.length) {
          const departures = await db.all<{
            id: string;
            departureDate: string;
            seatsLeft: number;
          }>(sql`
            SELECT id, departure_date AS departureDate,
                   (seat_capacity - seats_booked - seats_held) AS seatsLeft
            FROM departures
            WHERE package_id = ${id} AND departure_date >= date('now')
            ORDER BY departure_date ASC
          `);
          text = JSON.stringify({ ...rows[0], departures });
        } else {
          text = JSON.stringify({ error: "package not found" });
        }
      } else if (name === "get_seat_availability") {
        const departureId = String(args.departureId ?? "");
        const rows = await db.all<{
          id: string;
          departureDate: string;
          seatCapacity: number;
          seatsBooked: number;
          seatsHeld: number;
          status: string;
        }>(sql`
          SELECT id, departure_date AS departureDate,
                 seat_capacity AS seatCapacity,
                 seats_booked AS seatsBooked, seats_held AS seatsHeld, status
          FROM departures WHERE id = ${departureId} LIMIT 1
        `);
        if (rows.length) {
          const d = rows[0];
          const capacity = Number(d.seatCapacity);
          const confirmed = Number(d.seatsBooked);
          const held = Number(d.seatsHeld);
          text = JSON.stringify({
            ...d,
            capacity,
            confirmed,
            held,
            available: Math.max(0, capacity - confirmed - held),
          });
        } else {
          text = JSON.stringify({ error: "departure not found" });
        }
      } else if (name === "get_invoice_balance") {
        const number = String(args.number ?? "");
        const rows = await db.all<{
          id: string;
          number: string;
          status: string;
          total: number;
          paidAmount: number;
          balanceDue: number;
          dueDate: string | null;
        }>(sql`
          SELECT id, number, status, total, paid_amount AS paidAmount,
                 balance_due AS balanceDue, due_date AS dueDate
          FROM invoices WHERE number = ${number} LIMIT 1
        `);
        text = rows.length ? JSON.stringify(rows[0]) : JSON.stringify({ error: "invoice not found" });
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

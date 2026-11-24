import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { auditMcpCall } from "../middleware/mcp-auth";
import { holdSeats } from "../lib/seat-availability";
import { generateBookingReference } from "../lib/reference";
import { firstFollowupAt } from "../lib/followup-schedule";

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
    name: "manage_package",
    description: "SUPER ADMIN ONLY: create or update a travel package. Itinerary is an array of {day,title,description,meals}. Use status published to make it live immediately.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        destination: { type: "string" },
        durationDays: { type: "number" },
        description: { type: "string" },
        highlights: { type: "array", items: { type: "string" } },
        itinerary: { type: "array", items: { type: "object" } },
        inclusions: { type: "array", items: { type: "string" } },
        exclusions: { type: "array", items: { type: "string" } },
        adultPrice: { type: "number" },
        childPrice: { type: "number" },
        infantPrice: { type: "number" },
        status: { type: "string", enum: ["draft", "published", "archived"] },
      },
      required: ["name", "destination", "durationDays"],
    },
    requiredScope: "admin:write",
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
  {
    name: "create_lead",
    description: "Create a new CRM lead (same validation as the dashboard).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        destination: { type: "string" },
        notes: { type: "string" },
      },
      required: ["name", "phone"],
    },
    requiredScope: "leads:write",
  },
  {
    name: "log_lead_activity",
    description: "Append an activity note to an existing lead.",
    inputSchema: {
      type: "object",
      properties: {
        leadId: { type: "string" },
        note: { type: "string" },
      },
      required: ["leadId", "note"],
    },
    requiredScope: "leads:write",
  },
  {
    name: "create_booking_draft",
    description: "Create a draft booking and temporarily hold seats (15 min).",
    inputSchema: {
      type: "object",
      properties: {
        customerId: { type: "string" },
        packageId: { type: "string" },
        departureId: { type: "string" },
        pax: { type: "number" },
      },
      required: ["customerId", "packageId", "departureId", "pax"],
    },
    requiredScope: "bookings:write",
  },
  {
    name: "add_payment_note",
    description: "Record a payment intent on an invoice — always pending verification (finance staff verifies).",
    inputSchema: {
      type: "object",
      properties: {
        invoiceNumber: { type: "string" },
        amount: { type: "number" },
        method: { type: "string" },
        reference: { type: "string" },
      },
      required: ["invoiceNumber", "amount"],
    },
    requiredScope: "invoices:write",
  },
  {
    name: "update_booking_status",
    description:
      "SUPER ADMIN ONLY: change a booking's status (draft → confirmed → completed, or cancel).",
    inputSchema: {
      type: "object",
      properties: {
        reference: { type: "string" },
        status: { type: "string", enum: ["draft", "confirmed", "completed", "cancelled"] },
      },
      required: ["reference", "status"],
    },
    requiredScope: "admin:write",
  },
  {
    name: "verify_payment",
    description:
      "SUPER ADMIN ONLY: verify or reject a pending payment. Finance normally does this; super admin can override.",
    inputSchema: {
      type: "object",
      properties: {
        paymentId: { type: "string" },
        decision: { type: "string", enum: ["verified", "rejected"] },
      },
      required: ["paymentId", "decision"],
    },
    requiredScope: "admin:write",
  },
  {
    name: "list_audit_logs",
    description: "SUPER ADMIN ONLY: recent staff/MCP audit log entries.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number" } },
    },
    requiredScope: "admin:read",
  },
  {
    name: "manage_website_page",
    description:
      "SUPER ADMIN ONLY: create or update a CMS page. id is optional for new pages (defaults to slug). status defaults to draft.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        slug: { type: "string" },
        title: { type: "string" },
        content: { type: "string", description: "JSON string of content blocks" },
        status: { type: "string", enum: ["draft", "published"] },
      },
      required: ["slug", "title", "content"],
    },
    requiredScope: "admin:write",
  },
];

/**
 * Purge the public content cache so a CMS write is visible on the website
 * immediately. Best-effort — a cache failure must never fail the mutation.
 */
async function purgeMcpContentCache(c: { req: { url: string } }): Promise<void> {
  try {
    const cache = (globalThis as unknown as { caches?: CacheStorage }).caches?.default;
    if (!cache) return;
    const origin = new URL(c.req.url).origin;
    const paths = [
      "/website/pages",
      "/website/banners",
      "/website/seo",
      "/website/packages",
      "/website/featured",
    ];
    await Promise.all(
      paths.map((p) => cache.delete(new Request(`${origin}${p}`)).catch(() => false)),
    );
  } catch {
    // best-effort
  }
}

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/**
 * Redact fields that MCP must never expose regardless of role (PRD requirement):
 * passport numbers/scans and payment proof keys/URLs. Even super_admin tokens
 * cannot read these through MCP — they are only available in the dashboard.
 */
function redactSensitive(text: string): string {
  const BLOCKED = [
    "passportNumber",
    "passport_number",
    "passportScan",
    "passport_scan",
    "proofKey",
    "proof_key",
    "proofUrl",
    "documentUrl",
  ];
  try {
    const scrub = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(scrub);
      if (value && typeof value === "object") {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([k]) => !BLOCKED.includes(k))
            .map(([k, v]) => [k, scrub(v)]),
        );
      }
      return value;
    };
    return JSON.stringify(scrub(JSON.parse(text)));
  } catch {
    return text; // non-JSON text: leave untouched (all tool outputs are JSON)
  }
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

  // Per-token rate limit (fixed 1-minute window, D1-backed).
  const rate = await checkRateLimit(db, token.id);
  if (!rate.allowed) {
    return new Response(
      JSON.stringify(
        rpcError(body.id, -32003, `Rate limit exceeded — retry in ${rate.retryAfter}s`),
      ),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfter),
        },
      },
    );
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
    await audit("notifications/initialized", "success");
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
    if (has("leads:read"))
      prompts.push({
        name: "daily-follow-up-list",
        description: "List today's leads due for follow-up with suggested messages",
        arguments: [{ name: "date", required: false }],
      });
    if (has("invoices:read"))
      prompts.push({
        name: "overdue-payment-digest",
        description: "Summarize overdue invoices and suggested reminder messages",
        arguments: [{ name: "days", required: false }],
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

    // Hard blocklist — destructive actions are NEVER exposed via MCP, per PRD.
    const DESTRUCTIVE = [
      "cancel_booking",
      "void_invoice",
      "process_refund",
      "delete_customer",
      "delete_lead",
      "release_seat_hold",
      "confirm_payment",
      "verify_payment",
    ];
    if (DESTRUCTIVE.includes(name)) {
      await audit(name, "denied", "destructive actions excluded from MCP");
      return c.json(
        rpcResult(id, {
          content: [
            { type: "text", text: "Forbidden: destructive actions are not available through MCP. Use the admin dashboard." },
          ],
          isError: true,
        }),
      );
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
      } else if (name === "manage_package") {
        if (token.role !== "super_admin") {
          await audit(name, "denied", "super_admin role required");
          return c.json(rpcResult(id, {
            content: [{ type: "text", text: "Forbidden: super_admin role required" }],
            isError: true,
          }));
        }
        const packageName = String(args.name ?? "").trim();
        const destination = String(args.destination ?? "").trim();
        const durationDays = Number(args.durationDays);
        if (!packageName || !destination || !Number.isInteger(durationDays) || durationDays < 1) {
          return c.json(rpcResult(id, {
            content: [{ type: "text", text: "Invalid: name, destination and positive durationDays are required" }],
            isError: true,
          }));
        }
        const packageId = String(args.id ?? "").trim() || crypto.randomUUID();
        const status = ["draft", "published", "archived"].includes(String(args.status))
          ? String(args.status)
          : "draft";
        const existingPackage = await db.get<{ id: string }>(sql`
          SELECT id FROM packages WHERE id = ${packageId} LIMIT 1
        `);
        const list = (key: string) => Array.isArray(args[key])
          ? (args[key] as unknown[]).filter((v) => typeof v === "string").map(String)
          : [];
        const values = {
          name: packageName,
          destination,
          durationDays,
          description: String(args.description ?? ""),
          highlights: JSON.stringify(list("highlights")),
          inclusions: JSON.stringify(list("inclusions")),
          exclusions: JSON.stringify(list("exclusions")),
          adultPrice: Math.max(0, Number(args.adultPrice) || 0),
          childPrice: Math.max(0, Number(args.childPrice) || 0),
          infantPrice: Math.max(0, Number(args.infantPrice) || 0),
        };
        if (existingPackage) {
          await db.run(sql`
            UPDATE packages SET name = ${values.name}, destination = ${values.destination},
              duration_days = ${values.durationDays}, description = ${values.description},
              highlights = ${values.highlights}, inclusions = ${values.inclusions},
              exclusions = ${values.exclusions}, adult_price = ${values.adultPrice},
              child_price = ${values.childPrice}, infant_price = ${values.infantPrice},
              publish_status = ${status}, updated_at = datetime('now')
            WHERE id = ${packageId}
          `);
        } else {
          await db.run(sql`
            INSERT INTO packages (id, name, destination, duration_days, description,
              highlights, itinerary, inclusions, exclusions, adult_price, child_price,
              infant_price, images, featured, publish_status, created_at, updated_at)
            VALUES (${packageId}, ${values.name}, ${values.destination}, ${values.durationDays},
              ${values.description}, ${values.highlights}, '[]', ${values.inclusions},
              ${values.exclusions}, ${values.adultPrice}, ${values.childPrice},
              ${values.infantPrice}, '[]', 0, ${status}, datetime('now'), datetime('now'))
          `);
        }
        if (Array.isArray(args.itinerary)) {
          const days = args.itinerary as Array<Record<string, unknown>>;
          await db.run(sql`DELETE FROM package_itinerary_items WHERE package_id = ${packageId}`);
          for (const [index, day] of days.entries()) {
            const meals = Array.isArray(day.meals) ? JSON.stringify(day.meals.map(String)) : "[]";
            await db.run(sql`
              INSERT INTO package_itinerary_items (id, package_id, day_number, title,
                description, meal_included, sort_order, created_at)
              VALUES (${crypto.randomUUID()}, ${packageId}, ${index + 1},
                ${String(day.title ?? "")}, ${String(day.description ?? "")},
                ${meals}, ${index + 1}, datetime('now'))
            `);
          }
        }
        await db.run(sql`
          INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
          VALUES (${crypto.randomUUID()}, ${`mcp:${token.id}`}, ${token.role},
            'mcp_manage_package', 'packages', ${packageId},
            ${`${existingPackage ? "updated" : "created"};status:${status}`}, datetime('now'))
        `).catch(() => undefined);
        text = JSON.stringify({
          id: packageId,
          name: packageName,
          status,
          url: `/site/packages/${packageId}`,
        });
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
      } else if (name === "create_lead") {
        const leadName = String(args.name ?? "").trim();
        const phone = String(args.phone ?? "").trim();
        if (!leadName || !/\d/.test(phone)) {
          await audit(name, "error", "invalid name or phone");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Invalid: name and a phone with digits are required" }],
              isError: true,
            }),
          );
        }
        const leadId = crypto.randomUUID();
        // MCP tools have no staff session — mandatory owner falls back to
        // the first super_admin (same rule as the 0027 backfill).
        const ownerRows = await db.all<{ id: string }>(sql`
          SELECT id FROM user WHERE role = 'super_admin' ORDER BY id LIMIT 1
        `);
        await db.insert(schema.leads).values({
          id: leadId,
          name: leadName,
          phone,
          email: args.email ? String(args.email) : null,
          destination: args.destination ? String(args.destination) : null,
          notes: args.notes ? String(args.notes) : null,
          stage: "new",
          ownerUserId: ownerRows[0]?.id ?? "unassigned",
          followupStatus: "new",
          followupState: "active",
          followupStage: "FU1",
          followupStageAt: new Date().toISOString(),
          // FU1 from config, snapped to KL business hours.
          nextFollowupAt: (await firstFollowupAt(db)).toISOString(),
        }).run();
        await db.run(sql`
          INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, at)
          VALUES (${crypto.randomUUID()}, ${`mcp:${token.id}`}, ${token.role}, 'mcp_create_lead', 'leads', ${leadId}, datetime('now'))
        `).catch(() => undefined);
        text = JSON.stringify({ id: leadId, name: leadName, stage: "new" });
      } else if (name === "log_lead_activity") {
        const leadId = String(args.leadId ?? "");
        const note = String(args.note ?? "").trim();
        if (!leadId || !note) {
          await audit(name, "error", "leadId and note required");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Invalid: leadId and note are required" }],
              isError: true,
            }),
          );
        }
        const exists = await db.all<{ id: string }>(sql`
          SELECT id FROM leads WHERE id = ${leadId} LIMIT 1
        `);
        if (!exists.length) {
          await audit(name, "error", "lead not found");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Lead not found" }],
              isError: true,
            }),
          );
        }
        const activityId = crypto.randomUUID();
        await db.insert(schema.leadActivities).values({
          id: activityId,
          leadId,
          type: "note",
          text: note,
          user: `mcp:${token.id}`,
        }).run();
        await db.run(sql`
          UPDATE leads SET last_activity_at = datetime('now'), updated_at = datetime('now')
          WHERE id = ${leadId}
        `).catch(() => undefined);
        text = JSON.stringify({ id: activityId, leadId, type: "note" });
      } else if (name === "create_booking_draft") {
        const customerId = String(args.customerId ?? "");
        const packageId = String(args.packageId ?? "");
        const departureId = String(args.departureId ?? "");
        const pax = Number(args.pax) || 0;

        if (!customerId || !packageId || !departureId || pax < 1) {
          await audit(name, "error", "invalid draft parameters");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Invalid: customerId, packageId, departureId and pax>=1 are required" }],
              isError: true,
            }),
          );
        }

        // Atomic seat hold first — never create a draft without inventory.
        const hold = await holdSeats(db, departureId, pax, `mcp:${token.id}`);
        if (!hold.ok) {
          await audit(name, "denied", `seat hold failed: ${hold.reason}`);
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: `Cannot hold seats: ${hold.reason}` }],
              isError: true,
            }),
          );
        }

        const bookingId = crypto.randomUUID();
        const reference = generateBookingReference();
        await db.insert(schema.bookings).values({
          id: bookingId,
          reference,
          customerId,
          packageId,
          departureId,
          type: pax > 1 ? "group" : "individual",
          status: "draft",
          paxAdult: pax,
          createdBy: `mcp:${token.id}`,
        }).run();
        await db.run(sql`
          INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
          VALUES (${crypto.randomUUID()}, ${`mcp:${token.id}`}, ${token.role}, 'mcp_create_booking_draft', 'bookings', ${bookingId}, ${`hold:${hold.holdId}`}, datetime('now'))
        `).catch(() => undefined);

        text = JSON.stringify({
          id: bookingId,
          reference,
          status: "draft",
          seatHoldId: hold.holdId,
          holdExpiresInMinutes: 15,
          seatsAvailable: hold.seatsAvailable,
        });
      } else if (name === "add_payment_note") {
        const invoiceNumber = String(args.invoiceNumber ?? "");
        const amount = Number(args.amount) || 0;
        const method = String(args.method ?? "bank_transfer");
        const validMethods = ["bank_transfer", "credit_card", "cash", "ewallet", "other"];

        if (!invoiceNumber || amount <= 0 || !validMethods.includes(method)) {
          await audit(name, "error", "invalid payment note parameters");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Invalid: invoiceNumber, amount>0 and a valid method are required" }],
              isError: true,
            }),
          );
        }

        const invoice = await db.all<{ id: string; bookingId: string | null }>(sql`
          SELECT id, booking_id AS bookingId FROM invoices WHERE number = ${invoiceNumber} LIMIT 1
        `);
        if (!invoice.length) {
          await audit(name, "error", "invoice not found");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Invoice not found" }],
              isError: true,
            }),
          );
        }

        // MCP can only stage a payment — verification stays with finance staff.
        const paymentId = crypto.randomUUID();
        await db.insert(schema.payments).values({
          id: paymentId,
          invoiceId: invoice[0].id,
          amount,
          method: method as "bank_transfer" | "credit_card" | "cash" | "ewallet" | "other",
          status: "pending_verification",
          reference: args.reference ? String(args.reference) : null,
          createdBy: `mcp:${token.id}`,
        }).run();
        await db.run(sql`
          INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
          VALUES (${crypto.randomUUID()}, ${`mcp:${token.id}`}, ${token.role}, 'mcp_stage_payment', 'payments', ${paymentId}, ${`invoice:${invoiceNumber}`}, datetime('now'))
        `).catch(() => undefined);

        text = JSON.stringify({
          id: paymentId,
          invoiceNumber,
          amount,
          status: "pending_verification",
          note: "Finance staff must verify before it counts as collected.",
        });
      } else if (name === "update_booking_status") {
        if (token.role !== "super_admin") {
          await audit(name, "denied", "super_admin role required");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Forbidden: super_admin role required" }],
              isError: true,
            }),
          );
        }
        const reference = String(args.reference ?? "");
        const status = String(args.status ?? "");
        const valid = ["draft", "confirmed", "completed", "cancelled"];
        if (!reference || !valid.includes(status)) {
          await audit(name, "error", "invalid parameters");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: `Invalid: reference and status (${valid.join("|")}) are required` }],
              isError: true,
            }),
          );
        }
        const updated = await db.all<{ id: string }>(sql`
          UPDATE bookings SET status = ${status}, updated_at = datetime('now')
          WHERE reference = ${reference}
          RETURNING id
        `);
        if (!updated.length) {
          await audit(name, "error", "booking not found");
          return c.json(
            rpcResult(id, { content: [{ type: "text", text: "Booking not found" }], isError: true }),
          );
        }
        await db.run(sql`
          INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
          VALUES (${crypto.randomUUID()}, ${`mcp:${token.id}`}, ${token.role}, 'mcp_update_booking_status', 'bookings', ${updated[0].id}, ${`status:${status}`}, datetime('now'))
        `).catch(() => undefined);
        text = JSON.stringify({ reference, status, updated: true });
      } else if (name === "verify_payment") {
        if (token.role !== "super_admin") {
          await audit(name, "denied", "super_admin role required");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Forbidden: super_admin role required" }],
              isError: true,
            }),
          );
        }
        const paymentId = String(args.paymentId ?? "");
        const decision = String(args.decision ?? "");
        if (!paymentId || !["verified", "rejected"].includes(decision)) {
          await audit(name, "error", "invalid parameters");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Invalid: paymentId and decision (verified|rejected) are required" }],
              isError: true,
            }),
          );
        }
        const updated = await db.all<{ id: string }>(sql`
          UPDATE payments SET status = ${decision}, verified_at = datetime('now'),
            verified_by = ${`mcp:${token.id}`}
          WHERE id = ${paymentId} AND status = 'pending_verification'
          RETURNING id
        `);
        if (!updated.length) {
          await audit(name, "error", "pending payment not found");
          return c.json(
            rpcResult(id, { content: [{ type: "text", text: "Pending payment not found" }], isError: true }),
          );
        }
        await db.run(sql`
          INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
          VALUES (${crypto.randomUUID()}, ${`mcp:${token.id}`}, ${token.role}, 'mcp_verify_payment', 'payments', ${paymentId}, ${`decision:${decision}`}, datetime('now'))
        `).catch(() => undefined);
        text = JSON.stringify({ paymentId, status: decision });
      } else if (name === "list_audit_logs") {
        if (token.role !== "super_admin") {
          await audit(name, "denied", "super_admin role required");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Forbidden: super_admin role required" }],
              isError: true,
            }),
          );
        }
        const limit = Math.min(Number(args.limit) || 50, 200);
        const rows = await db.all(sql`
          SELECT id, actor, role, action, entity_type AS entityType, entity_id AS entityId, detail, at
          FROM audit_logs ORDER BY at DESC LIMIT ${limit}
        `);
        text = JSON.stringify(rows);
      } else if (name === "manage_website_page") {
        if (token.role !== "super_admin") {
          await audit(name, "denied", "super_admin role required");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Forbidden: super_admin role required" }],
              isError: true,
            }),
          );
        }
        const slug = String(args.slug ?? "").trim();
        const pageId = String(args.id ?? slug).trim();
        const pageTitle = String(args.title ?? "");
        const content = String(args.content ?? "");
        const status = args.status === "published" ? "published" : "draft";
        if (!pageId || !slug || !pageTitle || !content) {
          await audit(name, "error", "invalid parameters");
          return c.json(
            rpcResult(id, {
              content: [{ type: "text", text: "Invalid: id, slug, title and content (JSON string) are required" }],
              isError: true,
            }),
          );
        }
        // Validate content parses as JSON before writing.
        try {
          JSON.parse(content);
        } catch {
          await audit(name, "error", "content is not valid JSON");
          return c.json(
            rpcResult(id, { content: [{ type: "text", text: "content must be valid JSON" }], isError: true }),
          );
        }
        const existing = await db.all<{ id: string }>(sql`
          SELECT id FROM site_pages WHERE id = ${pageId} OR slug = ${slug} LIMIT 1
        `);
        if (existing.length) {
          // A different page may already own this slug — release it first so the
          // UNIQUE index on site_pages.slug does not abort the update.
          await db.run(sql`
            UPDATE site_pages SET slug = ${slug}, title = ${pageTitle}, content = ${content},
              status = ${status}, updated_at = datetime('now') WHERE id = ${existing[0].id}
          `);
        } else {
          await db.run(sql`
            INSERT INTO site_pages (id, slug, title, content, status, updated_at)
            VALUES (${pageId}, ${slug}, ${pageTitle}, ${content}, ${status}, datetime('now'))
          `);
        }
        await purgeMcpContentCache(c);
        await db.run(sql`
          INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
          VALUES (${crypto.randomUUID()}, ${`mcp:${token.id}`}, ${token.role}, 'mcp_manage_website_page', 'site_pages', ${pageId}, ${`status:${status}`}, datetime('now'))
        `).catch(() => undefined);
        text = JSON.stringify({ id: pageId, slug, title: pageTitle, status });
      } else {
        text = "[]";
      }

      await audit(name, "success");
      return c.json(
        rpcResult(id, { content: [{ type: "text", text: redactSensitive(text) }] }),
      );
    } catch (err) {
      await audit(name, "error", String(err));
      const detail = err instanceof Error ? err.message : String(err);
      await audit(name, "error", detail);
      return c.json(rpcError(id, -32000, `tool execution failed: ${detail}`));
    }
  }

  await audit(String(method ?? "unknown"), "error", "unknown method");
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

/**
 * Fixed-window per-token rate limit (120 calls / minute), backed by D1.
 * Returns true when allowed, false when the caller must back off.
 */
async function checkRateLimit(
  db: DrizzleD1Database<typeof schema>,
  tokenId: string,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const windowStart = new Date(Math.floor(Date.now() / 60000) * 60000)
    .toISOString()
    .slice(0, 16);
  const LIMIT = 120;

  const rows = await db.all<{ id: string; count: number }>(sql`
    SELECT id, count FROM mcp_rate_limits
    WHERE token_id = ${tokenId} AND window_start = ${windowStart}
    LIMIT 1
  `);

  if (rows.length === 0) {
    await db.run(sql`
      INSERT INTO mcp_rate_limits (id, token_id, window_start, count)
      VALUES (${crypto.randomUUID()}, ${tokenId}, ${windowStart}, 1)
    `).catch(() => undefined);
    return { allowed: true, retryAfter: 0 };
  }

  if (rows[0].count >= LIMIT) {
    const retryAfter = 60 - (Math.floor(Date.now() / 1000) % 60);
    return { allowed: false, retryAfter };
  }

  await db.run(sql`
    UPDATE mcp_rate_limits SET count = count + 1
    WHERE id = ${rows[0].id}
  `).catch(() => undefined);
  return { allowed: true, retryAfter: 0 };
}

export default mcpRouter;

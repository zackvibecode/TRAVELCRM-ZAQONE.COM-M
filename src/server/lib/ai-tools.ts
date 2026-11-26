import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { AiToolDef } from "./ai-client";

/**
 * Tools the CRM AI assistant can call. The agent gets the job DONE — it
 * publishes records directly and returns a real URL for each result so the
 * user can click straight through. It can never delete, capture payments or
 * cancel a booking, but it does not leave work sitting in a draft queue.
 */

export interface ToolContext {
  db: DrizzleD1Database<typeof schema>;
  /** Staff member on whose behalf the agent acts. */
  actor: { id: string; email: string; role: string };
}

export interface ToolResult {
  ok: boolean;
  data: unknown;
  /** Human-readable summary shown in the chat transcript. */
  summary: string;
  /** True when the tool created or changed a record. */
  mutation?: boolean;
  /** Direct link to the created/updated record, shown as a clickable chip. */
  url?: string;
  /** Label for the link chip. */
  urlLabel?: string;
}

export const AI_TOOLS: AiToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_leads",
      description:
        "List CRM leads, newest first. Filter by stage, source or owner. Use this when the user asks about new enquiries or pipeline status.",
      parameters: {
        type: "object",
        properties: {
          stage: { type: "string", description: "Stage filter, e.g. new, contacted, quoted" },
          source: { type: "string" },
          limit: { type: "number", description: "Max rows (default 20, max 100)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_customers",
      description: "Search customers by name, phone or email.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_bookings",
      description:
        "List bookings with their status and amount. Filter by status (draft, confirmed, completed, cancelled).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "number", description: "Max rows (default 20, max 100)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_packages",
      description:
        "List travel packages with destination, duration and price. Filter by destination.",
      parameters: {
        type: "object",
        properties: {
          destination: { type: "string" },
          limit: { type: "number", description: "Max rows (default 20, max 100)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_departures",
      description: "List upcoming departures with seat capacity and seats remaining.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "Max rows (default 20, max 100)" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_invoice_balance",
      description: "Outstanding balance for one invoice number.",
      parameters: {
        type: "object",
        properties: { number: { type: "string" } },
        required: ["number"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description:
        "Create a new CRM lead. Use when the user provides contact details for a new enquiry. The lead is saved immediately — return its URL.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          destination: { type: "string" },
          source: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name", "phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_lead_activity",
      description: "Append a note, call log or follow-up reminder to an existing lead.",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          note: { type: "string" },
        },
        required: ["leadId", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_booking",
      description:
        "Create a CONFIRMED booking and deduct the seats from availability (only if enough seats are left). Never charges money — payment is handled separately. Return the booking URL.",
      parameters: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          packageId: { type: "string" },
          departureId: { type: "string" },
          pax: { type: "number" },
        },
        required: ["customerId", "packageId", "departureId", "pax"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_package",
      description:
        "Get one package with its full day-by-day itinerary, highlights, inclusions, exclusions and prices. Use this before updating a package.",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_dashboard_kpis",
      description:
        "Get the CRM dashboard KPIs — revenue, bookings, leads, occupancy and outstanding balance. Use this for 'how is the business doing' questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_invoices",
      description: "List invoices with status, customer and amounts. Filter by status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "number", description: "Max rows (default 20, max 100)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_quotations",
      description: "List quotations with status, customer and totals.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "number", description: "Max rows (default 20, max 100)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_payments",
      description: "List payments with method, status and amount. Filter by status.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string" },
          limit: { type: "number", description: "Max rows (default 20, max 100)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_website_pages",
      description:
        "List CMS website pages with slug, title and publish status. Use this to find the page id for a slug before editing it.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_package",
      description:
        "UPDATE an existing package. Only the fields you pass are changed. Use this for price changes, itinerary edits, name/destination corrections, highlights, inclusions and exclusions. It does NOT create a new package — use create_package_from_itinerary for that.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The package id (get it from list_packages)" },
          name: { type: "string" },
          destination: { type: "string" },
          durationDays: { type: "number" },
          description: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          inclusions: { type: "array", items: { type: "string" } },
          exclusions: { type: "array", items: { type: "string" } },
          adultPrice: { type: "number" },
          childPrice: { type: "number" },
          infantPrice: { type: "number" },
          itinerary: {
            type: "array",
            description: "Full replacement itinerary, in order. Provide every day you want kept.",
            items: {
              type: "object",
              properties: {
                dayNumber: { type: "number" },
                title: { type: "string" },
                description: { type: "string" },
                mealIncluded: { type: "array", items: { type: "string" } },
              },
              required: ["title"],
            },
          },
          status: { type: "string", enum: ["draft", "published", "archived"] },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_departure",
      description:
        "UPDATE an existing departure (travel date) — change its date, return date, seat capacity or prices. Use this when the user wants to move or reprice a scheduled trip.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "The departure id" },
          departureDate: { type: "string", description: "YYYY-MM-DD" },
          returnDate: { type: "string", description: "YYYY-MM-DD" },
          seatCapacity: { type: "number" },
          adultPrice: { type: "number" },
          childPrice: { type: "number" },
          infantPrice: { type: "number" },
          status: { type: "string", enum: ["open", "almost_full", "full", "closed", "cancelled"] },
          tourLeader: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_departure",
      description:
        "Schedule a new departure (travel date) for a package with its return date, seat capacity and prices.",
      parameters: {
        type: "object",
        properties: {
          packageId: { type: "string" },
          departureDate: { type: "string", description: "YYYY-MM-DD" },
          returnDate: { type: "string", description: "YYYY-MM-DD" },
          seatCapacity: { type: "number" },
          adultPrice: { type: "number" },
          childPrice: { type: "number" },
          infantPrice: { type: "number" },
          tourLeader: { type: "string" },
        },
        required: ["packageId", "departureDate", "returnDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description:
        "UPDATE a lead — stage, contact details, destination, pax, budget, owner or notes. Use this to move a lead along the pipeline.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          stage: { type: "string", enum: ["new", "contacted", "qualified", "quotation", "won", "lost"] },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          destination: { type: "string" },
          pax: { type: "number" },
          budget: { type: "number" },
          assignedTo: { type: "string" },
          nextFollowUp: { type: "string" },
          notes: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_customer",
      description: "UPDATE a customer record — name, phone, email, city or notes.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          city: { type: "string" },
          notes: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_customer",
      description: "Create a new customer record in the CRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          city: { type: "string" },
          type: { type: "string", enum: ["individual", "corporate"] },
          notes: { type: "string" },
        },
        required: ["name", "phone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_booking",
      description:
        "UPDATE a booking — passenger counts, status or contact details. Use 'hold' to place a booking on hold, 'confirmed' to confirm it. Never takes payment.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          paxAdult: { type: "number" },
          paxChild: { type: "number" },
          paxInfant: { type: "number" },
          status: { type: "string", enum: ["draft", "hold", "pending_deposit", "confirmed", "cancelled", "completed"] },
          customerId: { type: "string" },
          departureId: { type: "string" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_invoice",
      description:
        "Create an invoice for a booking with line items. It is created as issued. Use this when the user asks to bill a customer.",
      parameters: {
        type: "object",
        properties: {
          bookingId: { type: "string" },
          customerName: { type: "string" },
          packageName: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unitPrice: { type: "number" },
              },
              required: ["description", "quantity", "unitPrice"],
            },
          },
          notes: { type: "string" },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_quotation",
      description: "Create a quotation (price proposal) for a lead with pax, destination and total.",
      parameters: {
        type: "object",
        properties: {
          leadId: { type: "string" },
          customerName: { type: "string" },
          customerPhone: { type: "string" },
          packageName: { type: "string" },
          destination: { type: "string" },
          paxAdult: { type: "number" },
          paxChild: { type: "number" },
          paxInfant: { type: "number" },
          departureDate: { type: "string", description: "YYYY-MM-DD" },
          totalAmount: { type: "number" },
          notes: { type: "string" },
        },
        required: ["customerName", "customerPhone", "packageName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_website_page",
      description:
        "UPDATE an existing CMS website page by id or slug — title, content blocks and publish status. Use list_website_pages to find the id first.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          slug: { type: "string" },
          title: { type: "string" },
          content: { type: "string", description: "JSON string of { title, summary, blocks }" },
          status: { type: "string", enum: ["draft", "published"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_site_seo",
      description:
        "Update the SEO meta title, description and keywords for a website page slug.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string" },
          metaTitle: { type: "string" },
          metaDescription: { type: "string" },
          keywords: { type: "string" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_banner",
      description:
        "Create or update a website banner (promo strip) — title, subtitle, CTA label, CTA link and active dates.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          subtitle: { type: "string" },
          ctaLabel: { type: "string" },
          ctaHref: { type: "string" },
          startAt: { type: "string" },
          endAt: { type: "string" },
          active: { type: "boolean" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_banners",
      description: "List website banners with their titles, CTA links and active window.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_alerts",
      description:
        "List CRM alerts — overdue invoices, departures that need attention and expiring holds.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_suppliers",
      description: "List suppliers and their contact details.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_staff",
      description: "List staff members with their role and status.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_website_images",
      description: "List uploaded website images with their URLs.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_departure_manifest",
      description:
        "Get the passenger manifest for one departure — names, contact details and booking references.",
      parameters: {
        type: "object",
        properties: { departureId: { type: "string" } },
        required: ["departureId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_checklist",
      description: "Get the operational checklist for one departure (documents, tasks, gear to prepare).",
      parameters: {
        type: "object",
        properties: { departureId: { type: "string" } },
        required: ["departureId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_departure_costs",
      description: "Get supplier costs recorded against one departure and the resulting profit margin.",
      parameters: {
        type: "object",
        properties: { departureId: { type: "string" } },
        required: ["departureId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_settings",
      description:
        "Get the CRM settings groups (company profile, site branding, AI setup, booking defaults, document numbering, notification templates). Returns stored values, never secrets.",
      parameters: {
        type: "object",
        properties: { key: { type: "string", description: "Optional group key, e.g. company, site, ai, booking" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_settings",
      description:
        "Update a CRM settings group. Only the keys you pass are changed. Used for company profile, site branding and booking defaults.",
      parameters: {
        type: "object",
        properties: {
          key: { type: "string", description: "Group key, e.g. company, site, booking" },
          value: { type: "object", description: "Partial object of settings to merge" },
        },
        required: ["key", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_audit_logs",
      description: "SUPER ADMIN ONLY: recent staff and AI audit log entries — who changed what and when.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_package_from_itinerary",
      description:
        "Create a travel package from a structured itinerary (name, destination, duration, day-by-day plan, prices, inclusions) and PUBLISH it so it appears on the public website. Use after parsing a PDF itinerary supplied by the user. Return the package URL.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          destination: { type: "string" },
          durationDays: { type: "number" },
          description: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          inclusions: { type: "array", items: { type: "string" } },
          exclusions: { type: "array", items: { type: "string" } },
          adultPrice: { type: "number" },
          childPrice: { type: "number" },
          infantPrice: { type: "number" },
          itinerary: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dayNumber: { type: "number" },
                title: { type: "string" },
                description: { type: "string" },
                mealIncluded: { type: "array", items: { type: "string" } },
              },
              required: ["dayNumber", "title"],
            },
          },
        },
        required: ["name", "destination", "durationDays", "itinerary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_website_page",
      description:
        "Create and PUBLISH a public website page for a package (title, slug, structured content blocks with itinerary, pricing, inclusions, CTA). The page goes live immediately. Return the public page URL.",
      parameters: {
        type: "object",
        properties: {
          packageId: { type: "string" },
          title: { type: "string" },
          slug: { type: "string" },
          summary: { type: "string" },
          itinerary: {
            type: "array",
            items: {
              type: "object",
              properties: {
                dayNumber: { type: "number" },
                title: { type: "string" },
                description: { type: "string" },
                mealIncluded: { type: "array", items: { type: "string" } },
              },
              required: ["dayNumber", "title"],
            },
          },
          highlights: { type: "array", items: { type: "string" } },
          inclusions: { type: "array", items: { type: "string" } },
          exclusions: { type: "array", items: { type: "string" } },
          adultPrice: { type: "number" },
          childPrice: { type: "number" },
          infantPrice: { type: "number" },
          coverImageUrl: { type: "string" },
        },
        required: ["title", "slug", "summary"],
      },
    },
  },
];

/** Parse a tool-call argument string into a plain object. */
export function parseArgs(args: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(args || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

/**
 * Execute one AI tool call against D1.
 */
export async function runAiTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const db = ctx.db;

  switch (name) {
    case "list_leads": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const stage = str(args.stage);
      const rows = await db.all(sql`
        SELECT l.id, l.name, l.phone, l.email, l.destination, l.stage,
               s.name AS source, l.assigned_to AS assignedTo, l.created_at AS createdAt
        FROM leads l
        LEFT JOIN lead_sources s ON s.id = l.source_id
        WHERE 1 = 1
          ${stage ? sql`AND l.stage = ${stage}` : sql``}
        ORDER BY l.created_at DESC
        LIMIT ${limit}
      `);
      return {
        ok: true,
        data: rows,
        summary: `${rows.length} lead(s) found`,
      };
    }

    case "search_customers": {
      const query = str(args.query);
      const rows = await db.all(sql`
        SELECT id, name, phone, email, created_at AS createdAt
        FROM customers
        WHERE name LIKE ${`%${query}%`}
           OR phone LIKE ${`%${query}%`}
           OR email LIKE ${`%${query}%`}
        LIMIT 50
      `);
      return { ok: true, data: rows, summary: `${rows.length} customer(s) matched "${query}"` };
    }

    case "list_bookings": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const status = str(args.status);
      const rows = await db.all(sql`
        SELECT b.id, b.reference, b.status, b.pax_adult, b.total_amount AS totalAmount,
               p.name AS packageName, c.name AS customerName, d.departure_date AS departureDate
        FROM bookings b
        LEFT JOIN packages p ON p.id = b.package_id
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN departures d ON d.id = b.departure_id
        WHERE 1 = 1
          ${status ? sql`AND b.status = ${status}` : sql``}
        ORDER BY b.created_at DESC
        LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} booking(s)` };
    }

    case "list_packages": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const destination = str(args.destination);
      const rows = await db.all(sql`
        SELECT id, name, destination, duration_days AS durationDays,
               adult_price AS adultPrice, publish_status AS publishStatus
        FROM packages
        WHERE 1 = 1
          ${destination ? sql`AND destination = ${destination}` : sql``}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} package(s)` };
    }

    case "list_departures": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const rows = await db.all(sql`
        SELECT d.id, d.departure_date AS departureDate, d.return_date AS returnDate,
               d.seat_capacity AS seatCapacity, d.seats_booked AS seatsBooked,
               d.seats_held AS seatsHeld, d.status, p.name AS packageName
        FROM departures d
        LEFT JOIN packages p ON p.id = d.package_id
        WHERE d.departure_date >= date('now')
          AND d.status NOT IN ('cancelled','closed')
        ORDER BY d.departure_date ASC
        LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} upcoming departure(s)` };
    }

    case "get_invoice_balance": {
      const number = str(args.number);
      const rows = await db.all(sql`
        SELECT i.id, i.number, i.total AS totalAmount, i.customerName AS customerName,
               COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END), 0) AS paidAmount
        FROM invoices i
        LEFT JOIN payments p ON p.invoice_id = i.id
        WHERE i.number = ${number}
        GROUP BY i.id
      `);
      if (!rows.length) {
        return { ok: false, data: null, summary: `Invoice ${number} not found` };
      }
      const row = rows[0] as unknown as { totalAmount: number; paidAmount: number };
      const balance = Number(row.totalAmount) - Number(row.paidAmount);
      return {
        ok: true,
        data: { ...(row as unknown as Record<string, unknown>), balance },
        summary: `Invoice ${number}: total ${row.totalAmount}, paid ${row.paidAmount}, balance ${balance}`,
      };
    }

    case "create_lead": {
      const name = str(args.name);
      const phone = str(args.phone);
      if (!name || !phone) {
        return { ok: false, data: null, summary: "name and phone are required" };
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const sourceName = str(args.source) || "AI Assistant";
      const sourceRow = await db.all<{ id: string }>(sql`
        SELECT id FROM lead_sources WHERE name = ${sourceName} LIMIT 1
      `);
      let sourceId = sourceRow[0]?.id ?? null;
      if (!sourceId) {
        sourceId = crypto.randomUUID();
        await db.run(sql`
          INSERT INTO lead_sources (id, name, description, active, created_at)
          VALUES (${sourceId}, ${sourceName}, ${"Created by the AI assistant"}, 1, ${now})
        `);
      }
      await db.run(sql`
        INSERT INTO leads (id, name, phone, email, destination, stage, source_id, assigned_to, notes, created_at, updated_at)
        VALUES (
          ${id}, ${name}, ${phone}, ${str(args.email) || null}, ${str(args.destination) || null},
          'new', ${sourceId}, ${ctx.actor.email},
          ${str(args.notes) || null}, ${now}, ${now}
        )
      `);
      return {
        ok: true,
        mutation: true,
        data: { id, name, phone },
        url: `/lead-management`,
        urlLabel: name,
        summary: `Lead "${name}" created and saved to the CRM`,
      };
    }

    case "log_lead_activity": {
      const leadId = str(args.leadId);
      const note = str(args.note);
      if (!leadId || !note) {
        return { ok: false, data: null, summary: "leadId and note are required" };
      }
      const exists = await db.all<{ id: string }>(sql`
        SELECT id FROM leads WHERE id = ${leadId} LIMIT 1
      `);
      if (!exists.length) {
        return { ok: false, data: null, summary: "Lead not found" };
      }
      const activityId = crypto.randomUUID();
      await db.run(sql`
        INSERT INTO lead_activities (id, lead_id, type, text, user, at)
        VALUES (${activityId}, ${leadId}, 'note', ${note}, ${`ai:${ctx.actor.email}`}, ${new Date().toISOString()})
      `);
      await db.run(sql`
        UPDATE leads SET last_activity_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ${leadId}
      `);
      return {
        ok: true,
        mutation: true,
        data: { id: activityId, leadId },
        url: `/lead-management`,
        urlLabel: "Buka Leads",
        summary: `Activity note added to lead ${leadId}`,
      };
    }

    case "create_booking_draft": {
      const customerId = str(args.customerId);
      const packageId = str(args.packageId);
      const departureId = str(args.departureId);
      const pax = num(args.pax);
      if (!customerId || !packageId || !departureId || pax < 1) {
        return {
          ok: false,
          data: null,
          summary: "customerId, packageId, departureId and pax>=1 are required",
        };
      }
      const departure = await db.all<{
        id: string;
        seatCapacity: number;
        seatsBooked: number;
        seatsHeld: number;
      }>(sql`
        SELECT id, seat_capacity AS seatCapacity, seats_booked AS seatsBooked, seats_held AS seatsHeld
        FROM departures WHERE id = ${departureId} LIMIT 1
      `);
      if (!departure.length) {
        return { ok: false, data: null, summary: "Departure not found" };
      }
      const d = departure[0];
      const seatsLeft = Number(d.seatCapacity) - Number(d.seatsBooked) - Number(d.seatsHeld);
      if (seatsLeft < pax) {
        return {
          ok: false,
          data: null,
          summary: `Not enough seats: ${seatsLeft} left, ${pax} requested`,
        };
      }
      const id = crypto.randomUUID();
      const reference = `ZQK-${new Date().getFullYear()}-${id.slice(0, 4).toUpperCase()}`;
      const now = new Date().toISOString();
      await db.run(sql`
        INSERT INTO bookings (id, reference, customer_id, package_id, departure_id, type, status, pax_adult, created_by, created_at, updated_at)
        VALUES (
          ${id}, ${reference}, ${customerId}, ${packageId}, ${departureId},
          ${pax > 1 ? "group" : "individual"}, 'confirmed', ${pax}, ${`ai:${ctx.actor.email}`}, ${now}, ${now}
        )
      `);
      // Confirmed booking deducts real seats (not a temporary hold).
      await db.run(sql`
        UPDATE departures
        SET seats_booked = seats_booked + ${pax},
            status = CASE
              WHEN seat_capacity - seats_booked - seats_held - ${pax} <= 0 THEN 'full'
              WHEN seat_capacity - seats_booked - seats_held - ${pax} <= 4 THEN 'almost_full'
              ELSE status END
        WHERE id = ${departureId}
      `);
      await db.run(sql`
        INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
        VALUES (${crypto.randomUUID()}, ${`ai:${ctx.actor.email}`}, ${ctx.actor.role},
                'ai_create_booking_confirmed', 'bookings', ${id}, ${`pax:${pax}`}, datetime('now'))
      `);
      return {
        ok: true,
        mutation: true,
        data: { id, reference, pax },
        url: `/bookings`,
        urlLabel: reference,
        summary: `Booking ${reference} confirmed for ${pax} pax — seats deducted`,
      };
    }

    case "get_package": {
      const id = str(args.id);
      const rows = await db.all<Record<string, unknown>>(sql`
        SELECT id, name, destination, duration_days AS durationDays, description,
               highlights, inclusions, exclusions,
               adult_price AS adultPrice, child_price AS childPrice,
               infant_price AS infantPrice, publish_status AS publishStatus,
               images, cover_image_url AS coverImageUrl
        FROM packages WHERE id = ${id} LIMIT 1
      `);
      if (!rows.length) {
        return { ok: false, data: null, summary: `Package ${id} not found` };
      }
      const itinerary = await db.all(sql`
        SELECT day_number AS dayNumber, title, description,
               meal_included AS mealIncluded
        FROM package_itinerary_items
        WHERE package_id = ${id}
        ORDER BY day_number ASC
      `);
      const departures = await db.all(sql`
        SELECT id, departure_date AS departureDate, return_date AS returnDate,
               seat_capacity AS seatCapacity, adult_price AS adultPrice,
               child_price AS childPrice, status
        FROM departures WHERE package_id = ${id}
        ORDER BY departure_date ASC
      `);
      return {
        ok: true,
        data: { ...rows[0], itinerary, departures },
        summary: `Package "${rows[0].name}" — ${itinerary.length} itinerary day(s), ${departures.length} departure(s)`,
      };
    }

    case "get_dashboard_kpis": {
      const rows = await db.all<Record<string, unknown>>(sql`
        SELECT
          (SELECT COUNT(*) FROM bookings) AS totalBookings,
          (SELECT COUNT(*) FROM bookings WHERE status = 'confirmed') AS confirmedBookings,
          (SELECT COUNT(*) FROM leads WHERE stage NOT IN ('won','lost')) AS openLeads,
          (SELECT COUNT(*) FROM packages WHERE publish_status = 'published') AS publishedPackages,
          (SELECT COALESCE(SUM(total_amount), 0) FROM bookings) AS grossRevenue,
          (SELECT COALESCE(SUM(balance_due), 0) FROM invoices) AS outstandingBalance,
          (SELECT COUNT(*) FROM departures WHERE departure_date >= date('now')) AS upcomingDepartures
      `);
      return { ok: true, data: rows[0], summary: "Dashboard KPIs loaded" };
    }

    case "list_invoices": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const status = str(args.status);
      const rows = await db.all(sql`
        SELECT id, number, customer_name AS customerName, package_name AS packageName,
               status, total AS totalAmount, balance_due AS balanceDue, issue_date AS issueDate
        FROM invoices
        WHERE 1 = 1 ${status ? sql`AND status = ${status}` : sql``}
        ORDER BY created_at DESC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} invoice(s)` };
    }

    case "list_quotations": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const status = str(args.status);
      const rows = await db.all(sql`
        SELECT id, number, customer_name AS customerName, package_name AS packageName,
               destination, status, total AS totalAmount, valid_until AS validUntil
        FROM quotations
        WHERE 1 = 1 ${status ? sql`AND status = ${status}` : sql``}
        ORDER BY created_at DESC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} quotation(s)` };
    }

    case "list_payments": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const status = str(args.status);
      const rows = await db.all(sql`
        SELECT p.id, p.amount, p.method, p.status, p.reference, p.paid_at AS paidAt,
               i.number AS invoiceNumber, i.customer_name AS customerName
        FROM payments p
        LEFT JOIN invoices i ON i.id = p.invoice_id
        WHERE 1 = 1 ${status ? sql`AND p.status = ${status}` : sql``}
        ORDER BY p.paid_at DESC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} payment(s)` };
    }

    case "list_website_pages": {
      const limit = Math.min(Math.max(num(args.limit) || 50, 1), 200);
      const rows = await db.all(sql`
        SELECT id, slug, title, status, updated_at AS updatedAt
        FROM site_pages ORDER BY updated_at DESC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} website page(s)` };
    }

    case "list_banners": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const rows = await db.all(sql`
        SELECT id, title, subtitle, cta_label AS ctaLabel, cta_href AS ctaHref,
               start_at AS startAt, end_at AS endAt, active
        FROM site_banners ORDER BY created_at DESC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} banner(s)` };
    }

    case "list_alerts": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const rows = await db.all(sql`
        SELECT id, kind, severity, title, message, entity_type AS entityType, created_at AS createdAt
        FROM alerts ORDER BY created_at DESC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} alert(s)` };
    }

    case "list_suppliers": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const rows = await db.all(sql`
        SELECT id, name, type AS category, contact_name AS contactName,
               phone AS contactPhone, email AS contactEmail
        FROM suppliers ORDER BY name ASC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} supplier(s)` };
    }

    case "list_staff": {
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 100);
      const rows = await db.all(sql`
        SELECT id, name, email, role FROM user ORDER BY name ASC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} staff member(s)` };
    }

    case "list_website_images": {
      const limit = Math.min(Math.max(num(args.limit) || 30, 1), 100);
      const rows = await db.all(sql`
        SELECT pm.id, pm.package_id AS packageId, pm.url, pm.alt, pm.caption,
               pm.sort_order AS sortOrder, p.name AS packageName
        FROM package_media pm
        LEFT JOIN packages p ON p.id = pm.package_id
        WHERE pm.kind = 'image'
        ORDER BY pm.sort_order ASC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} image(s)` };
    }

    case "list_departure_manifest": {
      const departureId = str(args.departureId);
      const rows = await db.all(sql`
        SELECT b.reference, b.status, b.pax_adult AS paxAdult, b.pax_child AS paxChild,
               b.pax_infant AS paxInfant, c.name AS customerName, c.phone AS customerPhone,
               p.name AS packageName, d.departure_date AS departureDate
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN packages p ON p.id = b.package_id
        LEFT JOIN departures d ON d.id = b.departure_id
        WHERE b.departure_id = ${departureId}
        ORDER BY b.created_at ASC
      `);
      return { ok: true, data: rows, summary: `${rows.length} booking(s) on this departure` };
    }

    case "list_checklist": {
      const departureId = str(args.departureId);
      const rows = await db.all(sql`
        SELECT id, label, category, done, sort_order AS sortOrder, updated_at AS updatedAt
        FROM trip_checklist_items
        WHERE departure_id = ${departureId} ORDER BY sort_order ASC
      `);
      return { ok: true, data: rows, summary: `${rows.length} checklist item(s)` };
    }

    case "list_departure_costs": {
      const departureId = str(args.departureId);
      const rows = await db.all(sql`
        SELECT dc.id, s.name AS supplier, dc.category, dc.description,
               dc.estimated_amount AS estimatedAmount, dc.actual_amount AS actualAmount
        FROM departure_costs dc
        LEFT JOIN suppliers s ON s.id = dc.supplier_id
        WHERE dc.departure_id = ${departureId}
      `);
      return { ok: true, data: rows, summary: `${rows.length} supplier cost(s) on this departure` };
    }

    case "get_settings": {
      const key = str(args.key);
      const rows = await db.all<{ key: string; value: unknown }>(sql`
        SELECT key, value FROM app_settings
        WHERE 1 = 1 ${key ? sql`AND key = ${key}` : sql``}
      `);
      const out: Record<string, unknown> = {};
      for (const row of rows) {
        let value: unknown = row.value;
        if (typeof value === "string") {
          try {
            value = JSON.parse(value);
          } catch {
            /* keep raw string */
          }
        }
        // Never expose secrets to the model.
        if (value && typeof value === "object") {
          const copy = { ...(value as Record<string, unknown>) };
          for (const secret of ["apiKey", "secret", "token", "password"]) {
            if (secret in copy) copy[secret] = "***";
          }
          out[row.key] = copy;
        } else {
          out[row.key] = value;
        }
      }
      return { ok: true, data: out, summary: `Loaded ${Object.keys(out).length} settings group(s)` };
    }

    case "update_settings": {
      const key = str(args.key);
      const value = args.value;
      if (!key || !value || typeof value !== "object") {
        return { ok: false, data: null, summary: "key and an object value are required" };
      }
      const current = await db.all<{ value: unknown }>(sql`
        SELECT value FROM app_settings WHERE key = ${key} LIMIT 1
      `);
      let merged: Record<string, unknown> = {};
      if (current.length) {
        let raw = current[0].value;
        if (typeof raw === "string") {
          try {
            raw = JSON.parse(raw);
          } catch {
            raw = {};
          }
        }
        if (raw && typeof raw === "object") merged = { ...(raw as Record<string, unknown>) };
      }
      merged = { ...merged, ...(value as Record<string, unknown>) };
      await db.run(sql`
        INSERT INTO app_settings (key, value, updated_by, updatedAt)
        VALUES (${key}, ${JSON.stringify(merged)}, ${ctx.actor.email}, ${Date.now()})
        ON CONFLICT(key) DO UPDATE SET value = excluded.value,
          updated_by = excluded.updated_by, updatedAt = excluded.updatedAt
      `);
      await db.run(sql`
        INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
        VALUES (${crypto.randomUUID()}, ${`ai:${ctx.actor.email}`}, ${ctx.actor.role},
                'ai_update_settings', 'app_settings', ${key}, ${`keys:${Object.keys(value as Record<string, unknown>).join(",")}`}, datetime('now'))
      `).catch(() => undefined);
      return {
        ok: true,
        mutation: true,
        data: { key, updated: Object.keys(value as Record<string, unknown>) },
        url: "/settings",
        urlLabel: "Buka Tetapan",
        summary: `Settings "${key}" updated (${Object.keys(value as Record<string, unknown>).join(", ")})`,
      };
    }

    case "update_package": {
      const id = str(args.id);
      if (!id) return { ok: false, data: null, summary: "id is required" };
      const existing = await db.all<{ id: string; name: string }>(sql`
        SELECT id, name FROM packages WHERE id = ${id} LIMIT 1
      `);
      if (!existing.length) {
        return { ok: false, data: null, summary: `Package ${id} not found` };
      }
      const now = new Date().toISOString();
      const set: string[] = [];
      const esc = (v: string) => v.replace(/'/g, "''");
      if (args.name !== undefined) set.push(`name = '${esc(str(args.name))}'`);
      if (args.destination !== undefined) set.push(`destination = '${esc(str(args.destination))}'`);
      if (args.durationDays !== undefined) set.push(`duration_days = ${Math.max(1, num(args.durationDays))}`);
      if (args.description !== undefined) set.push(`description = '${esc(str(args.description))}'`);
      if (args.highlights !== undefined) set.push(`highlights = '${esc(JSON.stringify(strArray(args.highlights)))}'`);
      if (args.inclusions !== undefined) set.push(`inclusions = '${esc(JSON.stringify(strArray(args.inclusions)))}'`);
      if (args.exclusions !== undefined) set.push(`exclusions = '${esc(JSON.stringify(strArray(args.exclusions)))}'`);
      if (args.adultPrice !== undefined) set.push(`adult_price = ${Math.max(0, num(args.adultPrice))}`);
      if (args.childPrice !== undefined) set.push(`child_price = ${Math.max(0, num(args.childPrice))}`);
      if (args.infantPrice !== undefined) set.push(`infant_price = ${Math.max(0, num(args.infantPrice))}`);
      if (args.status !== undefined && ["draft", "published", "archived"].includes(String(args.status))) {
        set.push(`publish_status = '${String(args.status)}'`);
      }
      const changed: string[] = [];
      if (set.length) {
        await db.run(sql.raw(
          `UPDATE packages SET ${set.join(", ")}, updated_at = '${now.replace(/'/g, "''")}' WHERE id = '${id.replace(/'/g, "''")}'`,
        ));
        changed.push(...set.map((s) => s.split(" = ")[0]));
      }
      let dayCount = 0;
      if (Array.isArray(args.itinerary)) {
        const days = args.itinerary as Array<Record<string, unknown>>;
        await db.run(sql`DELETE FROM package_itinerary_items WHERE package_id = ${id}`);
        for (const [index, day] of days.entries()) {
          await db.run(sql`
            INSERT INTO package_itinerary_items (id, package_id, day_number, title, description, meal_included, sort_order, created_at)
            VALUES (
              ${crypto.randomUUID()}, ${id}, ${num(day.dayNumber) || index + 1},
              ${str(day.title) || null}, ${str(day.description) || null},
              ${JSON.stringify(strArray(day.mealIncluded))}, ${index + 1}, ${now}
            )
          `);
        }
        dayCount = days.length;
        changed.push("itinerary");
      }
      await db.run(sql`
        INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
        VALUES (${crypto.randomUUID()}, ${`ai:${ctx.actor.email}`}, ${ctx.actor.role},
                'ai_update_package', 'packages', ${id},
                ${`${changed.join(",")}${dayCount ? ` | ${dayCount} itinerary day(s)` : ""}`}, datetime('now'))
      `).catch(() => undefined);
      return {
        ok: true,
        mutation: true,
        data: { id, name: existing[0].name, changed, itineraryDays: dayCount },
        url: `/site/packages/${id}`,
        urlLabel: `Lihat pakej · ${existing[0].name}`,
        summary: `Package "${existing[0].name}" updated${changed.length ? ` (${changed.join(", ")})` : ""}${dayCount ? ` — ${dayCount} itinerary day(s) saved` : ""}`,
      };
    }

    case "update_departure": {
      const id = str(args.id);
      if (!id) return { ok: false, data: null, summary: "id is required" };
      const existing = await db.all<{ id: string; departureDate: string }>(sql`
        SELECT id, departure_date AS departureDate FROM departures WHERE id = ${id} LIMIT 1
      `);
      if (!existing.length) {
        return { ok: false, data: null, summary: `Departure ${id} not found` };
      }
      const set: string[] = [];
      const vals: unknown[] = [];
      if (args.departureDate !== undefined) set.push(`departure_date = '${str(args.departureDate).replace(/'/g, "''")}'`);
      if (args.returnDate !== undefined) set.push(`return_date = '${str(args.returnDate).replace(/'/g, "''")}'`);
      if (args.seatCapacity !== undefined) set.push(`seat_capacity = ${Math.max(0, num(args.seatCapacity))}`);
      if (args.adultPrice !== undefined) set.push(`adult_price = ${Math.max(0, num(args.adultPrice))}`);
      if (args.childPrice !== undefined) set.push(`child_price = ${Math.max(0, num(args.childPrice))}`);
      if (args.infantPrice !== undefined) set.push(`infant_price = ${Math.max(0, num(args.infantPrice))}`);
      if (args.tourLeader !== undefined) set.push(`tour_leader = '${str(args.tourLeader).replace(/'/g, "''")}'`);
      if (args.status !== undefined && ["open", "almost_full", "full", "closed", "cancelled"].includes(String(args.status))) {
        set.push(`status = '${String(args.status)}'`);
      }
      if (!set.length) {
        return { ok: false, data: null, summary: "No fields to update were provided" };
      }
      await db.run(sql.raw(
        `UPDATE departures SET ${set.join(", ")}, updated_at = datetime('now') WHERE id = '${id.replace(/'/g, "''")}'`,
      ));
      const changed = set.map((s) => s.split(" = ")[0]);
      await db.run(sql`
        INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
        VALUES (${crypto.randomUUID()}, ${`ai:${ctx.actor.email}`}, ${ctx.actor.role},
                'ai_update_departure', 'departures', ${id}, ${changed.join(",")}, datetime('now'))
      `).catch(() => undefined);
      return {
        ok: true,
        mutation: true,
        data: { id, changed },
        url: "/trips",
        urlLabel: "Buka Jadual",
        summary: `Departure ${existing[0].departureDate} updated (${changed.join(", ")})`,
      };
    }

    case "create_departure": {
      const packageId = str(args.packageId);
      const departureDate = str(args.departureDate);
      const returnDate = str(args.returnDate);
      if (!packageId || !departureDate || !returnDate) {
        return { ok: false, data: null, summary: "packageId, departureDate and returnDate are required" };
      }
      const pkg = await db.all<{ name: string }>(sql`
        SELECT name FROM packages WHERE id = ${packageId} LIMIT 1
      `);
      if (!pkg.length) {
        return { ok: false, data: null, summary: `Package ${packageId} not found` };
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.run(sql`
        INSERT INTO departures (id, package_id, departure_date, return_date, seat_capacity,
          seats_booked, seats_held, adult_price, child_price, infant_price, status,
          tour_leader, created_at, updated_at)
        VALUES (
          ${id}, ${packageId}, ${departureDate}, ${returnDate}, ${Math.max(0, num(args.seatCapacity)) || 0},
          0, 0, ${Math.max(0, num(args.adultPrice))}, ${Math.max(0, num(args.childPrice))},
          ${Math.max(0, num(args.infantPrice))}, 'open', ${str(args.tourLeader) || null}, ${now}, ${now}
        )
      `);
      await db.run(sql`
        INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
        VALUES (${crypto.randomUUID()}, ${`ai:${ctx.actor.email}`}, ${ctx.actor.role},
                'ai_create_departure', 'departures', ${id}, ${`${packageId} ${departureDate}`}, datetime('now'))
      `).catch(() => undefined);
      return {
        ok: true,
        mutation: true,
        data: { id, packageId, departureDate, returnDate },
        url: "/trips",
        urlLabel: "Buka Jadual",
        summary: `Departure ${departureDate} → ${returnDate} scheduled for "${pkg[0].name}"`,
      };
    }

    case "update_lead": {
      const id = str(args.id);
      if (!id) return { ok: false, data: null, summary: "id is required" };
      const existing = await db.all<{ id: string; name: string }>(sql`
        SELECT id, name FROM leads WHERE id = ${id} LIMIT 1
      `);
      if (!existing.length) {
        return { ok: false, data: null, summary: `Lead ${id} not found` };
      }
      const set: string[] = [];
      if (args.stage !== undefined && ["new", "contacted", "qualified", "quotation", "won", "lost"].includes(String(args.stage))) {
        set.push(`stage = '${String(args.stage)}'`);
      }
      if (args.name !== undefined) set.push(`name = '${str(args.name).replace(/'/g, "''")}'`);
      if (args.phone !== undefined) set.push(`phone = '${str(args.phone).replace(/'/g, "''")}'`);
      if (args.email !== undefined) set.push(`email = '${str(args.email).replace(/'/g, "''")}'`);
      if (args.destination !== undefined) set.push(`destination = '${str(args.destination).replace(/'/g, "''")}'`);
      if (args.pax !== undefined) set.push(`pax = ${Math.max(1, num(args.pax))}`);
      if (args.budget !== undefined) set.push(`budget = ${Math.max(0, num(args.budget))}`);
      if (args.assignedTo !== undefined) set.push(`assigned_to = '${str(args.assignedTo).replace(/'/g, "''")}'`);
      if (args.nextFollowUp !== undefined) set.push(`next_follow_up = '${str(args.nextFollowUp).replace(/'/g, "''")}'`);
      if (args.notes !== undefined) set.push(`notes = '${str(args.notes).replace(/'/g, "''")}'`);
      if (!set.length) {
        return { ok: false, data: null, summary: "No fields to update were provided" };
      }
      await db.run(sql.raw(
        `UPDATE leads SET ${set.join(", ")}, updated_at = datetime('now') WHERE id = '${id.replace(/'/g, "''")}'`,
      ));
      const changed = set.map((s) => s.split(" = ")[0]);
      await db.run(sql`
        INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
        VALUES (${crypto.randomUUID()}, ${`ai:${ctx.actor.email}`}, ${ctx.actor.role},
                'ai_update_lead', 'leads', ${id}, ${changed.join(",")}, datetime('now'))
      `).catch(() => undefined);
      return {
        ok: true,
        mutation: true,
        data: { id, changed },
        url: "/lead-management",
        urlLabel: "Buka Leads",
        summary: `Lead "${existing[0].name}" updated (${changed.join(", ")})`,
      };
    }

    case "update_customer": {
      const id = str(args.id);
      if (!id) return { ok: false, data: null, summary: "id is required" };
      const existing = await db.all<{ id: string; name: string }>(sql`
        SELECT id, name FROM customers WHERE id = ${id} LIMIT 1
      `);
      if (!existing.length) {
        return { ok: false, data: null, summary: `Customer ${id} not found` };
      }
      const set: string[] = [];
      if (args.name !== undefined) set.push(`name = '${str(args.name).replace(/'/g, "''")}'`);
      if (args.phone !== undefined) set.push(`phone = '${str(args.phone).replace(/'/g, "''")}'`);
      if (args.email !== undefined) set.push(`email = '${str(args.email).replace(/'/g, "''")}'`);
      if (args.city !== undefined) set.push(`city = '${str(args.city).replace(/'/g, "''")}'`);
      if (args.notes !== undefined) set.push(`notes = '${str(args.notes).replace(/'/g, "''")}'`);
      if (!set.length) {
        return { ok: false, data: null, summary: "No fields to update were provided" };
      }
      await db.run(sql.raw(
        `UPDATE customers SET ${set.join(", ")}, updated_at = datetime('now') WHERE id = '${id.replace(/'/g, "''")}'`,
      ));
      const changed = set.map((s) => s.split(" = ")[0]);
      return {
        ok: true,
        mutation: true,
        data: { id, changed },
        url: "/customers",
        urlLabel: "Buka Pelanggan",
        summary: `Customer "${existing[0].name}" updated (${changed.join(", ")})`,
      };
    }

    case "create_customer": {
      const name = str(args.name);
      const phone = str(args.phone);
      if (!name || !phone) {
        return { ok: false, data: null, summary: "name and phone are required" };
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.run(sql`
        INSERT INTO customers (id, name, phone, email, city, type, notes, created_at, updated_at)
        VALUES (${id}, ${name}, ${phone}, ${str(args.email) || null}, ${str(args.city) || null},
                ${args.type === "corporate" ? "corporate" : "individual"},
                ${str(args.notes) || null}, ${now}, ${now})
      `);
      return {
        ok: true,
        mutation: true,
        data: { id, name, phone },
        url: "/customers",
        urlLabel: name,
        summary: `Customer "${name}" created`,
      };
    }

    case "update_booking": {
      const id = str(args.id);
      if (!id) return { ok: false, data: null, summary: "id is required" };
      const existing = await db.all<{ id: string; reference: string }>(sql`
        SELECT id, reference FROM bookings WHERE id = ${id} LIMIT 1
      `);
      if (!existing.length) {
        return { ok: false, data: null, summary: `Booking ${id} not found` };
      }
      const set: string[] = [];
      if (args.paxAdult !== undefined) set.push(`pax_adult = ${Math.max(0, num(args.paxAdult))}`);
      if (args.paxChild !== undefined) set.push(`pax_child = ${Math.max(0, num(args.paxChild))}`);
      if (args.paxInfant !== undefined) set.push(`pax_infant = ${Math.max(0, num(args.paxInfant))}`);
      if (args.status !== undefined && ["draft", "hold", "pending_deposit", "confirmed", "cancelled", "completed"].includes(String(args.status))) {
        set.push(`status = '${String(args.status)}'`);
      }
      if (args.customerId !== undefined) set.push(`customer_id = '${str(args.customerId).replace(/'/g, "''")}'`);
      if (args.departureId !== undefined) set.push(`departure_id = '${str(args.departureId).replace(/'/g, "''")}'`);
      if (!set.length) {
        return { ok: false, data: null, summary: "No fields to update were provided" };
      }
      await db.run(sql.raw(
        `UPDATE bookings SET ${set.join(", ")}, updated_at = datetime('now') WHERE id = '${id.replace(/'/g, "''")}'`,
      ));
      const changed = set.map((s) => s.split(" = ")[0]);
      return {
        ok: true,
        mutation: true,
        data: { id, changed },
        url: "/bookings",
        urlLabel: existing[0].reference,
        summary: `Booking ${existing[0].reference} updated (${changed.join(", ")})`,
      };
    }

    case "create_invoice": {
      const items = Array.isArray(args.items) ? (args.items as Array<Record<string, unknown>>) : [];
      if (!items.length) {
        return { ok: false, data: null, summary: "At least one invoice item is required" };
      }
      const normalised = items.map((item) => ({
        description: str(item.description),
        quantity: num(item.quantity) || 1,
        unitPrice: num(item.unitPrice),
      }));
      const subtotal = normalised.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const year = new Date().getFullYear();
      const count = await db.all<{ n: number }>(sql`
        SELECT COUNT(*) AS n FROM invoices WHERE number LIKE ${`INV-${year}-%`}
      `);
      const number = `INV-${year}-${String((count[0]?.n ?? 0) + 1).padStart(4, "0")}`;
      await db.run(sql`
        INSERT INTO invoices (id, number, booking_id, customer_name, package_name,
          status, issue_date, due_date, subtotal, discount, total,
          deposit_amount, paid_amount, balance_due, notes, created_at, updated_at)
        VALUES (
          ${id}, ${number}, ${str(args.bookingId) || null}, ${str(args.customerName) || "—"},
          ${str(args.packageName) || "—"}, 'issued', ${now.slice(0, 10)}, ${now.slice(0, 10)},
          ${subtotal}, 0, ${subtotal}, 0, 0, ${subtotal},
          ${str(args.notes) || null}, ${now}, ${now}
        )
      `);
      for (const [index, item] of normalised.entries()) {
        await db.run(sql`
          INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, sort_order)
          VALUES (
            ${crypto.randomUUID()}, ${id}, ${item.description}, ${item.quantity},
            ${item.unitPrice}, ${item.quantity * item.unitPrice}, ${index + 1}
          )
        `);
      }
      return {
        ok: true,
        mutation: true,
        data: { id, number, total: subtotal, items: normalised.length },
        url: "/billing",
        urlLabel: number,
        summary: `Invoice ${number} issued — RM ${subtotal.toLocaleString("ms-MY")} (${normalised.length} item(s))`,
      };
    }

    case "create_quotation": {
      const customerName = str(args.customerName);
      const customerPhone = str(args.customerPhone);
      const packageName = str(args.packageName);
      if (!customerName || !customerPhone || !packageName) {
        return { ok: false, data: null, summary: "customerName, customerPhone and packageName are required" };
      }
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const year = new Date().getFullYear();
      const count = await db.all<{ n: number }>(sql`
        SELECT COUNT(*) AS n FROM quotations WHERE number LIKE ${`QTN-${year}-%`}
      `);
      const number = `QTN-${year}-${String((count[0]?.n ?? 0) + 1).padStart(4, "0")}`;
      const total = Math.max(0, num(args.totalAmount));
      await db.run(sql`
        INSERT INTO quotations (id, number, customer_name, customer_phone, package_name,
          destination, pax_adult, pax_child, pax_infant, departure_date, status,
          valid_until, subtotal, discount, total, lead_id, created_by, created_at, updated_at)
        VALUES (
          ${id}, ${number}, ${customerName}, ${customerPhone}, ${packageName},
          ${str(args.destination) || null}, ${Math.max(0, num(args.paxAdult))},
          ${Math.max(0, num(args.paxChild))}, ${Math.max(0, num(args.paxInfant))},
          ${str(args.departureDate) || null}, 'draft',
          ${new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)},
          ${total}, 0, ${total}, ${str(args.leadId) || null}, ${ctx.actor.email}, ${now}, ${now}
        )
      `);
      return {
        ok: true,
        mutation: true,
        data: { id, number, total },
        url: "/billing",
        urlLabel: number,
        summary: `Quotation ${number} created for ${customerName} — RM ${total.toLocaleString("ms-MY")}`,
      };
    }

    case "update_website_page": {
      const id = str(args.id);
      const slug = str(args.slug);
      if (!id && !slug) {
        return { ok: false, data: null, summary: "id or slug is required" };
      }
      const existing = await db.all<{ id: string; slug: string; title: string }>(sql`
        SELECT id, slug, title FROM site_pages
        WHERE ${id ? sql`id = ${id}` : sql`slug = ${slug}`} LIMIT 1
      `);
      if (!existing.length) {
        return { ok: false, data: null, summary: `Page ${id || slug} not found` };
      }
      const set: string[] = [];
      if (args.title !== undefined) set.push(`title = '${str(args.title).replace(/'/g, "''")}'`);
      if (args.slug !== undefined) set.push(`slug = '${slug.replace(/'/g, "''")}'`);
      if (args.content !== undefined) {
        let content = str(args.content);
        try {
          JSON.parse(content);
        } catch {
          return { ok: false, data: null, summary: "content must be valid JSON" };
        }
        set.push(`content = '${content.replace(/'/g, "''")}'`);
      }
      if (args.status !== undefined && ["draft", "published"].includes(String(args.status))) {
        set.push(`status = '${String(args.status)}'`);
      }
      if (!set.length) {
        return { ok: false, data: null, summary: "No fields to update were provided" };
      }
      await db.run(sql.raw(
        `UPDATE site_pages SET ${set.join(", ")}, updated_at = datetime('now') WHERE id = '${existing[0].id}'`,
      ));
      const changed = set.map((s) => s.split(" = ")[0]);
      return {
        ok: true,
        mutation: true,
        data: { id: existing[0].id, changed },
        url: `/site/p/${slug || existing[0].slug}`,
        urlLabel: `Buka laman · ${existing[0].title}`,
        summary: `Page "${existing[0].title}" updated (${changed.join(", ")})`,
      };
    }

    case "update_site_seo": {
      const slug = str(args.slug);
      if (!slug) return { ok: false, data: null, summary: "slug is required" };
      const existing = await db.all<{ slug: string }>(sql`
        SELECT slug FROM site_seo WHERE slug = ${slug} LIMIT 1
      `);
      const now = new Date().toISOString();
      if (existing.length) {
        await db.run(sql`
          UPDATE site_seo SET meta_title = ${str(args.metaTitle)}, meta_description = ${str(args.metaDescription)},
            keywords = ${str(args.keywords)}, updated_at = ${now} WHERE slug = ${slug}
        `);
      } else {
        await db.run(sql`
          INSERT INTO site_seo (slug, meta_title, meta_description, keywords, updated_at)
          VALUES (${slug}, ${str(args.metaTitle)}, ${str(args.metaDescription)}, ${str(args.keywords)}, ${now})
        `);
      }
      return {
        ok: true,
        mutation: true,
        data: { slug },
        url: "/website",
        urlLabel: "Buka Website Manager",
        summary: `SEO for "${slug}" updated`,
      };
    }

    case "update_banner": {
      const title = str(args.title);
      if (!title) return { ok: false, data: null, summary: "title is required" };
      const id = str(args.id) || crypto.randomUUID();
      const now = new Date().toISOString();
      const existing = await db.all<{ id: string }>(sql`
        SELECT id FROM site_banners WHERE id = ${id} LIMIT 1
      `);
      if (existing.length) {
        await db.run(sql`
          UPDATE site_banners SET title = ${title}, subtitle = ${str(args.subtitle)},
            cta_label = ${str(args.ctaLabel)}, cta_href = ${str(args.ctaHref) || "/site/packages"},
            start_at = ${str(args.startAt) || null}, end_at = ${str(args.endAt) || null},
            active = ${args.active === false ? 0 : 1} WHERE id = ${id}
        `);
      } else {
        await db.run(sql`
          INSERT INTO site_banners (id, title, subtitle, cta_label, cta_href, start_at, end_at, active, created_at)
          VALUES (${id}, ${title}, ${str(args.subtitle)}, ${str(args.ctaLabel)},
                  ${str(args.ctaHref) || "/site/packages"}, ${str(args.startAt) || null},
                  ${str(args.endAt) || null}, ${args.active === false ? 0 : 1}, ${now})
        `);
      }
      return {
        ok: true,
        mutation: true,
        data: { id },
        url: "/website",
        urlLabel: "Buka Website Manager",
        summary: `Banner "${title}" ${existing.length ? "updated" : "created"}`,
      };
    }

    case "create_package_from_itinerary": {
      const name = str(args.name);
      const destination = str(args.destination);
      if (!name || !destination) {
        return { ok: false, data: null, summary: "name and destination are required" };
      }
      const itinerary = Array.isArray(args.itinerary) ? (args.itinerary as Array<Record<string, unknown>>) : [];
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.run(sql`
        INSERT INTO packages (
          id, name, destination, duration_days, description, highlights, itinerary,
          inclusions, exclusions, adult_price, child_price, infant_price, images,
          publish_status, created_at, updated_at
        )
        VALUES (
          ${id}, ${name}, ${destination}, ${num(args.durationDays)}, ${str(args.description) || null},
          ${JSON.stringify(strArray(args.highlights))}, ${JSON.stringify([])},
          ${JSON.stringify(strArray(args.inclusions))}, ${JSON.stringify(strArray(args.exclusions))},
          ${num(args.adultPrice)}, ${num(args.childPrice)}, ${num(args.infantPrice)}, ${JSON.stringify([])},
          'published', ${now}, ${now}
        )
      `);
      // Day-by-day itinerary rows.
      for (const [index, day] of itinerary.entries()) {
        await db.run(sql`
          INSERT INTO package_itinerary_items (id, package_id, day_number, title, description, meal_included, sort_order, created_at)
          VALUES (
            ${crypto.randomUUID()}, ${id}, ${num(day.dayNumber) || index + 1},
            ${str(day.title) || null}, ${str(day.description) || null},
            ${JSON.stringify(strArray(day.mealIncluded))}, ${index + 1}, ${now}
          )
        `);
      }
      await db.run(sql`
        INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
        VALUES (${crypto.randomUUID()}, ${`ai:${ctx.actor.email}`}, ${ctx.actor.role},
                'ai_create_package', 'packages', ${id}, ${`${itinerary.length} day(s)`}, datetime('now'))
      `);
      return {
        ok: true,
        mutation: true,
        data: { id, name, destination, days: itinerary.length },
        url: `/site/packages/${id}`,
        urlLabel: `Lihat pakej · ${name}`,
        summary: `Package "${name}" published with ${itinerary.length} itinerary day(s) — live on the website`,
      };
    }

    case "create_website_page": {
      const title = str(args.title);
      const slug = str(args.slug);
      if (!title || !slug) {
        return { ok: false, data: null, summary: "title and slug are required" };
      }
      const packageId = str(args.packageId);
      const itinerary = Array.isArray(args.itinerary)
        ? (args.itinerary as Array<Record<string, unknown>>)
        : [];
      const ringgit = (n: number) => `RM ${n.toLocaleString("ms-MY")}`;

      const days = itinerary
        .map((d) => ({
          dayNumber: num(d.dayNumber),
          title: str(d.title),
          description: str(d.description),
          mealIncluded: strArray(d.mealIncluded),
        }))
        .sort((a, b) => a.dayNumber - b.dayNumber);

      const highlights = strArray(args.highlights);
      const inclusions = strArray(args.inclusions);
      const exclusions = strArray(args.exclusions);

      const blocks = [
        { id: "blk-hero", kind: "hero", value: str(args.coverImageUrl) },
        { id: "blk-summary-h", kind: "heading", value: "Ringkasan Pakej" },
        { id: "blk-summary", kind: "text", value: str(args.summary) },
        { id: "blk-high-h", kind: "heading", value: "Sorotan Trip" },
        { id: "blk-high", kind: "list", value: highlights.join("|") },
        { id: "blk-itin-h", kind: "heading", value: "Itinerari Hari Demi Hari" },
        {
          id: "blk-itin",
          kind: "itinerary",
          value: "Itinerari Hari Demi Hari",
          data: { days },
        },
        { id: "blk-price-h", kind: "heading", value: "Harga" },
        {
          id: "blk-price",
          kind: "pricing",
          value: "Harga",
          data: {
            rows: [
              { label: "Dewasa (12+)", amount: ringgit(num(args.adultPrice)) },
              { label: "Kanak-kanak (2–11)", amount: ringgit(num(args.childPrice)) },
              { label: "Bayi (bawah 2)", amount: ringgit(num(args.infantPrice)) },
            ],
          },
        },
        { id: "blk-inc-h", kind: "heading", value: "Termasuk & Tidak Termasuk" },
        {
          id: "blk-inc",
          kind: "list",
          value: [
            ...inclusions.map((x) => `TERMASUK: ${x}`),
            ...exclusions.map((x) => `TIDAK TERMASUK: ${x}`),
          ].join("|"),
        },
        { id: "blk-cta", kind: "cta", value: "Tempah Sekarang" },
      ];

      const id = `page-${crypto.randomUUID().slice(0, 8)}`;
      const content = JSON.stringify({ title, summary: str(args.summary), blocks });
      const existing = await db.all<{ id: string }>(sql`
        SELECT id FROM site_pages WHERE slug = ${slug} LIMIT 1
      `);
      if (existing.length) {
        await db.run(sql`
          UPDATE site_pages SET title = ${title}, content = ${content}, status = 'published',
            updated_at = datetime('now') WHERE id = ${existing[0].id}
        `);
      } else {
        await db.run(sql`
          INSERT INTO site_pages (id, slug, title, content, status, updated_at)
          VALUES (${id}, ${slug}, ${title}, ${content}, 'published', datetime('now'))
        `);
      }
      await db.run(sql`
        INSERT INTO audit_logs (id, actor, role, action, entity_type, entity_id, detail, at)
        VALUES (${crypto.randomUUID()}, ${`ai:${ctx.actor.email}`}, ${ctx.actor.role},
                'ai_publish_website_page', 'site_pages', ${id}, ${`published:${slug}${packageId ? `,package:${packageId}` : ""}`}, datetime('now'))
      `);
      return {
        ok: true,
        mutation: true,
        data: { id, slug, title, blocks: blocks.length },
        url: `/site/p/${slug}`,
        urlLabel: `Buka laman · ${title}`,
        summary: `Page "${title}" published and LIVE at /site/p/${slug}`,
      };
    }

    case "list_audit_logs": {
      if (ctx.actor.role !== "super_admin" && ctx.actor.role !== "management") {
        return { ok: false, data: null, summary: "Forbidden: super_admin role required" };
      }
      const limit = Math.min(Math.max(num(args.limit) || 20, 1), 200);
      const rows = await db.all(sql`
        SELECT id, actor, role, action, entity_type AS entityType, entity_id AS entityId, detail, at
        FROM audit_logs ORDER BY at DESC LIMIT ${limit}
      `);
      return { ok: true, data: rows, summary: `${rows.length} audit log entr(y/ies)` };
    }

    default:
      return { ok: false, data: null, summary: `Unknown tool: ${name}` };
  }
}
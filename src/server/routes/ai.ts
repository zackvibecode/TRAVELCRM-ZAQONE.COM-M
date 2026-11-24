import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import { requireRole } from "../middleware/auth";
import { chatCompletion, type AiConfig, type AiMessage } from "../lib/ai-client";
import { AI_TOOLS, parseArgs, runAiTool } from "../lib/ai-tools";
import { extractPdfText, isPdf } from "../lib/pdf-extract";

type Env = {
  Bindings: { DOCUMENTS: R2Bucket };
  Variables: {
    db: DrizzleD1Database<typeof schema>;
    staff: import("../lib/auth-context").StaffIdentity;
  };
};

const aiRouter = new Hono<Env>();

/**
 * The AI assistant can read the whole CRM and act on it, so access is limited
 * to Super Admin and Management. Every conversation is persisted per staff.
 */
aiRouter.use("*", requireRole("super_admin", "management"));

/** Load the AI configuration from the `ai` settings group. */
async function loadAiConfig(
  db: DrizzleD1Database<typeof schema>,
): Promise<AiConfig | null> {
  const rows = await db.all<{ value: unknown }>(sql`
    SELECT value FROM app_settings WHERE key = 'ai' LIMIT 1
  `);
  if (!rows.length) return null;
  const raw = rows[0].value;
  const value = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<
    AiConfig & { enabled?: boolean }
  >;
  if (!value?.baseUrl || !value?.model) return null;
  if (value.enabled === false) return null;
  return {
    baseUrl: value.baseUrl,
    apiKey: value.apiKey ?? "",
    model: value.model,
    temperature: Number(value.temperature ?? 0.3),
    maxTokens: Number(value.maxTokens ?? 4000),
  };
}

/** Find or create the conversation row for this staff member. */
async function resolveConversation(
  db: DrizzleD1Database<typeof schema>,
  staffId: string,
  conversationId?: string,
): Promise<string> {
  if (conversationId) {
    const rows = await db.all<{ id: string }>(sql`
      SELECT id FROM ai_conversations WHERE id = ${conversationId} AND staff_id = ${staffId} LIMIT 1
    `);
    if (rows.length) return rows[0].id;
  }
  const id = crypto.randomUUID();
  await db.run(sql`
    INSERT INTO ai_conversations (id, staff_id, title, created_at, updated_at)
    VALUES (${id}, ${staffId}, ${"Chat AI"}, datetime('now'), datetime('now'))
  `);
  return id;
}

/** Persist one message into a conversation. */
async function persistMessage(
  db: DrizzleD1Database<typeof schema>,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  toolCalls?: unknown,
): Promise<void> {
  await db.run(sql`
    INSERT INTO ai_messages (id, conversation_id, role, content, tool_calls, created_at)
    VALUES (${crypto.randomUUID()}, ${conversationId}, ${role}, ${content},
            ${toolCalls ? JSON.stringify(toolCalls) : null}, datetime('now'))
  `);
  await db.run(sql`
    UPDATE ai_conversations SET updated_at = datetime('now') WHERE id = ${conversationId}
  `);
}

/** The system prompt that turns a raw LLM into a travel-CRM assistant. */
const SYSTEM_PROMPT = `You are TONY — the AI assistant for ZAQONE Travel CRM, a travel agency management system.

You are not a chatbot that gives advice. You are an OPERATOR: you actually perform the work in the CRM and on the public website, then report exactly what you did.

IDENTITY
- Your name is Tony. Speak in first person ("I have updated…", "SIAP — here is what I did").
- Match the user's language (Malay or English). Use plain, natural language — not corporate jargon.

HOW YOU WORK
- ALWAYS call the tools to get real data. Never invent customer names, booking references, prices, package details, dates or balances. If the data is not there, say so plainly.
- Read before you write. For any update, first call the matching read tool (get_package, list_packages, list_departures, list_website_pages…) so you use real ids and real current values.
- Get the job DONE. Never say "I would update…" or "let me know if you want me to…". Call the tool and report the result.
- Chain tools when needed. For example: list_packages → get_package → update_package → update_departure.

KNOWS EVERY PAGE AND FUNCTION IN THE CRM
- Dashboard (/dashboard): KPI, revenue trends, sales performance, top packages → get_dashboard_kpis
- Leads (/leads): pipeline stages, new enquiries, follow-ups → list_leads, update_lead, create_lead, log_lead_activity
- Customers (/customers): CRM customer records → search_customers, create_customer, update_customer
- Bookings (/bookings): confirmed reservations and pax → list_bookings, update_booking
- Packages (/packages): travel packages, prices, highlights, inclusions, day-by-day itinerary, media → list_packages, get_package, create_package_from_itinerary, update_package
- Trips / Departures (/trips): scheduled travel dates, seat capacity, manifest, checklist, supplier costs → list_departures, create_departure, update_departure, list_departure_manifest, list_checklist, list_departure_costs
- Quotations (/billing tab): price proposals → list_quotations, create_quotation
- Billing & Invoices (/billing): invoices, payments, balances → list_invoices, create_invoice, list_payments, get_invoice_balance
- Website Manager (/website): CMS pages, banners, SEO, images → list_website_pages, create_website_page, update_website_page, list_banners, update_banner, list_website_images, update_site_seo
- Settings (/settings): company profile, site branding, AI setup, booking defaults → get_settings, update_settings
- Staff & audit: list_staff, list_audit_logs (super admin only)

PACKAGES AND TRAVEL DATES — THE THINGS YOU DO BEST
- To CREATE a package: call create_package_from_itinerary with the full name, destination, duration, prices, highlights, inclusions, exclusions and the COMPLETE day-by-day itinerary (dayNumber, title, description, mealIncluded as ["B","L","D","MOB"]). Never create a package with an empty itinerary.
- To UPDATE a package: call get_package first to read the current itinerary, then call update_package with the id. When changing the itinerary, pass the FULL replacement list of days you want to keep — not just the changed day. The itinerary field replaces all existing days.
- To SCHEDULE a travel date: create_departure with packageId, departureDate (YYYY-MM-DD), returnDate (YYYY-MM-DD), seatCapacity and prices.
- To MOVE or REPRICE a travel date: update_departure with the departure id.
- Meal codes: MOB = mobile breakfast, B = breakfast, L = lunch, D = dinner.

PDF AND PASTED ITINERARIES
- When the user attaches a PDF itinerary or pastes one, extract the day-by-day plan yourself, then create the package AND the public web page, AND schedule the departure dates if dates are stated.
- Do not ask the user to re-type what the document already says.

SHOW YOUR WORK — ALWAYS
- Every tool that creates or changes a record must be reported. Start your reply with "SIAP" and then a bullet list of what changed, each with a clickable link to the record.
- The link comes from the tool result (url / urlLabel). Share it verbatim — never guess or hand-type a URL.
- End with the practical next step the staff should take (e.g. "The package is live — share this link with the customer").
- The chat already renders tool chips with links, so keep the text summary short but always include the key link for anything important.

LIMITS
- Never delete records. Never capture, verify or reject payments. Never cancel a booking. Everything else is allowed.
- Never expose API keys or secrets in your replies.
- Prices are in MYR (Ringgit).
- The public website is https://travelcrm.zaqone.com — package pages live at /site/packages/<id> and CMS pages at /site/p/<slug>.`;

/**
 * POST /ai/chat — one assistant turn.
 * Body: { messages: [{role, content}], pdfText?, conversationId? }
 * Persists both the user message and assistant reply to D1 chat history.
 * Returns: { reply, toolCalls, created, conversationId }
 */
aiRouter.post("/chat", async (c) => {
  const db = c.get("db");

  let body: {
    messages?: Array<{ role: string; content: string }>;
    pdfText?: string;
    conversationId?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const config = await loadAiConfig(db);
  if (!config) {
    return c.json(
      {
        error:
          "AI assistant is not configured. Add the provider base URL, API key and model in Settings › AI.",
        code: "ai_not_configured",
      },
      503,
    );
  }

  const staff = c.get("staff");
  const actor = {
    id: staff?.id ?? "unknown",
    email: staff?.email ?? "unknown",
    role: staff?.role ?? "management",
  };

  const conversationId = await resolveConversation(db, actor.id, body.conversationId);

  // Last user message in this turn is what we persist as the user entry.
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const userText = [...incoming].reverse().find((m) => m.role === "user")?.content ?? "";
  const storedUserText = body.pdfText?.trim()
    ? `${userText}\n[PDF itinerary dilampirkan — ${body.pdfText.trim().slice(0, 300)}…]`
    : userText;

  const messages: AiMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...incoming
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-20)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content ?? ""),
      })),
  ];

  if (body.pdfText?.trim()) {
    messages.push({
      role: "user",
      content: `Here is the itinerary document text:\n\n${body.pdfText.trim()}\n\nUse it to create the package and publish the public web page.`,
    });
  }

  if (userText.trim()) {
    await persistMessage(db, conversationId, "user", storedUserText);
  }

  const toolCalls: Array<{
    name: string;
    summary: string;
    ok: boolean;
    mutation?: boolean;
    url?: string;
    urlLabel?: string;
  }> = [];
  const created: Array<{ tool: string; summary: string; url?: string; urlLabel?: string }> = [];

  try {
    let finalReply = "";

    // Tool loop — max 6 rounds so the agent can chain calls.
    for (let round = 0; round < 6; round += 1) {
      const res = await chatCompletion(config, messages, { tools: AI_TOOLS });

      if (res.toolCalls.length === 0) {
        finalReply = res.content ?? "";
        break;
      }

      // Record the assistant turn that requested tools, including the raw
      // tool_calls — strict OpenAI-compatible providers require this.
      messages.push({
        role: "assistant",
        content: res.content ?? "",
        tool_calls: res.toolCalls,
      });

      for (const call of res.toolCalls) {
        const args = parseArgs(call.function.arguments);
        const result = await runAiTool(
          { db, actor },
          call.function.name,
          args,
        );
        toolCalls.push({
          name: call.function.name,
          summary: result.summary,
          ok: result.ok,
          mutation: result.mutation,
          url: result.url,
          urlLabel: result.urlLabel,
        });
        if (result.mutation && result.ok) {
          created.push({
            tool: call.function.name,
            summary: result.summary,
            url: result.url,
            urlLabel: result.urlLabel,
          });
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(
            result.ok
              ? { ok: true, data: result.data, url: result.url, urlLabel: result.urlLabel }
              : { ok: false, error: result.summary },
          ),
        });
      }
    }

    if (!finalReply) {
      // Agent exhausted rounds — build a clear "done + links" summary so the
      // user still sees exactly what happened and where to click.
      const lines = created.map((x) =>
        x.url ? `✅ ${x.summary} → ${x.url}` : `✅ ${x.summary}`,
      );
      finalReply =
        lines.length > 0
          ? `SIAP — berikut hasil kerja saya:\n${lines.join("\n")}`
          : "SIAP. Tiada perubahan data diperlukan untuk permintaan ini.";
    } else if (created.length > 0) {
      // The model replied but forgot to surface the links. Append them so the
      // user always sees the finished work and can click straight through.
      const missing = created.filter(
        (x) => x.url && !finalReply.includes(x.url),
      );
      if (missing.length > 0) {
        const lines = missing.map(
          (x) => `✅ ${x.summary} → ${x.url}`,
        );
        finalReply = `SIAP — berikut hasil kerja saya:\n${lines.join("\n")}\n\n${finalReply}`;
      }
    }

    await persistMessage(db, conversationId, "assistant", finalReply, toolCalls);

    return c.json({
      reply: finalReply,
      toolCalls,
      created,
      conversationId,
      model: config.model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message, code: "ai_request_failed" }, 502);
  }
});

/**
 * POST /ai/parse-pdf — upload a PDF itinerary, extract its text and return
 * the raw text so the chat can act on it.
 */
aiRouter.post("/parse-pdf", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "file field is required" }, 400);
  }
  if (file.size > 15 * 1024 * 1024) {
    return c.json({ error: "PDF is larger than 15 MB" }, 413);
  }

  const bytes = await file.arrayBuffer();
  if (!isPdf(bytes)) {
    return c.json({ error: "Only PDF files are supported here" }, 415);
  }

  const extraction = await extractPdfText(bytes);
  if (!extraction.text) {
    return c.json({
      error:
        "Could not read text from this PDF. It may be a scanned image — paste the itinerary text into the chat instead.",
      code: "pdf_no_text",
      pages: extraction.pages,
    });
  }

  // Keep the PDF in R2 so staff can download the original later.
  const key = `ai/itineraries/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  await c.env.DOCUMENTS.put(key, bytes, {
    httpMetadata: { contentType: "application/pdf" },
  });

  return c.json({
    text: extraction.text,
    pages: extraction.pages,
    key,
    url: `/api/documents/${key}`,
  });
});

/**
 * GET /ai/status — whether the assistant is configured and which model it uses.
 */
aiRouter.get("/status", async (c) => {
  const db = c.get("db");
  const rows = await db.all<{ value: unknown }>(sql`
    SELECT value FROM app_settings WHERE key = 'ai' LIMIT 1
  `);
  let configured = false;
  let model = "";
  let baseUrl = "";
  if (rows.length) {
    const raw = rows[0].value;
    const value = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<
      AiConfig & { enabled?: boolean }
    >;
    configured = Boolean(value?.baseUrl && value?.model && value?.enabled !== false);
    model = value?.model ?? "";
    baseUrl = value?.baseUrl ?? "";
  }
  return c.json({ configured, model, baseUrl });
});

/**
 * GET /ai/conversations — this staff member's chat history (newest first).
 */
aiRouter.get("/conversations", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const staffId = staff?.id ?? "unknown";
  const rows = await db.all(sql`
    SELECT cv.id, cv.title, cv.created_at AS createdAt, cv.updated_at AS updatedAt,
           (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = cv.id) AS messageCount,
           (SELECT m.content FROM ai_messages m WHERE m.conversation_id = cv.id
             AND m.role = 'user' ORDER BY m.created_at DESC LIMIT 1) AS lastMessage
    FROM ai_conversations cv
    WHERE cv.staff_id = ${staffId}
    ORDER BY cv.updated_at DESC
    LIMIT 50
  `);
  return c.json({ conversations: rows });
});

/**
 * GET /ai/conversations/:id — full message list of one conversation.
 */
aiRouter.get("/conversations/:id", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const staffId = staff?.id ?? "unknown";
  const id = c.req.param("id");

  const owned = await db.all<{ id: string }>(sql`
    SELECT id FROM ai_conversations WHERE id = ${id} AND staff_id = ${staffId} LIMIT 1
  `);
  if (!owned.length) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const rows = await db.all(sql`
    SELECT id, role, content, tool_calls AS toolCalls, created_at AS createdAt
    FROM ai_messages
    WHERE conversation_id = ${id}
    ORDER BY created_at ASC, rowid ASC
  `);
  return c.json({ conversation: { id, messages: rows } });
});

/**
 * DELETE /ai/conversations/:id — remove a conversation from the history.
 */
aiRouter.delete("/conversations/:id", async (c) => {
  const db = c.get("db");
  const staff = c.get("staff");
  const staffId = staff?.id ?? "unknown";
  const id = c.req.param("id");
  const owned = await db.all<{ id: string }>(sql`
    SELECT id FROM ai_conversations WHERE id = ${id} AND staff_id = ${staffId} LIMIT 1
  `);
  if (!owned.length) {
    return c.json({ error: "Conversation not found" }, 404);
  }
  await db.run(sql`DELETE FROM ai_messages WHERE conversation_id = ${id}`);
  await db.run(sql`DELETE FROM ai_conversations WHERE id = ${id}`);
  return c.json({ success: true });
});

export default aiRouter;

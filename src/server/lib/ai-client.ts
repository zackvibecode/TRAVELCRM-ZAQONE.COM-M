/**
 * OpenAI-compatible AI client for the CRM assistant.
 *
 * Any provider that speaks the OpenAI chat-completions API works (OpenAI,
 * OpenRouter, DeepSeek, Groq, Ollama, LM Studio, …). The base URL, API key and
 * model are read from the `ai` settings group so staff can configure the
 * assistant from the Settings screen without touching the deployment.
 */

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface AiToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface AiChatResponse {
  content: string | null;
  toolCalls: AiToolCall[];
  finishReason: string | null;
}

/** Normalise a provider base URL to always end with `/v1` style paths. */
export function normaliseBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (/\/chat\/completions$/.test(trimmed)) {
    return trimmed.replace(/\/chat\/completions$/, "");
  }
  return trimmed;
}

/** Build the chat-completions endpoint URL for a given base URL. */
export function chatEndpoint(baseUrl: string): string {
  const base = normaliseBaseUrl(baseUrl);
  if (!base) return "";
  if (/\/v\d+$/.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/** True when the URL points at a local provider that needs no API key. */
export function needsNoApiKey(baseUrl: string): boolean {
  const base = normaliseBaseUrl(baseUrl);
  return /localhost|127\.0\.0\.1|\.local|ollama/i.test(base);
}

/**
 * Call the OpenAI-compatible chat completions endpoint.
 * Throws an Error with a readable message on any failure.
 */
export async function chatCompletion(
  config: AiConfig,
  messages: AiMessage[],
  options: { tools?: AiToolDef[]; signal?: AbortSignal } = {},
): Promise<AiChatResponse> {
  const url = chatEndpoint(config.baseUrl);
  if (!url) throw new Error("AI base URL is not configured");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey && !needsNoApiKey(config.baseUrl)) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false,
  };
  if (options.tools?.length) {
    body.tools = options.tools;
    body.tool_choice = "auto";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = (await res.json()) as {
        error?: { message?: string } | string;
        message?: string;
      };
      if (typeof j.error === "string") detail = j.error;
      else if (j.error?.message) detail = j.error.message;
      else if (j.message) detail = j.message;
    } catch {
      // keep the status text
    }
    throw new Error(`AI provider error: ${detail}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
      finish_reason?: string;
    }>;
  };

  const choice = json.choices?.[0];
  const message = choice?.message;

  return {
    content: message?.content ?? null,
    toolCalls: (message?.tool_calls ?? []).map((tc, i) => ({
      id: tc.id ?? `call_${i}`,
      type: "function",
      function: {
        name: tc.function?.name ?? "",
        arguments: tc.function?.arguments ?? "{}",
      },
    })),
    finishReason: choice?.finish_reason ?? null,
  };
}

/**
 * Ask the model to answer strictly with JSON matching the given schema.
 * Uses a JSON-mode prompt and strips markdown fences when present.
 */
export async function structuredJson<T>(
  config: AiConfig,
  systemPrompt: string,
  userContent: string,
): Promise<T> {
  const res = await chatCompletion(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ]);

  const raw = (res.content ?? "").trim();
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the first JSON object/array found in the text.
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        // fall through
      }
    }
    throw new Error("AI response was not valid JSON");
  }
}

// ---------------------------------------------------------------------------
// Cloudflare Workers AI adapter — used by the background AI workers (package
// enrichment, PDF sync, price checks). Workers AI needs no API key: the
// binding runs models directly inside the Worker. When the OpenAI-compatible
// provider is configured (Settings > AI), it takes precedence; Workers AI is
// the always-available fallback so workers never stall on a missing key.
// ---------------------------------------------------------------------------

/** Default Workers AI model: strong instruction following, fast, cheap. */
export const WORKERS_AI_DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export interface WorkersAiChatOptions {
  system: string;
  user: string;
  /** Override the model (default WORKERS_AI_DEFAULT_MODEL). */
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * One-shot chat completion through the Cloudflare Workers AI binding.
 * Returns the assistant text. Throws when the binding is unavailable.
 *
 * Workers AI models return different shapes depending on the model family:
 * - `{ response: string }` (classic completions)
 * - `{ choices: [{ message: { content } }] }` (chat-completions style)
 * - occasionally a nested object under `response`. Normalise all of them.
 */
export async function workersAiChat(
  ai: Ai,
  options: WorkersAiChatOptions,
): Promise<string> {
  const model = options.model?.trim() || WORKERS_AI_DEFAULT_MODEL;
  const result: unknown = await ai.run(model, {
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.user },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 4000,
  });

  const text = extractResponseText(result);
  if (!text) throw new Error("Workers AI returned an empty response");
  return text;
}

/** Pull the assistant text out of any known Workers AI response shape. */
function extractResponseText(result: unknown): string {
  if (typeof result === "string") return result.trim();

  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;

    // Chat-completions style: { choices: [{ message: { content } }] }
    if (Array.isArray(obj.choices) && obj.choices.length) {
      const first = obj.choices[0] as { message?: { content?: unknown } };
      const content = first?.message?.content;
      if (typeof content === "string") return content.trim();
    }

    // Classic style: { response: string } — or a nested object to dig into.
    const response = obj.response;
    if (typeof response === "string") return response.trim();
    if (response && typeof response === "object") {
      const nested = response as Record<string, unknown>;
      if (typeof nested.content === "string") return nested.content.trim();
      if (typeof nested.text === "string") return nested.text.trim();
      if (typeof nested.response === "string") return nested.response.trim();
    }

    // Last resort: serialise so parseLooseJson can still fish the JSON out.
    try {
      return JSON.stringify(result);
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * Extract the first balanced JSON value ({...} or [...]) from text.
 * Counts nesting depth and respects string literals, so prose containing
 * braces after the JSON (or before it) cannot break the extraction.
 */
function extractBalancedJson(text: string): string | null {
  const start = text.search(/[[{]/);
  if (start < 0) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse a loose JSON object out of an LLM reply (same leniency as structuredJson). */
export function parseLooseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // The model wrapped the JSON in prose — pull out the first balanced value.
    const candidate = extractBalancedJson(cleaned);
    if (candidate) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // fall through
      }
    }
    throw new Error(
      "AI response was not valid JSON — sila cuba muat naik PDF sekali lagi",
    );
  }
}

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

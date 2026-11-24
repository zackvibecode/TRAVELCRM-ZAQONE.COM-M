import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  Paperclip,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  User,
  X,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

interface ToolCall {
  name: string;
  summary: string;
  ok: boolean;
  mutation?: boolean;
  url?: string;
  urlLabel?: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage: string | null;
}

const SUGGESTIONS = [
  { ms: "Tunjukkan lead baru minggu ini", en: "Show me new leads this week" },
  { ms: "Berapa baki invois INV-2026-0001?", en: "What's the balance on INV-2026-0001?" },
  { ms: "Keberangkatan mana yang hampir penuh?", en: "Which departures are almost full?" },
  { ms: "Saya ada PDF itinerary — jana pakej & halaman web", en: "I have a PDF itinerary — build the package & web page" },
  { ms: "Kemas kini harga pakej Shanghai Disneyland", en: "Update the price for the Shanghai Disneyland package" },
  { ms: "Tambah tarikh keberangkatan 20 Dis 2026", en: "Add a departure on 20 Dec 2026" },
];

/** Local cache key so a page reload keeps the visible transcript. */
const LOCAL_TRANSCRIPT_KEY = "travelcrm.tony.transcript.v1";
const LOCAL_CONVERSATION_KEY = "travelcrm.tony.conversationId.v1";

/* ------------------------------------------------------------------ */
/* Chat transcript + composer (shared by the page and the floating FAB) */
/* ------------------------------------------------------------------ */

function ToolCallList({ calls }: { calls: ToolCall[] }) {
  const { t } = useLang();
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {calls.map((tc, k) => (
        <li
          key={k}
          className="flex flex-wrap items-start gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1.5 text-[12px]"
        >
          {tc.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-600" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 flex-none text-red-500" />
          )}
          <span className="min-w-0 flex-1">
            <code className="font-mono text-[11px] font-semibold text-[var(--color-primary)]">
              {tc.name}
            </code>
            <span className="ml-1.5 text-muted-foreground">{tc.summary}</span>
          </span>
          {tc.url && (
            <a
              href={tc.url}
              target={tc.url.startsWith("/site") ? "_blank" : undefined}
              rel="noreferrer"
              className="inline-flex flex-none items-center gap-1 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]"
            >
              {tc.urlLabel ?? t("Buka", "Open")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function ChatBody({
  messages,
  busy,
  compact,
  onSuggest,
}: {
  messages: ChatMessage[];
  busy: boolean;
  compact?: boolean;
  onSuggest?: (text: string) => void;
}) {
  const { t } = useLang();
  return (
    <>
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <Bot className="h-6 w-6" />
          </span>
          <p className="max-w-md text-[13.5px] text-muted-foreground">
            {t(
              "Saya Tony. Saya boleh semak lead, tempahan, invois dan pakej; kemas kini pakej dan tarikh perjalanan; jana pakej + halaman web daripada PDF itinerary; dan urus laman web. Setiap kerja yang siap saya tunjuk dengan pautan terus.",
              "I'm Tony. I can check leads, bookings, invoices and packages; update packages and travel dates; build packages + web pages from a PDF itinerary; and manage the website. Every finished job comes back with a direct link.",
            )}
          </p>
          {!compact && onSuggest && (
            <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.en}
                  type="button"
                  onClick={() => onSuggest(t(s.ms, s.en))}
                  className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2 text-left text-[12.5px] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                >
                  {t(s.ms, s.en)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} className="flex items-start gap-3">
          <span
            className={cn(
              "grid flex-none place-items-center rounded-full",
              compact ? "h-7 w-7" : "h-8 w-8",
              m.role === "user"
                ? "bg-[var(--color-surface-muted)] text-muted-foreground"
                : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
            )}
          >
            {m.role === "user" ? (
              <User className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            ) : (
              <Bot className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--color-text)]">
              {m.content}
            </div>
            {m.toolCalls?.length ? <ToolCallList calls={m.toolCalls} /> : null}
          </div>
        </div>
      ))}

      {busy && (
        <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("AI sedang buat kerja…", "The assistant is working…")}
        </div>
      )}
    </>
  );
}

/**
 * Wrapper that owns the chat state, PDF attachment and API calls.
 * `onConversationChange` lets the parent keep the history list in sync.
 */
function useChat(
  onConversationChange?: (id: string) => void,
  instance: "page" | "fab" = "page",
) {
  const { t } = useLang();
  // Each surface (full page and floating FAB) keeps its own local cache so
  // opening the FAB never wipes out a longer page conversation.
  const transcriptKey = `${LOCAL_TRANSCRIPT_KEY}.${instance}`;
  const conversationKey = `${LOCAL_CONVERSATION_KEY}.${instance}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Restore the visible transcript immediately so a reload never shows an
    // empty chat while the server history is still loading.
    try {
      const raw = localStorage.getItem(transcriptKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ChatMessage[]) : [];
    } catch {
      return [];
    }
  });
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(conversationKey);
    } catch {
      return null;
    }
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pdfText, setPdfText] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  // Persist the transcript locally so the chat survives a page reload.
  useEffect(() => {
    try {
      localStorage.setItem(transcriptKey, JSON.stringify(messages));
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, [messages, transcriptKey]);

  useEffect(() => {
    try {
      if (conversationId) {
        localStorage.setItem(conversationKey, conversationId);
      } else {
        localStorage.removeItem(conversationKey);
      }
    } catch {
      /* ignore */
    }
  }, [conversationId, conversationKey]);

  async function uploadPdf(file: File) {
    setUploading(true);
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch<{ text?: string; pages?: number; error?: string }>(
        "/ai/parse-pdf",
        { method: "POST", body: form },
      );
      if (res.error) {
        setNotice(res.error);
        return;
      }
      setPdfText(res.text ?? "");
      setPdfName(`${file.name} (${res.pages ?? 0} halaman)`);
      setNotice(
        t(
          `PDF dibaca — ${res.pages ?? 0} halaman. Tekan Hantar untuk jana pakej & halaman web.`,
          `PDF read — ${res.pages ?? 0} pages. Press Send to build the package & web page.`,
        ),
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : t("Gagal membaca PDF.", "Failed to read the PDF."),
      );
    } finally {
      setUploading(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await apiFetch<{
        reply?: string;
        error?: string;
        toolCalls?: ToolCall[];
        conversationId?: string;
      }>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          pdfText: pdfText || undefined,
          conversationId: conversationId || undefined,
        }),
      });
      if (res.error) {
        setMessages([...next, { role: "assistant", content: `⚠️ ${res.error}` }]);
        return;
      }
      setMessages([
        ...next,
        { role: "assistant", content: res.reply ?? "", toolCalls: res.toolCalls ?? [] },
      ]);
      if (res.conversationId) {
        setConversationId(res.conversationId);
        onConversationChange?.(res.conversationId);
      }
      setPdfText("");
      setPdfName("");
    } catch (e) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : t("Ralat tidak diketahui.", "Unknown error.")}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setConversationId(null);
    setMessages([]);
    setPdfText("");
    setPdfName("");
    setNotice("");
    try {
      localStorage.removeItem(transcriptKey);
      localStorage.removeItem(conversationKey);
    } catch {
      /* ignore */
    }
  }

  function clearPdf() {
    setPdfText("");
    setPdfName("");
  }

  async function loadConversation(id: string) {
    try {
      const res = await apiFetch<{
        conversation?: { id: string; messages?: ChatMessage[] };
      }>(`/ai/conversations/${id}`);
      const list = res.conversation?.messages ?? [];
      setMessages(
        list.map((m) => ({
          role: m.role,
          content: m.content,
          toolCalls: (m.toolCalls as ToolCall[] | undefined) ?? undefined,
        })),
      );
      setConversationId(id);
    } catch {
      /* ignore */
    }
  }

  // On first mount, pull the server-side transcript for the stored conversation
  // so the chat history is never empty after a reload. The local cache renders
  // instantly; this replaces it with the authoritative server copy.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const id = conversationId;
    if (!id) return;
    void (async () => {
      try {
        const res = await apiFetch<{
          conversation?: { id: string; messages?: ChatMessage[] };
        }>(`/ai/conversations/${id}`);
        const list = res.conversation?.messages ?? [];
        if (list.length) {
          setMessages(
            list.map((m) => ({
              role: m.role,
              content: m.content,
              toolCalls: (m.toolCalls as ToolCall[] | undefined) ?? undefined,
            })),
          );
        }
      } catch {
        /* keep the local cache if the server is unreachable */
      }
    })();
  }, [conversationId]);

  return {
    messages,
    setMessages,
    conversationId,
    setConversationId,
    input,
    setInput,
    busy,
    notice,
    pdfText,
    pdfName,
    uploading,
    scrollRef,
    fileRef,
    uploadPdf,
    send,
    reset,
    clearPdf,
    loadConversation,
  };
}

function Composer({
  chat,
  compact,
}: {
  chat: ReturnType<typeof useChat>;
  compact?: boolean;
}) {
  const { t } = useLang();
  return (
    <div
      className={cn(
        "rounded-[var(--radius-panel)] border bg-[var(--color-surface)]",
        compact ? "p-2.5" : "p-3",
      )}
    >
      {chat.pdfText && (
        <div className="mb-2 flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-2.5 py-1.5 text-[12px] text-[var(--color-primary)]">
          <FileText className="h-3.5 w-3.5 flex-none" />
          <span className="min-w-0 flex-1 truncate">{chat.pdfName}</span>
          <button
            type="button"
            onClick={() => chat.clearPdf()}
            className="flex-none"
            aria-label={t("Buang PDF", "Remove PDF")}
          >
            <XCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {chat.notice && <p className="mb-2 text-[12px] text-muted-foreground">{chat.notice}</p>}

      <div className="flex items-end gap-2">
        <input
          ref={chat.fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void chat.uploadPdf(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => chat.fileRef.current?.click()}
          disabled={chat.uploading || chat.busy}
          title={t("Lampirkan PDF itinerary", "Attach itinerary PDF")}
          className="grid h-9 w-9 flex-none place-items-center rounded-md border text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
        >
          {chat.uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Paperclip className="h-4 w-4" />
          )}
        </button>
        <textarea
          value={chat.input}
          onChange={(e) => chat.setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void chat.send(chat.input);
            }
          }}
          rows={2}
          placeholder={t(
            "Tanya soalan, atau lampirkan PDF itinerary…",
            "Ask a question, or attach a PDF itinerary…",
          )}
          className="min-h-[38px] flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-[13.5px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button
          onClick={() => void chat.send(chat.input)}
          disabled={chat.busy || !chat.input.trim()}
        >
          <Send className="h-4 w-4" />
          {compact ? "" : t("Hantar", "Send")}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Full page                                                           */
/* ------------------------------------------------------------------ */

export default function AiAssistant() {
  const { t } = useLang();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const chat = useChat(() => void loadConversations());

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ configured?: boolean; model?: string }>(
          "/ai/status",
        );
        setConfigured(Boolean(res.configured));
        setModel(res.model ?? "");
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  // Load the chat history list as soon as the page opens — previously the
  // drawer was always empty because this never ran.
  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    try {
      const res = await apiFetch<{ conversations?: Conversation[] }>("/ai/conversations");
      setConversations(res.conversations ?? []);
    } catch {
      setConversations([]);
    }
  }

  async function deleteConversation(id: string) {
    try {
      await apiFetch(`/ai/conversations/${id}`, { method: "DELETE" });
      if (chat.conversationId === id) chat.reset();
      await loadConversations();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[520px] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="tvl-title flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--color-primary)]" />
            {t("TONY — Pembantu AI", "TONY — AI Assistant")}
          </h1>
          <p className="tvl-subtitle">
            {t(
              "Tony urus CRM & laman web sepenuhnya: semak lead, kemas kini pakej dan tarikh perjalanan, jana pakej dari PDF itinerary — dan tunjuk hasil kerja dengan pautan terus.",
              "Tony runs the CRM and website end to end: check leads, update packages and travel dates, build packages from PDF itineraries — and shows the finished work with direct links.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {model && (
            <span className="rounded-full border bg-[var(--color-surface-muted)] px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
              {model}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-3.5 w-3.5" />
            {t("Sejarah", "History")}
          </Button>
          <Button variant="outline" size="sm" onClick={chat.reset}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {t("Chat Baru", "New Chat")}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/settings">
              <Settings2 className="h-3.5 w-3.5" />
              {t("Konfigurasi AI", "AI Setup")}
            </a>
          </Button>
        </div>
      </div>

      {configured === false && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-4 text-[13px] text-[var(--color-warning)]">
          {t(
            "Pembantu AI belum dikonfigurasi. Buka Tetapan › AI untuk masukkan base URL, API key dan model provider.",
            "The AI assistant is not configured yet. Open Settings › AI to enter the provider base URL, API key and model.",
          )}
        </div>
      )}

      <div
        ref={chat.scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-4"
      >
        <ChatBody
          messages={chat.messages}
          busy={chat.busy}
          onSuggest={(text) => void chat.send(text)}
        />
      </div>

      <Composer chat={chat} />

      {historyOpen && (
        <HistoryDrawer
          conversations={conversations}
          onClose={() => setHistoryOpen(false)}
          onOpen={async (id) => {
            await chat.loadConversation(id);
            setHistoryOpen(false);
          }}
          onDelete={deleteConversation}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History drawer                                                      */
/* ------------------------------------------------------------------ */

function HistoryDrawer({
  conversations,
  onClose,
  onOpen,
  onDelete,
}: {
  conversations: Conversation[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useLang();
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex h-full w-[min(400px,92vw)] flex-col bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-display text-[15px] font-bold">
            {t("Sejarah Chat", "Chat History")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label={t("Tutup", "Close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {conversations.length === 0 ? (
            <p className="p-6 text-center text-[13px] text-muted-foreground">
              {t("Belum ada sejarah chat.", "No chat history yet.")}
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {conversations.map((cv) => (
                <li
                  key={cv.id}
                  className="group flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-surface-muted)]"
                >
                  <button
                    type="button"
                    onClick={() => onOpen(cv.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-[13px] font-semibold text-[var(--color-text)]">
                      {cv.lastMessage ?? cv.title}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {cv.messageCount} {t("mesej ·", "messages ·")}{" "}
                      {new Date(cv.updatedAt).toLocaleString()}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(cv.id)}
                    className="flex-none rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] group-hover:opacity-100"
                    aria-label={t("Padam chat", "Delete chat")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Floating assistant (bottom-right round button on every CRM page)    */
/* ------------------------------------------------------------------ */

export function AiAssistantFab() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const chat = useChat(() => void loadConversations(), "fab");
  const { pathname } = useLocation();

  useEffect(() => setMounted(true), []);

  // Load the history list so the FAB's history drawer is never empty.
  useEffect(() => {
    void loadConversations();
  }, []);

  async function loadConversations() {
    try {
      const res = await apiFetch<{ conversations?: Conversation[] }>("/ai/conversations");
      setConversations(res.conversations ?? []);
    } catch {
      setConversations([]);
    }
  }

  async function deleteConversation(id: string) {
    try {
      await apiFetch(`/ai/conversations/${id}`, { method: "DELETE" });
      if (chat.conversationId === id) chat.reset();
      await loadConversations();
    } catch {
      /* ignore */
    }
  }

  // The full page already shows the assistant — no floating bubble there.
  if (!mounted || pathname.startsWith("/ai-assistant")) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("Buka Tony, Pembantu AI", "Open Tony, the AI Assistant")}
        title={t("Tony — Pembantu AI", "Tony — AI Assistant")}
        className="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-[0_10px_30px_rgba(0,0,0,0.28)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-[min(560px,100vw)] flex-col bg-[var(--color-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold">
                <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
                {t("TONY", "TONY")}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  title={t("Sejarah Chat", "Chat History")}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label={t("Sejarah Chat", "Chat History")}
                >
                  <History className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label={t("Tutup", "Close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div
                ref={chat.scrollRef}
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
              >
                <ChatBody messages={chat.messages} busy={chat.busy} compact />
              </div>
              <Composer chat={chat} compact />
            </div>
          </div>

          {historyOpen && (
            <HistoryDrawer
              conversations={conversations}
              onClose={() => setHistoryOpen(false)}
              onOpen={async (id) => {
                await chat.loadConversation(id);
                setHistoryOpen(false);
              }}
              onDelete={deleteConversation}
            />
          )}
        </div>
      )}
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  KeyRound,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  RotateCw,
  ScrollText,
  Server,
  Sparkles,
  Wrench,
  XCircle,
  Plug,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AuditOutcome = "success" | "denied" | "error";
type McpTab = "tools" | "tokens" | "resources" | "safety" | "logs";
type TokenRole = "Sales" | "Operations" | "Finance" | "Management";

interface AuditEntry {
  id: string;
  timestamp: string;
  tokenName: string;
  role: string;
  tool: string;
  argsSummary: string;
  outcome: AuditOutcome;
  deniedReason?: string;
  durationMs: number;
}

interface McpTool {
  id: string;
  name: string;
  desc: { ms: string; en: string };
  calls: number;
  on: boolean;
}

interface McpToken {
  id: string;
  label: string;
  prefix: string;
  role: TokenRole;
  scopes: string[];
  created: string;
  last: string;
  expires: string;
  state: "active" | "revoked";
}

const STUB_AUDIT: AuditEntry[] = [
  { id: "mcp_01", timestamp: "2026-11-17 09:41", tokenName: "Claude Desktop — Owner", role: "super_admin", tool: "search_customers", argsSummary: 'query="Ahmad Zulkifli"', outcome: "success", durationMs: 120 },
  { id: "mcp_02", timestamp: "2026-11-17 09:38", tokenName: "Sales Bot — WhatsApp Assistant", role: "sales", tool: "get_booking", argsSummary: "ref=ZQK-2026-0114", outcome: "success", durationMs: 96 },
  { id: "mcp_03", timestamp: "2026-11-17 09:35", tokenName: "Sales Bot — WhatsApp Assistant", role: "sales", tool: "create_booking_draft", argsSummary: "departure=DEP-3312, pax=4", outcome: "denied", deniedReason: "Tool disabled by admin", durationMs: 38 },
  { id: "mcp_04", timestamp: "2026-11-17 09:28", tokenName: "Finance Report Sync", role: "finance", tool: "get_invoice_balance", argsSummary: "invoice=INV-2026-0184", outcome: "success", durationMs: 88 },
  { id: "mcp_05", timestamp: "2026-11-17 09:21", tokenName: "Ops automation runner", role: "operations", tool: "list_departures", argsSummary: 'month="2026-12"', outcome: "error", durationMs: 118 },
  { id: "mcp_06", timestamp: "2026-11-17 09:14", tokenName: "Old IDE Agent", role: "sales", tool: "check_seat_availability", argsSummary: "departure=DEP-3308", outcome: "denied", deniedReason: "Token revoked", durationMs: 24 },
];

const READ_TOOLS: McpTool[] = [
  { id: "r1", name: "list_leads", desc: { ms: "Leads dengan tapisan tahap, pemilik, sumber & tarikh.", en: "Sales leads with stage, owner, source and date filters." }, calls: 1284, on: true },
  { id: "r2", name: "get_lead", desc: { ms: "Satu lead dengan garis masa aktiviti & peringatan susulan.", en: "One lead with its activity timeline and follow-up reminders." }, calls: 486, on: true },
  { id: "r3", name: "list_bookings", desc: { ms: "Tempahan ditapis status, pakej, keberangkatan & tempoh.", en: "Bookings filtered by status, package, departure and period." }, calls: 932, on: true },
  { id: "r4", name: "get_booking", desc: { ms: "Detail tempahan dengan penumpang, keadaan kerusi & bayaran.", en: "Booking detail with passengers, seat state and payment status." }, calls: 741, on: true },
  { id: "r5", name: "check_seat_availability", desc: { ms: "Kerusi disahkan, dipegang & tersedia untuk keberangkatan.", en: "Confirmed, held and available seats for a departure." }, calls: 1105, on: true },
  { id: "r6", name: "list_packages", desc: { ms: "Pakej terbit & draf dengan paras harga.", en: "Published and draft packages with pricing tiers." }, calls: 610, on: true },
  { id: "r7", name: "list_departures", desc: { ms: "Kalendar keberangkatan dengan penghunian & status.", en: "Departure calendar with occupancy and status." }, calls: 524, on: true },
  { id: "r8", name: "get_invoice_balance", desc: { ms: "Jumlah invois, bayaran disahkan & baki tertunggak.", en: "Invoice totals, verified payments and outstanding balance." }, calls: 398, on: true },
  { id: "r9", name: "search_customers", desc: { ms: "Carian pelanggan mengikut nama, telefon atau emel.", en: "Customer search by name, phone or email." }, calls: 640, on: true },
];

const WRITE_TOOLS: McpTool[] = [
  { id: "w1", name: "create_lead", desc: { ms: "Cipta lead dengan pengesahan sama seperti borang CRM.", en: "Creates a lead with the same validation as the CRM form." }, calls: 87, on: true },
  { id: "w2", name: "log_lead_activity", desc: { ms: "Rekod nota, panggilan atau susulan pada lead sedia ada.", en: "Logs a note, call or follow-up against an existing lead." }, calls: 214, on: true },
  { id: "w3", name: "create_booking_draft", desc: { ms: "Cipta draf tempahan dan pegang kerusi secara atomik.", en: "Creates a draft booking and holds seats atomically." }, calls: 64, on: false },
  { id: "w4", name: "record_payment_note", desc: { ms: "Rekod nota bayaran dalaman menunggu pengesahan kewangan.", en: "Records an internal payment note awaiting finance verification." }, calls: 12, on: false },
];

const RESOURCES = [
  { id: "s1", uri: "crm://packages/catalog", label: { ms: "Katalog pakej", en: "Package catalog" }, desc: { ms: "Senarai pakej baca-sahaja dengan harga & status terbit.", en: "Read-only package list with prices and publish status." }, age: "4 min" },
  { id: "s2", uri: "crm://departures/calendar", label: { ms: "Kalendar keberangkatan", en: "Departure calendar" }, desc: { ms: "Keberangkatan akan datang, kapasiti & kerusi berbaki.", en: "Upcoming departures, capacity and seats remaining." }, age: "4 min" },
  { id: "s3", uri: "crm://billing/outstanding", label: { ms: "Baki tertunggak", en: "Outstanding balances" }, desc: { ms: "Invois belum dibayar & tertunggak mengikut pelanggan.", en: "Unpaid and overdue invoices per customer." }, age: "9 min" },
];

const PROMPTS = [
  { id: "p1", label: "daily_followup_list", desc: { ms: "Leads dengan susulan tertunggak hari ini, mengikut ejen.", en: "Leads with a follow-up due today, grouped by agent." } },
  { id: "p2", label: "overdue_payment_summary", desc: { ms: "Invois tertunggak dengan baki, tarikh akhir & pemilik.", en: "Overdue invoices with balance, due date and owner." } },
  { id: "p3", label: "low_seat_departures", desc: { ms: "Keberangkatan bawah ambang kerusi dipilih.", en: "Departures below a chosen seat threshold." } },
];

const ROLE_MATRIX = [
  { role: { ms: "Super Admin", en: "Super Admin" }, read: { ms: "Semua alat baca", en: "All read tools" }, write: { ms: "Semua alat tulis", en: "All write tools" }, sensitive: { ms: "Akses pasport & bukti", en: "Passport & proof access" }, deny: false },
  { role: { ms: "Pengurusan", en: "Management" }, read: { ms: "Semua alat baca", en: "All read tools" }, write: { ms: "lead + aktiviti", en: "lead + activity" }, sensitive: { ms: "Baca pasport (URL ditandatangani)", en: "Passport read (signed URL)" }, deny: false },
  { role: { ms: "Jualan", en: "Sales" }, read: { ms: "leads, tempahan, kerusi, pakej, pelanggan", en: "leads, bookings, seats, packages, customers" }, write: { ms: "create_lead, log_lead_activity", en: "create_lead, log_lead_activity" }, sensitive: { ms: "Tiada akses", en: "No access" }, deny: true },
  { role: { ms: "Kewangan", en: "Finance" }, read: { ms: "billing, tempahan, pelanggan", en: "billing, bookings, customers" }, write: { ms: "record_payment_note", en: "record_payment_note" }, sensitive: { ms: "Akses bukti (URL ditandatangani)", en: "Proof access (signed URL)" }, deny: false },
  { role: { ms: "Operasi", en: "Operations" }, read: { ms: "keberangkatan, kerusi, penumpang, pakej", en: "departures, seats, passengers, packages" }, write: { ms: "log_lead_activity", en: "log_lead_activity" }, sensitive: { ms: "Baca pasport (URL ditandatangani)", en: "Passport read (signed URL)" }, deny: false },
];

const ROLE_SCOPES: Record<TokenRole, string[]> = {
  Sales: ["leads:read", "bookings:read", "seats:read", "packages:read", "customers:read", "leads:write"],
  Operations: ["departures:read", "seats:read", "passengers:read", "packages:read"],
  Finance: ["billing:read", "bookings:read", "customers:read", "billing:write"],
  Management: ["leads:read", "bookings:read", "seats:read", "billing:read", "passengers:read", "leads:write"],
};

const INITIAL_TOKENS: McpToken[] = [
  { id: "k1", label: "Claude Desktop — Sales", prefix: "mcp_live_7fA2", role: "Sales", scopes: ROLE_SCOPES.Sales.slice(0, 3), created: "12 Jan 2026", last: "Hari ini, 09:21", expires: "12 Jul 2026", state: "active" },
  { id: "k2", label: "Ops automation runner", prefix: "mcp_live_3cD9", role: "Operations", scopes: ROLE_SCOPES.Operations.slice(0, 3), created: "4 Dis 2025", last: "Semalam, 18:04", expires: "4 Dis 2026", state: "active" },
  { id: "k3", label: "WhatsApp bot (read-only)", prefix: "mcp_live_b81E", role: "Sales", scopes: ["packages:read", "seats:read"], created: "22 Nov 2025", last: "8 Nov, 11:30", expires: "22 Nov 2026", state: "active" },
  { id: "k4", label: "Finance assistant trial", prefix: "mcp_test_04Ka", role: "Finance", scopes: ["billing:read"], created: "2 Okt 2025", last: "14 Dis 2025", expires: "—", state: "revoked" },
];

const SECRET_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function buildSecret(seed: number): string {
  let out = "";
  for (let i = 0; i < 28; i += 1) {
    out += SECRET_ALPHABET[(seed * 7 + i * 13 + 11) % SECRET_ALPHABET.length];
  }
  return `mcp_live_${out}`;
}

const ENDPOINT = "https://mcp.zaqone.my/v1";

export default function McpAuditLog() {
  const { t } = useLang();
  const [tab, setTab] = useState<McpTab>("tools");
  const [server, setServer] = useState<"active" | "restarting">("active");
  const [readTools, setReadTools] = useState(READ_TOOLS);
  const [writeTools, setWriteTools] = useState(WRITE_TOOLS);
  const [tokens, setTokens] = useState<McpToken[]>(INITIAL_TOKENS);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | AuditOutcome>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<McpToken | null>(null);
  const [form, setForm] = useState<{ label: string; role: TokenRole }>({ label: "", role: "Sales" });
  const [formError, setFormError] = useState("");
  const [createdSecret, setCreatedSecret] = useState<{ label: string; secret: string } | null>(null);
  const seedRef = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);
  const restartTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(noticeTimer.current);
      window.clearTimeout(restartTimer.current);
    },
    [],
  );

  function showNotice(message: string) {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 4000);
  }

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      showNotice(message);
    } catch {
      showNotice(t("Salin tidak tersedia — pilih teks secara manual", "Copy unavailable — select the text manually"));
    }
  }

  function toggleTool(id: string, scope: "read" | "write") {
    const setter = scope === "read" ? setReadTools : setWriteTools;
    setter((current) =>
      current.map((tool) => {
        if (tool.id !== id) return tool;
        showNotice(`${tool.name} ${tool.on ? t("dilumpuhkan", "disabled") : t("didayakan", "enabled")}`);
        return { ...tool, on: !tool.on };
      }),
    );
  }

  function restartServer() {
    setServer("restarting");
    window.clearTimeout(restartTimer.current);
    restartTimer.current = window.setTimeout(() => {
      setServer("active");
      showNotice(t("Pelayan MCP dimulakan semula — 3 klien disambung semula", "MCP server restarted — 3 clients reconnected"));
    }, 1200);
  }

  function setAllTools(on: boolean) {
    setReadTools((c) => c.map((tool) => ({ ...tool, on })));
    setWriteTools((c) => c.map((tool) => ({ ...tool, on })));
    showNotice(on ? t("Semua alat diiklankan kepada klien", "All tools advertised to clients") : t("Semua alat disembunyikan daripada klien", "All tools hidden from clients"));
  }

  function submitToken() {
    if (!form.label.trim()) {
      setFormError(t("Nama token wajib diisi", "Token name is required"));
      return;
    }
    seedRef.current += 1;
    const secret = buildSecret(seedRef.current + 3);
    const token: McpToken = {
      id: `k-new-${seedRef.current}`,
      label: form.label.trim(),
      prefix: secret.slice(0, 14),
      role: form.role,
      scopes: ROLE_SCOPES[form.role],
      created: t("Baru saja", "Just now"),
      last: t("Belum digunakan", "Never used"),
      expires: t("Dalam 180 hari", "In 180 days"),
      state: "active",
    };
    setTokens((current) => [token, ...current]);
    setCreatedSecret({ label: token.label, secret });
    showNotice(t(`Token untuk ${token.label} dicipta`, `Token for ${token.label} created`));
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    setTokens((current) => current.map((item) => (item.id === revokeTarget.id ? { ...item, state: "revoked" } : item)));
    showNotice(t(`${revokeTarget.label} dibatalkan — permintaan kini ditolak`, `${revokeTarget.label} revoked — requests now rejected`));
    setRevokeTarget(null);
  }

  function rotateToken(token: McpToken) {
    seedRef.current += 1;
    setTokens((current) => current.map((item) => (item.id === token.id ? { ...item, last: t("Dirotate baru saja", "Rotated just now") } : item)));
    showNotice(t(`${token.label} dirotate — rahsia terdahulu tidak sah`, `${token.label} rotated — previous secret invalidated`));
  }

  const allTools = useMemo(() => [...readTools, ...writeTools], [readTools, writeTools]);
  const activeTools = allTools.filter((tool) => tool.on).length;
  const activeTokens = tokens.filter((tk) => tk.state === "active").length;
  const totalCalls = allTools.reduce((sum, tool) => sum + tool.calls, 0);
  const deniedCalls = STUB_AUDIT.filter((e) => e.outcome === "denied").length;

  const entries = useMemo(
    () =>
      STUB_AUDIT.filter((e) => {
        if (filter !== "all" && e.outcome !== filter) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          e.tokenName.toLowerCase().includes(q) ||
          e.tool.toLowerCase().includes(q) ||
          e.argsSummary.toLowerCase().includes(q)
        );
      }),
    [filter, search],
  );

  const tabs: { id: McpTab; label: { ms: string; en: string }; count: number }[] = [
    { id: "tools", label: { ms: "Alat", en: "Tools" }, count: allTools.length },
    { id: "tokens", label: { ms: "Token", en: "Tokens" }, count: tokens.length },
    { id: "resources", label: { ms: "Sumber & Prom", en: "Resources & Prompts" }, count: RESOURCES.length + PROMPTS.length },
    { id: "safety", label: { ms: "Keselamatan", en: "Safety" }, count: ROLE_MATRIX.length + 1 },
    { id: "logs", label: { ms: "Log Audit", en: "Audit Log" }, count: STUB_AUDIT.length },
  ];

  function outcomeBadge(outcome: AuditOutcome) {
    if (outcome === "success")
      return { label: t("Berjaya", "Success"), cls: "border-emerald-200 bg-emerald-50 text-emerald-700" };
    if (outcome === "denied")
      return { label: t("Ditolak", "Denied"), cls: "border-amber-200 bg-amber-50 text-amber-700" };
    return { label: t("Ralat", "Error"), cls: "border-red-200 bg-red-50 text-red-700" };
  }

  const pillCls = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap";
  const switchCls = (on: boolean) =>
    cn(
      "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
      on ? "bg-emerald-500" : "bg-muted-foreground/30",
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Pelayan MCP", "MCP Server")}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className={cn("inline-flex items-center gap-1.5 font-semibold", server === "active" ? "text-emerald-600" : "text-amber-600")}>
              {server === "active" ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
              {server === "active" ? t("Pelayan dalam talian", "Server online") : t("Memulakan semula…", "Restarting…")}
            </span>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{ENDPOINT}</code>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Streamable HTTP</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => showNotice(t("Panduan sambungan dibuka", "Connection guide opened"))}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted/50"
          >
            <BookOpen className="h-4 w-4" />
            {t("Panduan Sambungan", "Connection Guide")}
          </button>
          <button
            onClick={restartServer}
            disabled={server !== "active"}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            <RotateCw className="h-4 w-4" />
            {t("Mulakan Semula", "Restart")}
          </button>
        </div>
      </div>

      {/* Endpoint quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border bg-[var(--color-surface)] px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[12.5px] font-semibold text-muted-foreground">{t("Endpoint", "Endpoint")}</span>
          <code className="overflow-wrap-anywhere rounded bg-muted px-2 py-0.5 font-mono text-xs">{ENDPOINT}</code>
          <button
            onClick={() => copyText(ENDPOINT, t("Endpoint disalin", "Endpoint copied"))}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted/50"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("Salin", "Copy")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() =>
              copyText(
                `{\n  "mcpServers": {\n    "zaqone-crm": {\n      "url": "${ENDPOINT}",\n      "headers": { "Authorization": "Bearer <token>" }\n    }\n  }\n}`,
                t("Konfigurasi klien disalin", "Client configuration copied"),
              )
            }
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted/50"
          >
            <Copy className="h-3.5 w-3.5" />
            {t("Salin konfigurasi klien", "Copy client config")}
          </button>
          <button
            onClick={() => setTab("tokens")}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted/50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            {t("Terbitkan token", "Issue token")}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {[
          { label: t("Status pelayan", "Server status"), icon: Server, value: server === "active" ? t("Dalam talian", "Online") : t("Memulakan semula", "Restarting"), note: t("99.96% uptime (30 hari)", "99.96% uptime (30 days)"), tone: "ok" },
          { label: t("Klien disambung", "Connected clients"), icon: Plug, value: "3", note: t("2 assistant, 1 bot dalaman", "2 assistants, 1 internal bot") },
          { label: t("Alat didayakan", "Tools enabled"), icon: Wrench, value: `${activeTools}/${allTools.length}`, note: t(`${readTools.length} baca, ${writeTools.length} tulis`, `${readTools.length} read, ${writeTools.length} write`) },
          { label: t("Had kadar", "Rate limit"), icon: Gauge, value: "120/min", note: t(`${deniedCalls} panggilan ditolak polisi`, `${deniedCalls} calls refused by policy`) },
          { label: t("Panggilan 24j", "Calls in 24h"), icon: Activity, value: totalCalls.toLocaleString("en-MY"), note: t("Merentas semua token", "Across all tokens") },
        ].map((m, i) => (
          <article key={i} className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-muted-foreground">{m.label}</span>
              <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
                <m.icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className={cn("font-display text-[24px] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]", m.tone === "ok" && server === "active" && "text-emerald-600")}>{m.value}</div>
            <span className="truncate text-[12px] text-muted-foreground">{m.note}</span>
          </article>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              tab === item.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t(item.label.ms, item.label.en)}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-bold [font-variant-numeric:tabular-nums]", tab === item.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tools tab */}
      {tab === "tools" && (
        <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold">{t("Alat terdedah", "Exposed tools")}</h2>
              <p className="text-[13px] text-muted-foreground">
                {t("Alat dilumpuhkan tidak diiklankan semasa rundingan keupayaan.", "Disabled tools are not advertised during capability negotiation.")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {activeTools} / {allTools.length} {t("didayakan", "enabled")}
              </span>
              <button onClick={() => setAllTools(!(activeTools === allTools.length))} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted/50">
                {activeTools === allTools.length ? t("Lumpuhkan semua", "Disable all") : t("Dayakan semua", "Enable all")}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-bold">{t("Alat", "Tool")}</th>
                  <th className="px-4 py-2.5 font-bold">{t("Skop", "Scope")}</th>
                  <th className="px-4 py-2.5 font-bold">{t("Panggilan", "Calls")}</th>
                  <th className="px-4 py-2.5 font-bold">{t("Didayakan", "Enabled")}</th>
                </tr>
              </thead>
              <tbody>
                {readTools.concat(writeTools).map((tool) => {
                  const isWrite = tool.id.startsWith("w");
                  return (
                    <tr key={tool.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="min-w-[240px] px-4 py-3">
                        <p className="font-mono text-[13px] font-semibold">{tool.name}</p>
                        <p className="mt-0.5 max-w-md text-xs text-muted-foreground">{t(tool.desc.ms, tool.desc.en)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(pillCls, isWrite ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                          {isWrite ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {isWrite ? t("Tulis", "Write") : t("Baca", "Read")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted-foreground [font-variant-numeric:tabular-nums]">
                        {tool.calls.toLocaleString("en-MY")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          role="switch"
                          aria-checked={tool.on}
                          aria-label={`${t("Dayakan alat", "Enable tool")} ${tool.name}`}
                          onClick={() => toggleTool(tool.id, isWrite ? "write" : "read")}
                          className={switchCls(tool.on)}
                        >
                          <span className={cn("pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform", tool.on ? "translate-x-4" : "translate-x-0")} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tokens tab */}
      {tab === "tokens" && (
        <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold">{t("Token API", "API tokens")}</h2>
              <p className="text-[13px] text-muted-foreground">
                {activeTokens} {t("aktif. Setiap token mewarisi peranan staf yang menciptanya.", "active. Each token inherits the role of the staff member who created it.")}
              </p>
            </div>
            <button
              onClick={() => {
                setFormError("");
                setCreatedSecret(null);
                setForm({ label: "", role: "Sales" });
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted/50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("Cipta token", "Create token")}
            </button>
          </div>
          <ul>
            {tokens.map((token) => (
              <li key={token.id} className="flex flex-wrap items-center gap-3 border-b px-5 py-4 last:border-0 hover:bg-muted/30">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-muted text-muted-foreground">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{token.label}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-muted-foreground">
                    <span>{t("Peranan", "Role")} {token.role}</span>
                    <span>· {t("Dicipta", "Created")} {token.created}</span>
                    <span>· {t("Terakhir digunakan", "Last used")} {token.last}</span>
                    <span>· {t("Tamat", "Expires")} {token.expires}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {token.state === "active" ? `${token.prefix}••••••••` : t("Dibatalkan — permintaan ditolak", "Revoked — requests rejected")}
                    </code>
                    {token.state === "active" && (
                      <button
                        aria-label={`${t("Salin prefix token", "Copy token prefix")} ${token.label}`}
                        onClick={() => copyText(token.prefix, t(`Prefix untuk ${token.label} disalin`, `Prefix for ${token.label} copied`))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {token.scopes.map((scope) => (
                      <span key={scope} className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{scope}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn(pillCls, token.state === "active" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}>
                    {token.state === "active" ? t("Aktif", "Active") : t("Dibatalkan", "Revoked")}
                  </span>
                  {token.state === "active" && (
                    <>
                      <button onClick={() => rotateToken(token)} className="rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted/50">{t("Rotate", "Rotate")}</button>
                      <button onClick={() => setRevokeTarget(token)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">{t("Batalkan", "Revoke")}</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Resources & prompts tab */}
      {tab === "resources" && (
        <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
          <div className="border-b px-5 py-4">
            <h2 className="font-display text-base font-bold">{t("Sumber", "Resources")}</h2>
            <p className="text-[13px] text-muted-foreground">{t("Konteks baca-sahaja diterbitkan kepada klien yang disambung.", "Read-only context published to connected clients.")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-bold">{t("Sumber", "Resource")}</th>
                  <th className="px-4 py-2.5 font-bold">URI</th>
                  <th className="px-4 py-2.5 font-bold">{t("Dikemas kini", "Updated")}</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCES.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="min-w-[220px] px-4 py-3">
                      <p className="text-[13px] font-semibold">{t(item.label.ms, item.label.en)}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t(item.desc.ms, item.desc.en)}</p>
                    </td>
                    <td className="px-4 py-3"><code className="font-mono text-xs">{item.uri}</code></td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted-foreground">{item.age}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-b px-5 py-4">
            <h2 className="font-display text-base font-bold">{t("Prom", "Prompts")}</h2>
            <p className="text-[13px] text-muted-foreground">{t("Arahan tersedia yang boleh dijalankan klien terhadap alat di atas.", "Prepared instructions clients can run against the tools above.")}</p>
          </div>
          <ul>
            {PROMPTS.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 border-b px-5 py-4 last:border-0 hover:bg-muted/30">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[13px] font-semibold">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(item.desc.ms, item.desc.en)}</p>
                </div>
                <button
                  onClick={() => copyText(item.label, t(`Prom ${item.label} disalin`, `Prompt ${item.label} copied`))}
                  className="rounded-md border px-2 py-1 text-xs font-semibold hover:bg-muted/50"
                >
                  {t("Salin prom", "Copy prompt")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Safety tab */}
      {tab === "safety" && (
        <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
          <div className="border-b px-5 py-4">
            <h2 className="font-display text-base font-bold">{t("Sempadan keselamatan", "Safety boundaries")}</h2>
            <p className="text-[13px] text-muted-foreground">
              {t("Token tidak boleh melebihi peranannya, dan tindakan pemusnahanan kekal di luar MCP.", "Tokens can never exceed their role, and destructive actions stay out of MCP entirely.")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3">
            {ROLE_MATRIX.map((row) => (
              <div key={row.role.en} className="flex flex-col gap-2 border-b border-r p-4">
                <h3 className="text-[13px] font-bold">{t(row.role.ms, row.role.en)}</h3>
                <p className="text-xs text-muted-foreground">{t("Baca", "Read")}: {t(row.read.ms, row.read.en)}</p>
                <p className="text-xs text-muted-foreground">{t("Tulis", "Write")}: {t(row.write.ms, row.write.en)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", row.deny ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                    {t(row.sensitive.ms, row.sensitive.en)}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2 p-4">
              <h3 className="text-[13px] font-bold">{t("Dikecualikan daripada MCP", "Excluded from MCP")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { ms: "Batalkan tempahan", en: "Cancel booking" },
                  { ms: "Batalkan invois", en: "Void invoice" },
                  { ms: "Proses bayaran balik", en: "Process refund" },
                  { ms: "Nombor pasport", en: "Passport number" },
                  { ms: "Fail bukti bayaran", en: "Payment proof file" },
                ].map((chip) => (
                  <span key={chip.en} className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t(chip.ms, chip.en)}</span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("Medan sensitif ditapis sebelum respons meninggalkan pelayan. Had kadar: 120 permintaan seminit setiap token.", "Sensitive fields are filtered before a response leaves the server. Rate limit: 120 requests per minute per token.")}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Logs tab */}
      {tab === "logs" && (
        <section className="space-y-4 rounded-[var(--radius-panel)] border bg-[var(--color-surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold">{t("Log audit MCP", "MCP audit log")}</h2>
              <p className="text-[13px] text-muted-foreground">{t("Setiap panggilan alat dengan klien, ringkasan argumen & status hasil.", "Every tool call with client, arguments summary and result status.")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ListFilter className="h-4 w-4 text-muted-foreground" />
              {(["all", "success", "denied", "error"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    filter === f ? "border-primary bg-primary text-white" : "hover:bg-muted/50",
                  )}
                >
                  {f === "all" ? t("Semua", "All") : outcomeBadge(f).label}
                </button>
              ))}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Cari token, alat, atau argumen…", "Search token, tool, or arguments…")}
                className="ml-auto h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t("Masa", "Time")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Alat MCP", "MCP Tool")}</th>
                  <th className="px-4 py-3 font-semibold">{t("Hasil", "Outcome")}</th>
                  <th className="px-4 py-3 text-right font-semibold">{t("Tempoh", "Duration")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                      <ScrollText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      {t("Tiada entri log sepadan.", "No matching log entries.")}
                    </td>
                  </tr>
                )}
                {entries.map((e) => {
                  const badge = outcomeBadge(e.outcome);
                  return (
                    <tr key={e.id} onClick={() => setSelected(e)} className="cursor-pointer border-b last:border-0 hover:bg-muted/30">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        <Clock className="mr-1 inline h-3.5 w-3.5" />
                        {e.timestamp}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{e.tool}</code>
                        <div className="mt-1 text-xs text-muted-foreground">{e.tokenName}</div>
                        <div className="mt-0.5 max-w-[280px] truncate font-mono text-[11px] text-muted-foreground">{e.argsSummary}</div>
                        {e.deniedReason && <div className="mt-0.5 text-[11px] font-medium text-amber-700">{e.deniedReason}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", badge.cls)}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{e.durationMs} ms</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Create token dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => !open && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createdSecret ? t("Token dicipta", "Token created") : t("Cipta token API", "Create API token")}</DialogTitle>
            <DialogDescription>
              {createdSecret
                ? t("Salin rahsia ini sekarang. Ia dipaparkan sekali sahaja.", "Copy this secret now. It is shown only once.")
                : t("Token mewarisi peranan dipilih dan skopnya.", "The token inherits the selected role and its scopes.")}
            </DialogDescription>
          </DialogHeader>
          {createdSecret ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted px-3 py-2.5">
                <code className="min-w-0 flex-1 break-all font-mono text-xs">{createdSecret.secret}</code>
                <button
                  onClick={() => copyText(createdSecret.secret, t("Rahsia disalin ke papan keratan", "Secret copied to clipboard"))}
                  className="inline-flex flex-none items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t("Salin", "Copy")}
                </button>
              </div>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none text-amber-500" />
                {t("Selepas dialog ini ditutup, rahsia penuh tidak boleh dipaparkan lagi. Rotate token jika hilang.", "After this dialog closes the full secret cannot be displayed again. Rotate the token if it is lost.")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-muted-foreground" htmlFor="mx-label">{t("Nama token", "Token name")}</label>
                <input
                  id="mx-label"
                  value={form.label}
                  onChange={(e) => { setForm((c) => ({ ...c, label: e.target.value })); setFormError(""); }}
                  aria-invalid={!!formError}
                  placeholder="e.g. Claude Desktop — Sales"
                  className={cn("h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring", formError && "border-red-400")}
                />
                {formError && <p className="text-xs font-medium text-red-600">{formError}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-muted-foreground" htmlFor="mx-role">{t("Peranan diwarisi", "Inherited role")}</label>
                <select
                  id="mx-role"
                  value={form.role}
                  onChange={(e) => setForm((c) => ({ ...c, role: e.target.value as TokenRole }))}
                  className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm"
                >
                  {(Object.keys(ROLE_SCOPES) as TokenRole[]).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_SCOPES[form.role].map((scope) => (
                  <span key={scope} className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{scope}</span>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            {createdSecret ? (
              <button onClick={() => setCreateOpen(false)} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                {t("Selesai", "Done")}
              </button>
            ) : (
              <>
                <button onClick={() => setCreateOpen(false)} className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                  {t("Batal", "Cancel")}
                </button>
                <button onClick={submitToken} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                  {t("Cipta token", "Create token")}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Batalkan token?", "Revoke token?")}</DialogTitle>
            <DialogDescription>
              {revokeTarget &&
                t(
                  `Permintaan menggunakan ${revokeTarget.label} akan ditolak serta-merta. Tindakan ini tidak boleh diundur.`,
                  `Requests using ${revokeTarget.label} will be rejected immediately. This cannot be undone.`,
                )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setRevokeTarget(null)} className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
              {t("Kekalkan token", "Keep token")}
            </button>
            <button onClick={confirmRevoke} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
              {t("Batalkan token", "Revoke token")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog (audit) */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Butiran Panggilan MCP", "MCP Call Detail")}</DialogTitle>
            <DialogDescription>
              {t("Rekod penuh panggilan alat MCP ini daripada audit log.", "Full record of this MCP tool call from the audit log.")}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("Masa", "Time")}</div>
                  <div className="font-medium">{selected.timestamp}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("Tempoh", "Duration")}</div>
                  <div className="font-mono">{selected.durationMs} ms</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("Alat", "Tool")}</div>
                  <div className="font-mono font-medium">{selected.tool}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("Hasil", "Outcome")}</div>
                  <div className="font-medium">{outcomeBadge(selected.outcome).label}</div>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("Argumen", "Arguments")}</div>
                <code className="mt-1 block break-all rounded bg-muted px-2 py-1.5 font-mono text-xs">{selected.argsSummary}</code>
              </div>
              {selected.deniedReason && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("Sebab penolakan", "Denial reason")}</div>
                  <div className="font-medium text-amber-700">{selected.deniedReason}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {notice && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[80] flex max-w-[340px] items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-text)] px-4 py-3 text-[13px] text-[var(--color-surface)] shadow-2xl">
          <CheckCircle2 className="h-4 w-4 flex-none text-emerald-300" />
          <span className="min-w-0 flex-1">{notice}</span>
          <button aria-label={t("Tutup notifikasi", "Dismiss notification")} onClick={() => { window.clearTimeout(noticeTimer.current); setNotice(""); }} className="grid h-6 w-6 flex-none place-items-center">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

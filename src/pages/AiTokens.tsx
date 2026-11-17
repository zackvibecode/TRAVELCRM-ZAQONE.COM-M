import { useRef, useState } from "react";
import { Bot, Copy, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

type TokenStatus = "active" | "revoked" | "expired";
type TokenRole = "super_admin" | "management" | "sales" | "finance" | "operations";

interface ApiToken {
  id: string;
  name: string;
  tokenPreview: string;
  role: TokenRole;
  scopes: string[];
  status: TokenStatus;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string;
  callsLast30d: number;
}

const ROLE_LABELS: Record<TokenRole, { ms: string; en: string }> = {
  super_admin: { ms: "Super Admin", en: "Super Admin" },
  management: { ms: "Pengurusan", en: "Management" },
  sales: { ms: "Jualan", en: "Sales" },
  finance: { ms: "Kewangan", en: "Finance" },
  operations: { ms: "Operasi", en: "Operations" },
};

// (scope picker dipakai dialog jana token)
export const MCP_SCOPES = [
  "leads:read",
  "leads:write",
  "bookings:read",
  "bookings:write",
  "packages:read",
  "departures:read",
  "seats:read",
  "invoices:read",
  "customers:read",
];

// Stub data — backend MCP token API menyusul pada task backend.
const STUB_TOKENS: ApiToken[] = [
  {
    id: "tok_01",
    name: "Claude Desktop — Owner",
    tokenPreview: "zqk_live_7f3a…9d21",
    role: "super_admin",
    scopes: ["leads:read", "bookings:read", "packages:read", "departures:read", "seats:read", "invoices:read", "customers:read"],
    status: "active",
    createdAt: "2026-11-02",
    lastUsed: "2026-11-16 09:12",
    expiresAt: "2027-05-02",
    callsLast30d: 482,
  },
  {
    id: "tok_02",
    name: "Sales Bot — WhatsApp Assistant",
    tokenPreview: "zqk_live_b8e2…41cc",
    role: "sales",
    scopes: ["leads:read", "leads:write", "bookings:read"],
    status: "active",
    createdAt: "2026-10-18",
    lastUsed: "2026-11-15 17:40",
    expiresAt: "2027-04-18",
    callsLast30d: 1290,
  },
  {
    id: "tok_03",
    name: "Finance Report Sync",
    tokenPreview: "zqk_live_c91d…77ab",
    role: "finance",
    scopes: ["invoices:read"],
    status: "expired",
    createdAt: "2026-09-01",
    lastUsed: "2026-10-30 12:05",
    expiresAt: "2026-10-31",
    callsLast30d: 0,
  },
  {
    id: "tok_04",
    name: "Old IDE Agent",
    tokenPreview: "zqk_live_44f0…e102",
    role: "management",
    scopes: ["leads:read", "bookings:read", "packages:read"],
    status: "revoked",
    createdAt: "2026-08-12",
    lastUsed: "2026-09-20 08:22",
    expiresAt: "2027-02-12",
    callsLast30d: 0,
  },
];

const STATUS_PILL: Record<TokenStatus, string> = {
  active: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  expired: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  revoked: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

const STATUS_LABEL: Record<TokenStatus, { ms: string; en: string }> = {
  active: { ms: "Aktif", en: "Active" },
  expired: { ms: "Tamat Tempoh", en: "Expired" },
  revoked: { ms: "Dibatalkan", en: "Revoked" },
};

const PANEL = "rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]";
const BTN =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-55 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)]`;
const BTN_GHOST = `${BTN} border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]`;

export default function AiTokens() {
  const { t } = useLang();
  const [tokens, setTokens] = useState<ApiToken[]>(STUB_TOKENS);

  // Create-token dialog state (mock submit — backend MCP token API menyusul)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<TokenRole>("sales");
  const [newScopes, setNewScopes] = useState<string[]>(["leads:read"]);
  const [newExpiry, setNewExpiry] = useState("2027-11-17");
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);

  // Revoke flow state
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);
  const [revoking, setRevoking] = useState(false);
  const revokeDialogRef = useRef<HTMLDialogElement>(null);

  const toggleScope = (scope: string) =>
    setNewScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );

  const handleGenerate = () => {
    setSubmitting(true);
    // Mock: simulasikan permintaan API sebelum backend token wujud
    window.setTimeout(() => {
      const raw = "zqk_live_" + Array.from({ length: 32 }, () =>
        "0123456789abcdef"[Math.floor(Math.random() * 16)],
      ).join("");
      setTokens((prev) => [
        {
          id: `tok_${Date.now()}`,
          name: newName.trim() || t("Token Baru", "New Token"),
          tokenPreview: `${raw.slice(0, 13)}…${raw.slice(-4)}`,
          role: newRole,
          scopes: newScopes.length ? newScopes : ["leads:read"],
          status: "active",
          createdAt: new Date().toISOString().slice(0, 10),
          lastUsed: null,
          expiresAt: newExpiry,
          callsLast30d: 0,
        },
        ...prev,
      ]);
      setGenerated(raw);
      setSubmitting(false);
    }, 600);
  };

  const openDialog = () => {
    setGenerated(null);
    setNewName("");
    setNewRole("sales");
    setNewScopes(["leads:read"]);
    setNewExpiry("2027-11-17");
    setDialogOpen(true);
    createDialogRef.current?.showModal();
  };

  const closeDialog = () => {
    createDialogRef.current?.close();
    setDialogOpen(false);
  };

  const openRevoke = (tk: ApiToken) => {
    setRevokeTarget(tk);
    revokeDialogRef.current?.showModal();
  };

  const closeRevoke = () => {
    revokeDialogRef.current?.close();
    setRevokeTarget(null);
  };

  const handleRevoke = () => {
    if (!revokeTarget) return;
    setRevoking(true);
    // Mock: simulasikan permintaan API sebelum backend token wujud
    window.setTimeout(() => {
      setTokens((prev) =>
        prev.map((tk) =>
          tk.id === revokeTarget.id ? { ...tk, status: "revoked" as TokenStatus } : tk,
        ),
      );
      setRevoking(false);
      closeRevoke();
    }, 500);
  };

  const activeCount = tokens.filter((tk) => tk.status === "active").length;
  const totalCalls = tokens.reduce((sum, tk) => sum + tk.callsLast30d, 0);

  const statCard =
    "rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
  const metricLabel =
    "flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]";
  const metricValue = "mt-2 font-display text-2xl font-bold tabular-nums";

  return (
    <div className="space-y-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Token Akses AI", "AI Access Tokens")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Urus token API untuk klien AI (MCP) yang mengakses data CRM — setiap token mewarisi peranan staf dan direkodkan dalam audit log.",
              "Manage API tokens for AI clients (MCP) that access CRM data — each token inherits a staff role and every call is audit-logged.",
            )}
          </p>
        </div>
        <button onClick={openDialog} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" />
          {t("Jana Token Baru", "Generate New Token")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={statCard}>
          <div className={metricLabel}>
            <KeyRound className="h-4 w-4" />
            {t("Token Aktif", "Active Tokens")}
          </div>
          <div className={metricValue}>{activeCount}</div>
        </div>
        <div className={statCard}>
          <div className={metricLabel}>
            <Bot className="h-4 w-4" />
            {t("Panggilan MCP (30 hari)", "MCP Calls (30 days)")}
          </div>
          <div className={metricValue}>{totalCalls.toLocaleString()}</div>
        </div>
        <div className={statCard}>
          <div className={metricLabel}>
            <ShieldAlert className="h-4 w-4" />
            {t("Peringkat Keselamatan", "Safety Boundary")}
          </div>
          <div className="mt-2 text-[13px] font-medium leading-snug text-[var(--color-text-secondary)]">
            {t(
              "Pasport & bukti bayaran dilindungi; tindakan destruktif diluar MCP.",
              "Passports & payment proofs protected; destructive actions excluded from MCP.",
            )}
          </div>
        </div>
      </div>

      {/* MCP endpoint connection info */}
      <div className={PANEL}>
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-[14.5px] font-semibold text-[var(--color-text)]">
            {t("Sambungan MCP", "MCP Connection")}
          </h2>
          <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
            {t(
              "Tambah endpoint ini dalam klien MCP anda (Claude Desktop, IDE, automasi) dan hantar token akses sebagai Bearer.",
              "Add this endpoint to your MCP client (Claude Desktop, IDE, automations) and send the access token as a Bearer.",
            )}
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                {t("Endpoint (URL)", "Endpoint (URL)")}
              </div>
              <code className="mt-1.5 block break-all rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
                https://zaqone-travel.example.workers.dev/mcp
              </code>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                {t("Pengepala Pengesahan", "Auth Header")}
              </div>
              <code className="mt-1.5 block break-all rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
                Authorization: Bearer zqk_live_…
              </code>
            </div>
          </div>
          <div className="grid gap-2 text-xs text-[var(--color-text-muted)] sm:grid-cols-3">
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2">
              <div className="font-semibold text-[var(--color-text)]">{t("Protokol", "Protocol")}</div>
              MCP Streamable HTTP
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2">
              <div className="font-semibold text-[var(--color-text)]">{t("Pengesahan", "Auth")}</div>
              Bearer token (peranan-scoped)
            </div>
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] px-3 py-2">
              <div className="font-semibold text-[var(--color-text)]">{t("Status", "Status")}</div>
              {t("Aktif selepas backend MCP siap", "Live once MCP backend ships")}
            </div>
          </div>
        </div>
      </div>

      {/* Token table */}
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[var(--color-surface-raised)] text-left">
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Token", "Token")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Peranan", "Role")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Skop", "Scopes")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Status", "Status")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Terakhir Guna", "Last Used")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Tindakan", "Actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((tk) => (
                <tr key={tk.id} className="transition-colors hover:bg-[var(--color-surface-raised)]">
                  <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        aria-hidden="true"
                      >
                        <KeyRound className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--color-text)]">{tk.name}</div>
                        <code className="font-mono text-[11.5px] text-[var(--color-text-muted)]">
                          {tk.tokenPreview}
                        </code>
                      </div>
                      <button
                        onClick={() => navigator.clipboard?.writeText(tk.tokenPreview)}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        aria-label={t("Salin", "Copy")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 font-mono text-[11px] tabular-nums text-[var(--color-text-muted)]">
                      {t("Dijana", "Created")} {tk.createdAt} · {t("Tamat", "Expires")} {tk.expiresAt}
                    </div>
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                    <span className="inline-flex rounded-full bg-[var(--color-neutral-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                      {t(ROLE_LABELS[tk.role].ms, ROLE_LABELS[tk.role].en)}
                    </span>
                  </td>
                  <td className="max-w-[220px] border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                    <div className="flex flex-wrap gap-1">
                      {tk.scopes.slice(0, 3).map((s) => (
                        <code
                          key={s}
                          className="rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-secondary)]"
                        >
                          {s}
                        </code>
                      ))}
                      {tk.scopes.length > 3 && (
                        <span className="text-[11px] text-[var(--color-text-muted)]">
                          +{tk.scopes.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_PILL[tk.status]}`}>
                      {t(STATUS_LABEL[tk.status].ms, STATUS_LABEL[tk.status].en)}
                    </span>
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-secondary)] last:border-b-0">
                    {tk.lastUsed ?? t("Belum pernah", "Never")}
                    <div className="mt-0.5 tabular-nums">
                      {tk.callsLast30d.toLocaleString()} {t("panggilan", "calls")}
                    </div>
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 text-right last:border-b-0">
                    <button
                      onClick={() => openRevoke(tk)}
                      disabled={tk.status === "revoked"}
                      title={
                        tk.status === "revoked"
                          ? t("Token dibatalkan", "Token revoked")
                          : t("Batalkan token", "Revoke token")
                      }
                      className="inline-flex rounded-[var(--radius-control)] border border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-border))] p-2 text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety note */}
      <div className="flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] p-4 text-[13px] leading-relaxed text-[var(--color-warning)]">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" />
        <p>
          {t(
            "Token mewarisi peranan staf yang menjana ia. MCP tidak boleh membaca nombor pasport, imbasan pasport, atau bukti bayaran kecuali peranan benarkan. Tindakan destruktif (batalkan tempahan, batalkan invois, refund) tiada dalam MCP.",
            "Tokens inherit the role of the staff member who created them. MCP can never read passport numbers, passport scans, or payment proofs unless the role allows it. Destructive actions (cancel booking, void invoice, refund) are excluded from MCP.",
          )}
        </p>
      </div>

      {/* Create-token dialog */}
      <dialog
        ref={createDialogRef}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCancel={() => setDialogOpen(false)}
        className="m-auto w-[min(520px,calc(100vw-32px))] rounded-[var(--radius-panel)] border-0 bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
        aria-labelledby="aitok-dialog-title"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 id="aitok-dialog-title" className="font-display text-[16px] font-bold">
              {generated
                ? t("Token Dijana", "Token Generated")
                : t("Jana Token Baru", "Generate New Token")}
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
              {generated
                ? t("Salin token ini sekarang — ia tidak akan ditunjukkan lagi.", "Copy this token now — it will not be shown again.")
                : t(
                    "Token mewarisi peranan staf; setiap panggilan MCP direkodkan dalam audit log.",
                    "Tokens inherit a staff role; every MCP call is audit-logged.",
                  )}
            </p>
          </div>

          {generated ? (
            <div className="space-y-3">
              <code className="block break-all rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-xs text-[var(--color-text-secondary)]">
                {generated}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(generated)}
                className={`${BTN} border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]`}
              >
                <Copy className="h-3.5 w-3.5" />
                {t("Salin Token", "Copy Token")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                  {t("Nama Token", "Token Name")}
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("cth. Claude Desktop — Owner", "e.g. Claude Desktop — Owner")}
                  className="w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                  {t("Peranan (token mewarisi kebenaran peranan ini)", "Role (token inherits this role's permissions)")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ROLE_LABELS) as TokenRole[]).map((role) => {
                    const on = newRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setNewRole(role)}
                        className={`inline-flex rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                          on
                            ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                            : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
                        }`}
                      >
                        {t(ROLE_LABELS[role].ms, ROLE_LABELS[role].en)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                  {t("Skop Akses", "Access Scopes")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {MCP_SCOPES.map((scope) => {
                    const on = newScopes.includes(scope);
                    return (
                      <button
                        key={scope}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleScope(scope)}
                        className={`inline-flex rounded-[var(--radius-control)] border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                          on
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
                        }`}
                      >
                        {scope}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                  {t("Tamat Tempoh", "Expiry Date")}
                </label>
                <input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-4">
          {generated ? (
            <button onClick={closeDialog} className={BTN_PRIMARY}>
              {t("Selesai", "Done")}
            </button>
          ) : (
            <>
              <button onClick={closeDialog} className={BTN_GHOST}>
                {t("Batal", "Cancel")}
              </button>
              <button onClick={handleGenerate} disabled={submitting} className={BTN_PRIMARY}>
                {submitting ? t("Menjana…", "Generating…") : t("Jana Token", "Generate Token")}
              </button>
            </>
          )}
        </div>
      </dialog>

      {/* Revoke confirmation dialog */}
      <dialog
        ref={revokeDialogRef}
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onCancel={() => setRevokeTarget(null)}
        className="m-auto w-[min(440px,calc(100vw-32px))] rounded-[var(--radius-panel)] border-0 bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
        aria-labelledby="aitok-revoke-title"
      >
        <div className="space-y-4 p-5">
          <h2 id="aitok-revoke-title" className="font-display text-[16px] font-bold">
            {t("Batalkan Token?", "Revoke Token?")}
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            {t(
              "Klien AI yang guna token ini akan terus ditolak. Tindakan ini direkodkan dalam audit log dan tidak boleh diundur.",
              "AI clients using this token will be rejected immediately. This action is audit-logged and cannot be undone.",
            )}
          </p>
          {revokeTarget && (
            <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[13px]">
              <div className="font-semibold text-[var(--color-text)]">{revokeTarget.name}</div>
              <code className="mt-1 block font-mono text-xs text-[var(--color-text-muted)]">
                {revokeTarget.tokenPreview}
              </code>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-4">
          <button onClick={closeRevoke} className={BTN_GHOST}>
            {t("Batal", "Cancel")}
          </button>
          <button
            onClick={handleRevoke}
            disabled={revoking}
            className={`${BTN} border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:opacity-90`}
          >
            {revoking ? t("Membatalkan…", "Revoking…") : t("Ya, Batalkan Token", "Yes, Revoke Token")}
          </button>
        </div>
      </dialog>
    </div>
  );
}

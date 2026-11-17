import { useRef, useState } from "react";
import { BadgeCheck, Copy, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

type TokenStatus = "active" | "revoked" | "expired";

interface ApiToken {
  id: string;
  name: string;
  preview: string;
  createdBy: string;
  scopes: string[];
  status: TokenStatus;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string;
}

const SCOPES = ["bookings:read", "bookings:write", "customers:read", "invoices:read", "webhooks:write"];

// Mock data — backend API token service menyusul pada fasa backend.
const STUB: ApiToken[] = [
  { id: "apit_01", name: "Website Booking Widget", preview: "zqk_api_7f3a…9d21", createdBy: "Zack (Owner)", scopes: ["bookings:read", "bookings:write"], status: "active", createdAt: "2026-11-02", lastUsed: "2026-11-17 14:22", expiresAt: "2027-11-02" },
  { id: "apit_02", name: "Accounting Sync (Xero)", preview: "zqk_api_b8e2…41cc", createdBy: "Melati (Finance)", scopes: ["invoices:read"], status: "active", createdAt: "2026-10-15", lastUsed: "2026-11-16 08:30", expiresAt: "2027-10-15" },
  { id: "apit_03", name: "Legacy Mobile App", preview: "zqk_api_44f0…e102", createdBy: "Farah (Management)", scopes: ["customers:read", "bookings:read"], status: "revoked", createdAt: "2026-06-12", lastUsed: "2026-08-20 08:22", expiresAt: "2027-06-12" },
];

const STATUS_PILL: Record<TokenStatus, string> = {
  active: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
  revoked: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  expired: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
};

const STATUS_LABEL: Record<TokenStatus, { ms: string; en: string }> = {
  active: { ms: "Aktif", en: "Active" },
  revoked: { ms: "Dibatalkan", en: "Revoked" },
  expired: { ms: "Tamat Tempoh", en: "Expired" },
};

const BTN =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-55 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)]`;
const BTN_SECONDARY = `${BTN} border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]`;
const BTN_DANGER = `${BTN} border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]`;
const BTN_GHOST = `${BTN} border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]`;

export default function ApiTokenPanel() {
  const { t } = useLang();
  const [tokens, setTokens] = useState<ApiToken[]>(STUB);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>(["bookings:read"]);
  const [generated, setGenerated] = useState<string | null>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);
  const revokeDialogRef = useRef<HTMLDialogElement>(null);

  const toggleScope = (s: string) =>
    setNewScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleGenerate = () => {
    const raw = "zqk_api_" + Array.from({ length: 32 }, () =>
      "0123456789abcdef"[Math.floor(Math.random() * 16)],
    ).join("");
    setTokens((prev) => [
      {
        id: `apit_${Date.now()}`,
        name: newName.trim() || t("Token Baru", "New Token"),
        preview: `${raw.slice(0, 12)}…${raw.slice(-4)}`,
        createdBy: "Zack (Owner)",
        scopes: newScopes.length ? newScopes : ["bookings:read"],
        status: "active",
        createdAt: new Date().toISOString().slice(0, 10),
        lastUsed: null,
        expiresAt: "2027-11-17",
      },
      ...prev,
    ]);
    setGenerated(raw);
  };

  const openDialog = () => {
    setGenerated(null);
    setNewName("");
    setNewScopes(["bookings:read"]);
    setDialogOpen(true);
    createDialogRef.current?.showModal();
  };

  const closeDialog = () => {
    createDialogRef.current?.close();
    setDialogOpen(false);
    setGenerated(null);
    setNewName("");
    setNewScopes(["bookings:read"]);
  };

  const openRevoke = (tk: ApiToken) => {
    setRevokeTarget(tk);
    revokeDialogRef.current?.showModal();
  };

  const closeRevoke = () => {
    revokeDialogRef.current?.close();
    setRevokeTarget(null);
  };

  const handleCopy = (id: string) => {
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRevoke = () => {
    if (!revokeTarget) return;
    setTokens((prev) =>
      prev.map((tk) => (tk.id === revokeTarget.id ? { ...tk, status: "revoked" as TokenStatus } : tk)),
    );
    closeRevoke();
  };

  const activeCount = tokens.filter((x) => x.status === "active").length;
  const revokedCount = tokens.filter((x) => x.status === "revoked").length;

  const statCard =
    "rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3";
  const metricValue = "mt-1 font-display text-xl font-bold tabular-nums";

  return (
    <div className="space-y-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Token API", "API Tokens")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Urus token untuk integrasi luaran dan webhook.",
              "Manage tokens for external integrations and webhooks.",
            )}
          </p>
        </div>
        <button onClick={openDialog} className={BTN_PRIMARY}>
          <Plus className="h-4 w-4" />
          {t("Bina Token", "Create Token")}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={statCard}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Jumlah Token", "Total Tokens")}</p>
          <p className={metricValue}>{tokens.length}</p>
        </div>
        <div className={statCard}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Aktif", "Active")}</p>
          <p className={`${metricValue} text-[var(--color-success)]`}>{activeCount}</p>
        </div>
        <div className={statCard}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Dibatalkan", "Revoked")}</p>
          <p className={`${metricValue} text-[var(--color-danger)]`}>{revokedCount}</p>
        </div>
      </div>

      {/* Token table */}
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[var(--color-surface-raised)] text-left">
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Nama & Prefix", "Name & Prefix")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Skop", "Scopes")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Terakhir Guna", "Last Used")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Luput", "Expires")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Status", "Status")}
                </th>
                <th className="border-b border-[var(--color-border)] px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                  {t("Aksi", "Actions")}
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
                          {tk.preview}
                        </code>
                      </div>
                      <button
                        onClick={() => handleCopy(tk.id)}
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                        aria-label={t("Salin", "Copy")}
                      >
                        {copiedId === tk.id ? (
                          <BadgeCheck className="h-3.5 w-3.5 text-[var(--color-success)]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                    <div className="flex flex-wrap gap-1">
                      {tk.scopes.map((s) => (
                        <code
                          key={s}
                          className="rounded-[5px] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-secondary)]"
                        >
                          {s}
                        </code>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--color-border)] px-4 py-3 text-[var(--color-text-secondary)] last:border-b-0">
                    {tk.lastUsed ?? t("Belum pernah", "Never")}
                  </td>
                  <td className="whitespace-nowrap border-b border-[var(--color-border)] px-4 py-3 font-mono text-xs tabular-nums text-[var(--color-text-secondary)] last:border-b-0">
                    {tk.expiresAt}
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS_PILL[tk.status]}`}
                    >
                      {t(STATUS_LABEL[tk.status].ms, STATUS_LABEL[tk.status].en)}
                    </span>
                  </td>
                  <td className="border-b border-[var(--color-border)] px-4 py-3 text-right last:border-b-0">
                    {tk.status !== "revoked" && (
                      <button onClick={() => openRevoke(tk)} className={`${BTN_DANGER} px-2.5 py-1.5 text-xs`}>
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("Batalkan", "Revoke")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "Data olok-olok — token API sebenar akan didayakan pada fasa backend.",
          "Mock data — real API tokens will be enabled in the backend phase.",
        )}
      </p>

      {/* Create dialog */}
      <dialog
        ref={createDialogRef}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCancel={() => setDialogOpen(false)}
        className="m-auto w-[min(460px,calc(100vw-32px))] rounded-[var(--radius-panel)] border-0 bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
        aria-labelledby="apit-dialog-title"
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="apit-dialog-title" className="font-display text-[16px] font-bold">
                {generated ? t("Token Dijana", "Token Generated") : t("Bina Token API", "Create API Token")}
              </h2>
              <p className="mt-1 text-[12.5px] text-[var(--color-text-muted)]">
                {generated
                  ? t("Token hanya dipaparkan sekali. Simpan dengan selamat.", "The token is shown once. Store it securely.")
                  : t("Pilih nama dan skop untuk token baharu.", "Pick a name and scopes for the new token.")}
              </p>
            </div>
            <button onClick={closeDialog} className={`${BTN_GHOST} px-2 py-1.5`} aria-label={t("Tutup", "Close")}>
              ✕
            </button>
          </div>

          {generated ? (
            <div className="space-y-3">
              <div className="rounded-[var(--radius-card)] border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("Token berjaya dijana", "Token generated successfully")}
                </p>
                <code className="block break-all font-mono text-xs text-[var(--color-text)]">{generated}</code>
              </div>
              <button onClick={() => navigator.clipboard?.writeText(generated)} className={BTN_SECONDARY}>
                <Copy className="h-3.5 w-3.5" />
                {t("Salin Token", "Copy Token")}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                  {t("Nama Token", "Token Name")}
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Website Booking Widget"
                  className="w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                  {t("Skop", "Scopes")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SCOPES.map((s) => {
                    const on = newScopes.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleScope(s)}
                        className={`inline-flex rounded-[var(--radius-control)] border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                          on
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
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
              <button onClick={handleGenerate} disabled={!newName.trim()} className={BTN_PRIMARY}>
                <KeyRound className="h-4 w-4" />
                {t("Jana Token", "Generate Token")}
              </button>
            </>
          )}
        </div>
      </dialog>

      {/* Revoke dialog */}
      <dialog
        ref={revokeDialogRef}
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onCancel={() => setRevokeTarget(null)}
        className="m-auto w-[min(400px,calc(100vw-32px))] rounded-[var(--radius-panel)] border-0 bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
        aria-labelledby="apit-revoke-title"
      >
        <div className="space-y-4 p-5">
          <h2 id="apit-revoke-title" className="font-display text-[16px] font-bold">
            {t("Batalkan Token?", "Revoke Token?")}
          </h2>
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            {revokeTarget?.name} — {t("integrasi akan berhenti berfungsi.", "integrations will stop working.")}
          </p>
          <div className="flex items-center gap-1.5 rounded-[var(--radius-card)] border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-2.5 text-xs font-semibold text-[var(--color-danger)]">
            <ShieldAlert className="h-3.5 w-3.5 flex-none" />
            {t("Tindakan ini tidak boleh ditarik balik.", "This action cannot be undone.")}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-4">
          <button onClick={closeRevoke} className={BTN_GHOST}>
            {t("Batal", "Cancel")}
          </button>
          <button onClick={handleRevoke} className={`${BTN} border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:opacity-90`}>
            <Trash2 className="h-4 w-4" />
            {t("Batalkan Token", "Revoke Token")}
          </button>
        </div>
      </dialog>
    </div>
  );
}

import { useState } from "react";
import {
  BadgeCheck,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  ShieldAlert,
  Trash2,
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

const STATUS_CLASS: Record<TokenStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  revoked: "bg-red-50 text-red-700 border-red-200",
  expired: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function ApiTokenPanel() {
  const { t } = useLang();
  const [tokens, setTokens] = useState<ApiToken[]>(STUB);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScopes, setNewScopes] = useState<string[]>(["bookings:read"]);
  const [generated, setGenerated] = useState<string | null>(null);

  // Revoke dialog
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);

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

  const resetDialog = () => {
    setDialogOpen(false);
    setGenerated(null);
    setNewName("");
    setNewScopes(["bookings:read"]);
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
    setRevokeTarget(null);
  };

  const fieldCls =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Token API", "API Tokens")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Urus token untuk integrasi luaran dan webhook.",
              "Manage tokens for external integrations and webhooks.",
            )}
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("Bina Token", "Create Token")}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Jumlah Token", "Total Tokens")}</p>
          <p className="mt-1 font-display text-xl font-bold">{tokens.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Aktif", "Active")}</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-600">
            {tokens.filter((x) => x.status === "active").length}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Dibatalkan", "Revoked")}</p>
          <p className="mt-1 font-display text-xl font-bold text-red-600">
            {tokens.filter((x) => x.status === "revoked").length}
          </p>
        </div>
      </div>

      {/* Token list */}
      <div className="space-y-3">
        {tokens.map((tk) => (
          <div key={tk.id} className="rounded-lg border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{tk.name}</span>
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS_CLASS[tk.status])}>
                      {tk.status}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-muted/60 px-2 py-0.5 font-mono text-xs">
                      {revealed[tk.id] ? `${tk.preview.split("…")[0]}…${tk.preview.split("…")[1]}` : tk.preview}
                    </code>
                    <button
                      onClick={() => setRevealed((p) => ({ ...p, [tk.id]: !p[tk.id] }))}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={t("Tunjuk/sembunyi token", "Show/hide token")}
                    >
                      {revealed[tk.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleCopy(tk.id)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={t("Salin", "Copy")}
                    >
                      {copiedId === tk.id ? <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Oleh", "By")} {tk.createdBy} · {t("Dicipta", "Created")} {tk.createdAt} ·{" "}
                    {t("Luput", "Expires")} {tk.expiresAt}
                  </p>
                </div>
              </div>
              {tk.status !== "revoked" && (
                <button
                  onClick={() => setRevokeTarget(tk)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("Batalkan", "Revoke")}
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
              {tk.scopes.map((s) => (
                <span key={s} className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-mono">
                  {s}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && resetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Bina Token API", "Create API Token")}</DialogTitle>
            <DialogDescription>
              {t(
                "Token hanya dipaparkan sekali. Simpan dengan selamat.",
                "The token is shown once. Store it securely.",
              )}
            </DialogDescription>
          </DialogHeader>
          {generated ? (
            <div className="space-y-3">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("Token berjaya dijana", "Token generated successfully")}
                </p>
                <code className="block break-all font-mono text-xs">{generated}</code>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("Klik Salin, kemudian tutup dialog ini.", "Copy it, then close this dialog.")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("Nama Token", "Token Name")}</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Website Booking Widget"
                  className={fieldCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("Skop", "Scopes")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {SCOPES.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleScope(s)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                        newScopes.includes(s)
                          ? "border-primary/50 bg-primary/5 text-primary"
                          : "text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={resetDialog}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("Tutup", "Close")}
            </button>
            {!generated && (
              <button
                onClick={handleGenerate}
                disabled={!newName.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {t("Jana Token", "Generate Token")}
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke dialog */}
      <Dialog open={revokeTarget !== null} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Batalkan Token?", "Revoke Token?")}</DialogTitle>
            <DialogDescription>
              {revokeTarget?.name} — {t("integrasi akan berhenti berfungsi.", "integrations will stop working.")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            <ShieldAlert className="h-3.5 w-3.5" />
            {t("Tindakan ini tidak boleh ditarik balik.", "This action cannot be undone.")}
          </div>
          <DialogFooter>
            <button
              onClick={() => setRevokeTarget(null)}
              className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("Batal", "Cancel")}
            </button>
            <button
              onClick={handleRevoke}
              className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              {t("Batalkan Token", "Revoke Token")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        {t(
          "Data olok-olok — token API sebenar akan didayakan pada fasa backend.",
          "Mock data — real API tokens will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

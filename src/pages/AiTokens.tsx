import { useState } from "react";
import {
  BadgeCheck,
  Bot,
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
import { Input } from "@/components/ui/input";

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

// (scope picker akan dipakai task "generate token modal" nanti)
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

function statusBadgeClass(status: TokenStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "expired":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "revoked":
      return "bg-red-50 text-red-700 border-red-200";
  }
}

export default function AiTokens() {
  const { t } = useLang();
  const [tokens, setTokens] = useState<ApiToken[]>(STUB_TOKENS);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  // Create-token dialog state (mock submit — backend MCP token API menyusul)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<TokenRole>("sales");
  const [newScopes, setNewScopes] = useState<string[]>(["leads:read"]);
  const [newExpiry, setNewExpiry] = useState("2027-11-17");
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

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

  const resetDialog = () => {
    setDialogOpen(false);
    setGenerated(null);
    setNewName("");
    setNewRole("sales");
    setNewScopes(["leads:read"]);
    setNewExpiry("2027-11-17");
  };

  // Revoke flow state
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);
  const [revoking, setRevoking] = useState(false);

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
      setRevokeTarget(null);
    }, 500);
  };

  const activeCount = tokens.filter((tk) => tk.status === "active").length;
  const totalCalls = tokens.reduce((sum, tk) => sum + tk.callsLast30d, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Token Akses AI", "AI Access Tokens")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Urus token API untuk klien AI (MCP) yang mengakses data CRM — setiap token mewarisi peranan staf dan direkodkan dalam audit log.",
              "Manage API tokens for AI clients (MCP) that access CRM data — each token inherits a staff role and every call is audit-logged.",
            )}
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {t("Jana Token Baru", "Generate New Token")}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <KeyRound className="h-4 w-4" />
            {t("Token Aktif", "Active Tokens")}
          </div>
          <div className="mt-2 text-2xl font-bold">{activeCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Bot className="h-4 w-4" />
            {t("Panggilan MCP (30 hari)", "MCP Calls (30 days)")}
          </div>
          <div className="mt-2 text-2xl font-bold">{totalCalls.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            {t("Peringkat Keselamatan", "Safety Boundary")}
          </div>
          <div className="mt-2 text-sm font-medium leading-snug">
            {t(
              "Pasport & bukti bayaran dilindungi; tindakan destruktif diluar MCP.",
              "Passports & payment proofs protected; destructive actions excluded from MCP.",
            )}
          </div>
        </div>
      </div>

      {/* Token table */}
      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("Token", "Token")}</th>
              <th className="px-4 py-3">{t("Peranan", "Role")}</th>
              <th className="px-4 py-3">{t("Skop", "Scopes")}</th>
              <th className="px-4 py-3">{t("Status", "Status")}</th>
              <th className="px-4 py-3">{t("Terakhir Guna", "Last Used")}</th>
              <th className="px-4 py-3 text-right">{t("Tindakan", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((tk) => (
              <tr key={tk.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="font-semibold">{tk.name}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                      {revealed[tk.id] ? "zqk_live_7f3a9c2e8b1d4f6a0c93d2b1e8f74a92" : tk.tokenPreview}
                    </code>
                    <button
                      onClick={() => setRevealed((r) => ({ ...r, [tk.id]: !r[tk.id] }))}
                      className="text-muted-foreground hover:text-foreground"
                      title={revealed[tk.id] ? t("Sembunyi", "Hide") : t("Tunjuk", "Reveal")}
                    >
                      {revealed[tk.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                    <Copy className="h-3.5 w-3.5 cursor-pointer text-muted-foreground hover:text-foreground" />
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {t("Dijana", "Created")} {tk.createdAt} · {t("Tamat", "Expires")} {tk.expiresAt}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                    {t(ROLE_LABELS[tk.role].ms, ROLE_LABELS[tk.role].en)}
                  </span>
                </td>
                <td className="max-w-[220px] px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {tk.scopes.slice(0, 3).map((s) => (
                      <code key={s} className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                        {s}
                      </code>
                    ))}
                    {tk.scopes.length > 3 && (
                      <span className="text-[11px] text-muted-foreground">
                        +{tk.scopes.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                      statusBadgeClass(tk.status),
                    )}
                  >
                    {tk.status === "active" && <BadgeCheck className="h-3 w-3" />}
                    {tk.status === "active"
                      ? t("Aktif", "Active")
                      : tk.status === "expired"
                        ? t("Tamat Tempoh", "Expired")
                        : t("Dibatalkan", "Revoked")}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {tk.lastUsed ?? t("Belum pernah", "Never")}
                  <div className="mt-0.5">{tk.callsLast30d.toLocaleString()} {t("panggilan", "calls")}</div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setRevokeTarget(tk)}
                    disabled={tk.status === "revoked"}
                    className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    title={
                      tk.status === "revoked"
                        ? t("Token dibatalkan", "Token revoked")
                        : t("Batalkan token", "Revoke token")
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Safety note */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <div className="flex items-start gap-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t(
              "Token mewarisi peranan staf yang menjana ia. MCP tidak boleh membaca nombor pasport, imbasan pasport, atau bukti bayaran kecuali peranan benarkan. Tindakan destruktif (batalkan tempahan, batalkan invois, refund) tiada dalam MCP.",
              "Tokens inherit the role of the staff member who created them. MCP can never read passport numbers, passport scans, or payment proofs unless the role allows it. Destructive actions (cancel booking, void invoice, refund) are excluded from MCP.",
            )}
          </p>
        </div>
      </div>

      {/* Create-token dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {generated
                ? t("Token Dijana", "Token Generated")
                : t("Jana Token Baru", "Generate New Token")}
            </DialogTitle>
            <DialogDescription>
              {generated
                ? t(
                    "Salin token ini sekarang — ia tidak akan ditunjukkan lagi.",
                    "Copy this token now — it will not be shown again.",
                  )
                : t(
                    "Token mewarisi peranan staf; setiap panggilan MCP direkodkan dalam audit log.",
                    "Tokens inherit a staff role; every MCP call is audit-logged.",
                  )}
            </DialogDescription>
          </DialogHeader>

          {generated ? (
            <div className="space-y-3">
              <code className="block break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">
                {generated}
              </code>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard?.writeText(generated)}
                  className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {t("Salin Token", "Copy Token")}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("Nama Token", "Token Name")}
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t("cth. Claude Desktop — Owner", "e.g. Claude Desktop — Owner")}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("Peranan (token mewarisi kebenaran peranan ini)", "Role (token inherits this role's permissions)")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ROLE_LABELS) as TokenRole[]).map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setNewRole(role)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        newRole === role
                          ? "border-primary bg-primary text-white"
                          : "bg-white hover:bg-muted/50",
                      )}
                    >
                      {t(ROLE_LABELS[role].ms, ROLE_LABELS[role].en)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("Skop Akses", "Access Scopes")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {MCP_SCOPES.map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleScope(scope)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 font-mono text-[11px]",
                        newScopes.includes(scope)
                          ? "border-primary bg-primary/10 text-primary"
                          : "bg-white text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t("Tamat Tempoh", "Expiry Date")}
                </label>
                <Input
                  type="date"
                  value={newExpiry}
                  onChange={(e) => setNewExpiry(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {generated ? (
              <button
                onClick={resetDialog}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
              >
                {t("Selesai", "Done")}
              </button>
            ) : (
              <>
                <button
                  onClick={resetDialog}
                  className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted/50"
                >
                  {t("Batal", "Cancel")}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting
                    ? t("Menjana…", "Generating…")
                    : t("Jana Token", "Generate Token")}
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("Batalkan Token?", "Revoke Token?")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Klien AI yang guna token ini akan terus ditolak. Tindakan ini direkodkan dalam audit log dan tidak boleh diundur.",
                "AI clients using this token will be rejected immediately. This action is audit-logged and cannot be undone.",
              )}
            </DialogDescription>
          </DialogHeader>
          {revokeTarget && (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-semibold">{revokeTarget.name}</div>
              <code className="mt-1 block font-mono text-xs text-muted-foreground">
                {revokeTarget.tokenPreview}
              </code>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setRevokeTarget(null)}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted/50"
            >
              {t("Batal", "Cancel")}
            </button>
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {revoking
                ? t("Membatalkan…", "Revoking…")
                : t("Ya, Batalkan Token", "Yes, Revoke Token")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

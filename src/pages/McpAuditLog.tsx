import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  ListFilter,
  ScrollText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

type AuditOutcome = "success" | "denied" | "error";

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

// Stub data — backend MCP audit API menyusul pada task backend.
const STUB_AUDIT: AuditEntry[] = [
  {
    id: "mcp_01",
    timestamp: "2026-11-17 09:41",
    tokenName: "Claude Desktop — Owner",
    role: "super_admin",
    tool: "search_customers",
    argsSummary: 'query="Ahmad Zulkifli"',
    outcome: "success",
    durationMs: 120,
  },
  {
    id: "mcp_02",
    timestamp: "2026-11-17 09:38",
    tokenName: "Sales Bot — WhatsApp Assistant",
    role: "sales",
    tool: "get_booking",
    argsSummary: "ref=ZQK-2026-0114",
    outcome: "success",
    durationMs: 96,
  },
  {
    id: "mcp_03",
    timestamp: "2026-11-17 09:35",
    tokenName: "Sales Bot — WhatsApp Assistant",
    role: "sales",
    tool: "read_passport",
    argsSummary: "passengerId=psg_88",
    outcome: "denied",
    deniedReason: "scope:passports:read not granted",
    durationMs: 4,
  },
  {
    id: "mcp_04",
    timestamp: "2026-11-17 09:12",
    tokenName: "Claude Desktop — Owner",
    role: "super_admin",
    tool: "list_departures",
    argsSummary: "from=2026-12-01,to=2027-01-31",
    outcome: "success",
    durationMs: 143,
  },
  {
    id: "mcp_05",
    timestamp: "2026-11-17 08:57",
    tokenName: "Finance Report Sync",
    role: "finance",
    tool: "export_invoices_csv",
    argsSummary: "month=2026-10",
    outcome: "error",
    deniedReason: "upstream: invoice PDF worker timeout",
    durationMs: 8012,
  },
  {
    id: "mcp_06",
    timestamp: "2026-11-16 17:40",
    tokenName: "Sales Bot — WhatsApp Assistant",
    role: "sales",
    tool: "create_lead",
    argsSummary: 'name="Nurul Aisyah", source=whatsapp',
    outcome: "success",
    durationMs: 210,
  },
  {
    id: "mcp_07",
    timestamp: "2026-11-16 16:22",
    tokenName: "Old IDE Agent",
    role: "management",
    tool: "cancel_booking",
    argsSummary: "ref=ZQK-2026-0091",
    outcome: "denied",
    deniedReason: "destructive actions excluded from MCP",
    durationMs: 3,
  },
];

function outcomeBadge(outcome: AuditOutcome) {
  switch (outcome) {
    case "success":
      return { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "success" };
    case "denied":
      return { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "denied" };
    case "error":
      return { cls: "bg-red-50 text-red-700 border-red-200", label: "error" };
  }
}

export default function McpAuditLog() {
  const { t } = useLang();
  const [filter, setFilter] = useState<"all" | AuditOutcome>("all");
  const [search, setSearch] = useState("");

  const entries = useMemo(() => {
    return STUB_AUDIT.filter((e) => {
      if (filter !== "all" && e.outcome !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.tokenName.toLowerCase().includes(q) ||
        e.tool.toLowerCase().includes(q) ||
        e.argsSummary.toLowerCase().includes(q)
      );
    });
  }, [filter, search]);

  const successCount = STUB_AUDIT.filter((e) => e.outcome === "success").length;
  const deniedCount = STUB_AUDIT.filter((e) => e.outcome === "denied").length;
  const errorCount = STUB_AUDIT.filter((e) => e.outcome === "error").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {t("Log Audit MCP", "MCP Audit Log")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Setiap panggilan alat MCP direkodkan dengan token, peranan, argumen, dan hasil — termasuk permintaan yang ditolak oleh semakan kebenaran pelayan.",
            "Every MCP tool call is recorded with token, role, arguments, and outcome — including requests rejected by server-side permission checks.",
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            {t("Berjaya", "Successful")}
          </div>
          <div className="mt-2 text-2xl font-bold">{successCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            {t("Ditolak (Kebenaran)", "Denied (Permissions)")}
          </div>
          <div className="mt-2 text-2xl font-bold">{deniedCount}</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <XCircle className="h-4 w-4" />
            {t("Ralat", "Errors")}
          </div>
          <div className="mt-2 text-2xl font-bold">{errorCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <ListFilter className="h-4 w-4 text-muted-foreground" />
        {(["all", "success", "denied", "error"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              filter === f
                ? "border-primary bg-primary text-white"
                : "bg-white hover:bg-muted/50",
            )}
          >
            {f === "all"
              ? t("Semua", "All")
              : f === "success"
                ? t("Berjaya", "Success")
                : f === "denied"
                  ? t("Ditolak", "Denied")
                  : t("Ralat", "Error")}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Cari token, alat, atau argumen…", "Search token, tool, or arguments…")}
          className="ml-auto h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {/* Log table */}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("Masa", "Time")}</th>
              <th className="px-4 py-3">{t("Token", "Token")}</th>
              <th className="px-4 py-3">{t("Alat MCP", "MCP Tool")}</th>
              <th className="px-4 py-3">{t("Hasil", "Outcome")}</th>
              <th className="px-4 py-3 text-right">{t("Tempoh", "Duration")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <ScrollText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  {t("Tiada entri log sepadan.", "No matching log entries.")}
                </td>
              </tr>
            )}
            {entries.map((e) => {
              const badge = outcomeBadge(e.outcome);
              return (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    <Clock className="mr-1 inline h-3.5 w-3.5" />
                    {e.timestamp}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.tokenName}</div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {e.role}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {e.tool}
                    </code>
                    <div className="mt-1 max-w-[280px] truncate font-mono text-[11px] text-muted-foreground">
                      {e.argsSummary}
                    </div>
                    {e.deniedReason && (
                      <div className="mt-0.5 text-[11px] font-medium text-amber-700">
                        {e.deniedReason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                        badge.cls,
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                    {e.durationMs} ms
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Note */}
      <div className="rounded-xl border bg-white p-4 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t(
              "Log audit adalah lampiran kepada log audit staf sedia ada — entri MCP ditanda dengan token yang digunakan supaya tindakan AI boleh dibezakan daripada tindakan manusia.",
              "The audit log supplements the existing staff audit trail — MCP entries are tagged with the token used so AI actions can be distinguished from human actions.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  Clock,
  FileText,
  ListFilter,
  LogIn,
  LogOut,
  Pencil,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StaffAction =
  | "login"
  | "logout"
  | "role_change"
  | "staff_invite"
  | "settings_update";

type AuditOutcome = "success" | "failed";

interface StaffAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorEmail: string;
  action: StaffAction;
  detail: string;
  ip: string;
  outcome: AuditOutcome;
}

const ACTION_META: Record<
  StaffAction,
  { label: { ms: string; en: string }; icon: typeof LogIn }
> = {
  login: { label: { ms: "Log Masuk", en: "Sign In" }, icon: LogIn },
  logout: { label: { ms: "Log Keluar", en: "Sign Out" }, icon: LogOut },
  role_change: { label: { ms: "Tukar Peranan", en: "Role Change" }, icon: ShieldCheck },
  staff_invite: { label: { ms: "Jemput Staf", en: "Staff Invite" }, icon: UserPlus },
  settings_update: { label: { ms: "Kemas Tetapan", en: "Settings Update" }, icon: Pencil },
};

// Stub data — backend staff audit API menyusul pada fasa backend.
const STUB_ENTRIES: StaffAuditEntry[] = [
  { id: "sa_01", timestamp: "2026-11-17 15:40", actor: "Zack (Owner)", actorEmail: "owner@zaqone.travel", action: "login", detail: "Successful sign-in from Chrome / Windows", ip: "103.28.54.12", outcome: "success" },
  { id: "sa_02", timestamp: "2026-11-17 15:02", actor: "Farah (Management)", actorEmail: "manager@zaqone.travel", action: "role_change", detail: "Changed Adib's role from operations → sales", ip: "103.28.54.19", outcome: "success" },
  { id: "sa_03", timestamp: "2026-11-17 11:02", actor: "Farah (Management)", actorEmail: "manager@zaqone.travel", action: "login", detail: "Successful sign-in from Safari / macOS", ip: "103.28.54.19", outcome: "success" },
  { id: "sa_04", timestamp: "2026-11-17 09:55", actor: "Unknown", actorEmail: "owner@zaqone.travel", action: "login", detail: "Failed sign-in — wrong password (attempt 3)", ip: "45.132.90.77", outcome: "failed" },
  { id: "sa_05", timestamp: "2026-11-16 18:25", actor: "Adib (Sales)", actorEmail: "sales@zaqone.travel", action: "logout", detail: "Session ended", ip: "103.28.54.44", outcome: "success" },
  { id: "sa_06", timestamp: "2026-11-16 17:48", actor: "Zack (Owner)", actorEmail: "owner@zaqone.travel", action: "staff_invite", detail: "Invited ops@zaqone.travel as operations", ip: "103.28.54.12", outcome: "success" },
  { id: "sa_07", timestamp: "2026-11-15 09:14", actor: "Melati (Finance)", actorEmail: "finance@zaqone.travel", action: "settings_update", detail: "Updated report currency default to RM", ip: "103.28.54.61", outcome: "success" },
  { id: "sa_08", timestamp: "2026-11-14 08:30", actor: "Unknown", actorEmail: "sales@zaqone.travel", action: "login", detail: "Failed sign-in — account temporarily locked", ip: "45.132.90.77", outcome: "failed" },
];

export default function StaffAuditLog() {
  const { t } = useLang();
  const [actionFilter, setActionFilter] = useState<"all" | StaffAction>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | AuditOutcome>("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StaffAuditEntry | null>(null);

  const actors = useMemo(
    () => Array.from(new Set(STUB_ENTRIES.map((e) => e.actorEmail))),
    [],
  );

  const entries = useMemo(() => {
    return STUB_ENTRIES.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (outcomeFilter !== "all" && e.outcome !== outcomeFilter) return false;
      if (actorFilter !== "all" && e.actorEmail !== actorFilter) return false;
      if (dateFilter && !e.timestamp.startsWith(dateFilter)) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.actor.toLowerCase().includes(q) ||
        e.actorEmail.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.ip.includes(q)
      );
    });
  }, [actionFilter, outcomeFilter, actorFilter, dateFilter, search]);

  const successCount = STUB_ENTRIES.filter((e) => e.outcome === "success").length;
  const failedCount = STUB_ENTRIES.filter((e) => e.outcome === "failed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {t("Log Audit Staf", "Staff Audit Log")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Jejak aktiviti akaun staf: log masuk, perubahan peranan dan tetapan.",
            "Trail of staff account activity: sign-ins, role changes and settings.",
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Jumlah Rekod", "Total Events")}</p>
          <p className="mt-1 font-display text-xl font-bold">{STUB_ENTRIES.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Berjaya", "Successful")}</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-600">{successCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Gagal", "Failed")}</p>
          <p className="mt-1 font-display text-xl font-bold text-red-600">{failedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-3">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ListFilter className="h-3.5 w-3.5" />
          {t("Penapis", "Filters")}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Cari staf / IP…", "Search staff / IP…")}
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as "all" | StaffAction)}
            className="h-9 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">{t("Semua tindakan", "All actions")}</option>
            {(Object.keys(ACTION_META) as StaffAction[]).map((a) => (
              <option key={a} value={a}>
                {t(ACTION_META[a].label.ms, ACTION_META[a].label.en)}
              </option>
            ))}
          </select>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">{t("Semua staf", "All staff")}</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as "all" | AuditOutcome)}
            className="h-9 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">{t("Semua hasil", "All outcomes")}</option>
            <option value="success">{t("Berjaya", "Successful")}</option>
            <option value="failed">{t("Gagal", "Failed")}</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">{t("Masa", "Time")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("Staf", "Staff")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("Tindakan", "Action")}</th>
              <th className="hidden px-4 py-2.5 font-semibold md:table-cell">{t("Butiran", "Detail")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("Hasil", "Outcome")}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const Icon = ACTION_META[e.action].icon;
              return (
                <tr key={e.id} className="border-b last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {e.timestamp}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.actor}</div>
                    <div className="text-xs text-muted-foreground">{e.actorEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
                      <Icon className="h-3.5 w-3.5" />
                      {t(ACTION_META[e.action].label.ms, ACTION_META[e.action].label.en)}
                    </span>
                  </td>
                  <td className="hidden max-w-xs truncate px-4 py-3 text-xs text-muted-foreground md:table-cell">
                    {e.detail}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
                        e.outcome === "success"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-700 border-red-200",
                      )}
                    >
                      {e.outcome === "success" ? (
                        <ShieldCheck className="h-3 w-3" />
                      ) : (
                        <ShieldAlert className="h-3 w-3" />
                      )}
                      {e.outcome === "success"
                        ? t("Berjaya", "Success")
                        : t("Gagal", "Failed")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(e)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted/50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {t("Butiran", "View")}
                    </button>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {t("Tiada rekod sepadan.", "No matching records.")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail dialog */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Butiran Audit", "Audit Detail")}</DialogTitle>
            <DialogDescription>{selected?.id}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("Masa", "Time")}</span>
                <span className="font-medium">{selected.timestamp}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("Staf", "Staff")}</span>
                <span className="font-medium">{selected.actor}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("Emel", "Email")}</span>
                <span className="font-medium">{selected.actorEmail}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("Tindakan", "Action")}</span>
                <span className="font-medium">
                  {t(
                    ACTION_META[selected.action].label.ms,
                    ACTION_META[selected.action].label.en,
                  )}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("Butiran", "Detail")}</span>
                <p className="mt-1 rounded-md bg-muted/50 p-2 text-sm">{selected.detail}</p>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">IP</span>
                <span className="font-mono text-xs">{selected.ip}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t("Rekod audit tidak boleh dipadam.", "Audit records are immutable.")}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ScrollText className="h-3.5 w-3.5" />
        {t(
          "Data olok-olok — log audit sebenar akan didayakan pada fasa backend.",
          "Mock data — real audit log will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

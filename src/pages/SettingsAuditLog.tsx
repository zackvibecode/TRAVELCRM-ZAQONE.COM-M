import { useMemo, useState } from "react";
import { FileDiff, ListFilter, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ChangeType = "updated" | "created" | "deleted";

interface SettingsAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  module: string;
  field: string;
  before: string;
  after: string;
  changeType: ChangeType;
}

const CHANGE_META: Record<ChangeType, { ms: string; en: string; icon: typeof Pencil; cls: string }> = {
  updated: { ms: "Dikemas kini", en: "Updated", icon: Pencil, cls: "bg-sky-50 text-sky-700 border-sky-200" },
  created: { ms: "Dicipta", en: "Created", icon: Plus, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  deleted: { ms: "Dipadam", en: "Deleted", icon: Trash2, cls: "bg-red-50 text-red-700 border-red-200" },
};

// Mock data — backend settings audit API menyusul pada fasa backend.
const STUB: SettingsAuditEntry[] = [
  { id: "saudit_01", timestamp: "2026-11-17 15:12", actor: "Zack (Owner)", module: "General", field: "currency", before: "IDR", after: "MYR", changeType: "updated" },
  { id: "saudit_02", timestamp: "2026-11-17 14:58", actor: "Zack (Owner)", module: "Company", field: "companyName", before: "ZAQONE TRAVEL", after: "ZAQONE TRAVEL & TOURS", changeType: "updated" },
  { id: "saudit_03", timestamp: "2026-11-17 10:30", actor: "Melati (Finance)", module: "Bank Accounts", field: "account.ba_03", before: "—", after: "Hong Leong Islamic Bank ••••2345", changeType: "created" },
  { id: "saudit_04", timestamp: "2026-11-16 17:44", actor: "Farah (Management)", module: "Document Numbering", field: "invoice.nextNo", before: "340", after: "342", changeType: "updated" },
  { id: "saudit_05", timestamp: "2026-11-16 09:15", actor: "Zack (Owner)", module: "Notifications", field: "notifyNewLead", before: "true", after: "false", changeType: "updated" },
  { id: "saudit_06", timestamp: "2026-11-15 08:22", actor: "Farah (Management)", module: "API Tokens", field: "token.Legacy Mobile App", before: "active", after: "revoked", changeType: "updated" },
  { id: "saudit_07", timestamp: "2026-11-14 16:05", actor: "Zack (Owner)", module: "Bank Accounts", field: "account.ba_09", before: "CIMB ••••0001", after: "—", changeType: "deleted" },
];

export default function SettingsAuditLog() {
  const { t } = useLang();
  const [moduleFilter, setModuleFilter] = useState("all");
  const [changeFilter, setChangeFilter] = useState<"all" | ChangeType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SettingsAuditEntry | null>(null);

  const modules = useMemo(
    () => Array.from(new Set(STUB.map((e) => e.module))),
    [],
  );

  const entries = useMemo(() => {
    return STUB.filter((e) => {
      if (moduleFilter !== "all" && e.module !== moduleFilter) return false;
      if (changeFilter !== "all" && e.changeType !== changeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.actor.toLowerCase().includes(q) ||
        e.field.toLowerCase().includes(q) ||
        e.before.toLowerCase().includes(q) ||
        e.after.toLowerCase().includes(q)
      );
    });
  }, [moduleFilter, changeFilter, search]);

  const fieldCls =
    "h-9 rounded-md border border-input bg-white px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {t("Log Audit Tetapan", "Settings Audit Log")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Jejak semua perubahan konfigurasi sistem.",
            "Trail of every system configuration change.",
          )}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Jumlah Perubahan", "Total Changes")}</p>
          <p className="mt-1 font-display text-xl font-bold">{STUB.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Modul", "Modules")}</p>
          <p className="mt-1 font-display text-xl font-bold">{modules.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">{t("Padaman", "Deletions")}</p>
          <p className="mt-1 font-display text-xl font-bold text-red-600">
            {STUB.filter((e) => e.changeType === "deleted").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-white p-3">
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ListFilter className="h-3.5 w-3.5" />
          {t("Penapis", "Filters")}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Cari medan / nilai…", "Search field / value…")}
            className={fieldCls}
          />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className={fieldCls}
          >
            <option value="all">{t("Semua modul", "All modules")}</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={changeFilter}
            onChange={(e) => setChangeFilter(e.target.value as "all" | ChangeType)}
            className={fieldCls}
          >
            <option value="all">{t("Semua perubahan", "All changes")}</option>
            {(Object.keys(CHANGE_META) as ChangeType[]).map((k) => (
              <option key={k} value={k}>
                {t(CHANGE_META[k].ms, CHANGE_META[k].en)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">{t("Masa", "Time")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("Oleh", "By")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("Modul", "Module")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("Medan", "Field")}</th>
              <th className="px-4 py-2.5 font-semibold">{t("Perubahan", "Change")}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const meta = CHANGE_META[e.changeType];
              const Icon = meta.icon;
              return (
                <tr key={e.id} className="border-b last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{e.timestamp}</td>
                  <td className="px-4 py-3 font-medium">{e.actor}</td>
                  <td className="px-4 py-3 text-xs">{e.module}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.field}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", meta.cls)}>
                      <Icon className="h-3 w-3" />
                      {t(meta.ms, meta.en)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelected(e)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted/50"
                    >
                      <FileDiff className="h-3.5 w-3.5" />
                      {t("Banding", "Diff")}
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

      {/* Diff dialog */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Perubahan Tetapan", "Settings Change")}</DialogTitle>
            <DialogDescription>{selected?.id}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("Masa", "Time")}</span>
                <span className="font-medium">{selected.timestamp}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("Oleh", "By")}</span>
                <span className="font-medium">{selected.actor}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">{t("Modul", "Module")}</span>
                <span className="font-medium">{selected.module}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t("Medan", "Field")}</span>
                <p className="mt-1 font-mono text-xs">{selected.field}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-red-200 bg-red-50 p-2">
                  <p className="text-[11px] font-semibold text-red-700">{t("Sebelum", "Before")}</p>
                  <p className="mt-1 break-all font-mono text-xs">{selected.before}</p>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                  <p className="text-[11px] font-semibold text-emerald-700">{t("Selepas", "After")}</p>
                  <p className="mt-1 break-all font-mono text-xs">{selected.after}</p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ScrollText className="h-3.5 w-3.5" />
                {t("Rekod audit tidak boleh dipadam.", "Audit records are immutable.")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <p className="text-xs text-muted-foreground">
        {t(
          "Data olok-olok — log audit sebenar akan didayakan pada fasa backend.",
          "Mock data — real audit log will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

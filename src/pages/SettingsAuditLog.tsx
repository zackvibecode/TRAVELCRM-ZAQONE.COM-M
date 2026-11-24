import { useEffect, useMemo, useRef, useState } from "react";
import { FileDiff, ListFilter, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

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

const CHANGE_META: Record<ChangeType, { ms: string; en: string; icon: typeof Pencil; pill: string }> = {
  updated: { ms: "Dikemas kini", en: "Updated", icon: Pencil, pill: "bg-[var(--color-info-soft)] text-[var(--color-info)]" },
  created: { ms: "Dicipta", en: "Created", icon: Plus, pill: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  deleted: { ms: "Dipadam", en: "Deleted", icon: Trash2, pill: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" },
};

// Loaded from the real /settings/audit API on mount.
const STUB: SettingsAuditEntry[] = [];

const PANEL = "rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]";
const FIELD =
  "w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]";

export default function SettingsAuditLog() {
  const { t } = useLang();
  const [rows, setRows] = useState<SettingsAuditEntry[]>(STUB);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [changeFilter, setChangeFilter] = useState<"all" | ChangeType>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SettingsAuditEntry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Load the real settings audit trail from the API.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ entries?: Record<string, unknown>[] }>(
          "/settings/audit?limit=200",
        );
        if (Array.isArray(res.entries)) {
          setRows(
            res.entries.map((r) => ({
              id: String(r.id),
              timestamp: String(r.at ?? r.createdAt ?? ""),
              actor: String(r.updatedBy ?? r.actor ?? "system"),
              module: String(r.key ?? r.module ?? "Settings"),
              field: String(r.key ?? ""),
              before: String(r.previousValue ?? r.before ?? "—"),
              after: String(r.newValue ?? r.after ?? "—"),
              changeType: (r.changeType === "created" || r.changeType === "deleted"
                ? r.changeType
                : "updated") as ChangeType,
            })),
          );
        }
      } catch {
        /* empty state on failure */
      }
    })();
  }, []);

  const openDetail = (e: SettingsAuditEntry) => {
    setSelected(e);
    dialogRef.current?.showModal();
  };

  const closeDetail = () => {
    dialogRef.current?.close();
    setSelected(null);
  };

  const modules = useMemo(
    () => Array.from(new Set(rows.map((e) => e.module))),
    [rows],
  );

  const entries = useMemo(() => {
    return rows.filter((e) => {
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

  const th =
    "border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]";

  return (
    <div className="space-y-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Log Audit Tetapan", "Settings Audit Log")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Jejak semua perubahan konfigurasi sistem.",
              "Trail of every system configuration change.",
            )}
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${PANEL} p-3`}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Jumlah Perubahan", "Total Changes")}</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--color-text)]">{STUB.length}</p>
        </div>
        <div className={`${PANEL} p-3`}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Modul", "Modules")}</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--color-text)]">{modules.length}</p>
        </div>
        <div className={`${PANEL} p-3`}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Padaman", "Deletions")}</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--color-danger)]">
            {STUB.filter((e) => e.changeType === "deleted").length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className={PANEL}>
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          <ListFilter className="h-3.5 w-3.5" />
          {t("Penapis", "Filters")}
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Cari medan / nilai…", "Search field / value…")}
            className={FIELD}
          />
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className={FIELD}
          >
            <option value="all">{t("Semua modul", "All modules")}</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={changeFilter}
            onChange={(e) => setChangeFilter(e.target.value as "all" | ChangeType)}
            className={FIELD}
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
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th scope="col" className={th}>{t("Masa", "Time")}</th>
                <th scope="col" className={th}>{t("Oleh", "By")}</th>
                <th scope="col" className={th}>{t("Modul", "Module")}</th>
                <th scope="col" className={th}>{t("Medan", "Field")}</th>
                <th scope="col" className={th}>{t("Perubahan", "Change")}</th>
                <th scope="col" className={`${th} text-right`} />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const meta = CHANGE_META[e.changeType];
                const Icon = meta.icon;
                return (
                  <tr key={e.id} className="transition-colors hover:bg-[var(--color-surface-raised)]">
                    <td className="whitespace-nowrap border-b border-[var(--color-border)] px-4 py-3 font-mono text-xs tabular-nums text-[var(--color-text-secondary)] last:border-b-0">
                      {e.timestamp}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 font-semibold text-[var(--color-text)] last:border-b-0">
                      {e.actor}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 text-[var(--color-text-secondary)] last:border-b-0">
                      {e.module}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 font-mono text-xs text-[var(--color-text-secondary)] last:border-b-0">
                      {e.field}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${meta.pill}`}>
                        <Icon className="h-3 w-3" />
                        {t(meta.ms, meta.en)}
                      </span>
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 text-right last:border-b-0">
                      <button
                        onClick={() => openDetail(e)}
                        className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
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
                  <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
                    {t("Tiada rekod sepadan.", "No matching records.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diff dialog */}
      <dialog
        ref={dialogRef}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onCancel={() => setSelected(null)}
        className="m-auto w-[min(460px,calc(100vw-32px))] rounded-[var(--radius-panel)] border-0 bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
        aria-labelledby="saudit-dialog-title"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 id="saudit-dialog-title" className="font-display text-[16px] font-bold">
              {t("Perubahan Tetapan", "Settings Change")}
            </h2>
            <p className="mt-1 font-mono text-[11.5px] text-[var(--color-text-muted)]">{selected?.id}</p>
          </div>
          {selected && (
            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-[var(--color-text-muted)]">{t("Masa", "Time")}</span>
                <span className="font-mono text-xs tabular-nums font-semibold text-[var(--color-text)]">{selected.timestamp}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-[var(--color-text-muted)]">{t("Oleh", "By")}</span>
                <span className="font-semibold text-[var(--color-text)]">{selected.actor}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-[var(--color-text-muted)]">{t("Modul", "Module")}</span>
                <span className="font-semibold text-[var(--color-text)]">{selected.module}</span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">{t("Medan", "Field")}</span>
                <p className="mt-1 font-mono text-xs text-[var(--color-text-secondary)]">{selected.field}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-[var(--radius-card)] border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] p-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-danger)]">{t("Sebelum", "Before")}</p>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--color-text)]">{selected.before}</p>
                </div>
                <div className="rounded-[var(--radius-card)] border border-[var(--color-success-soft)] bg-[var(--color-success-soft)] p-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-success)]">{t("Selepas", "After")}</p>
                  <p className="mt-1 break-all font-mono text-xs text-[var(--color-text)]">{selected.after}</p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <ScrollText className="h-3.5 w-3.5" />
                {t("Rekod audit tidak boleh dipadam.", "Audit records are immutable.")}
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-5 py-4">
          <button
            onClick={closeDetail}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            {t("Tutup", "Close")}
          </button>
        </div>
      </dialog>

      <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
        {t(
          "Setiap perubahan tetapan direkod dengan nilai sebelum dan selepas untuk tujuan audit.",
          "Every settings change is recorded with before and after values for audit purposes.",
        )}
      </p>
    </div>
  );
}

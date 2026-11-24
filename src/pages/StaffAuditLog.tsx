import { useMemo, useRef, useState } from "react";
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
import { useLang } from "@/lib/i18n";

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

// Empty until the backend staff audit API is wired up.
const STUB_ENTRIES: StaffAuditEntry[] = [];

const PANEL = "rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]";
const FIELD =
  "w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)]";

export default function StaffAuditLog() {
  const { t } = useLang();
  const [actionFilter, setActionFilter] = useState<"all" | StaffAction>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | AuditOutcome>("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StaffAuditEntry | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const openDetail = (e: StaffAuditEntry) => {
    setSelected(e);
    dialogRef.current?.showModal();
  };

  const closeDetail = () => {
    dialogRef.current?.close();
    setSelected(null);
  };

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

  const th =
    "border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]";

  return (
    <div className="space-y-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Log Audit Staf", "Staff Audit Log")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Jejak aktiviti akaun staf: log masuk, perubahan peranan dan tetapan.",
              "Trail of staff account activity: sign-ins, role changes and settings.",
            )}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${PANEL} p-3`}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Jumlah Rekod", "Total Events")}</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--color-text)]">{STUB_ENTRIES.length}</p>
        </div>
        <div className={`${PANEL} p-3`}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Berjaya", "Successful")}</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--color-success)]">{successCount}</p>
        </div>
        <div className={`${PANEL} p-3`}>
          <p className="text-xs text-[var(--color-text-muted)]">{t("Gagal", "Failed")}</p>
          <p className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--color-danger)]">{failedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className={PANEL}>
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-5 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
          <ListFilter className="h-3.5 w-3.5" />
          {t("Penapis", "Filters")}
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Cari staf / IP…", "Search staff / IP…")}
            className={FIELD}
          />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as "all" | StaffAction)}
            className={FIELD}
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
            className={FIELD}
          >
            <option value="all">{t("Semua staf", "All staff")}</option>
            {actors.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as "all" | AuditOutcome)}
            className={FIELD}
          >
            <option value="all">{t("Semua hasil", "All outcomes")}</option>
            <option value="success">{t("Berjaya", "Successful")}</option>
            <option value="failed">{t("Gagal", "Failed")}</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th scope="col" className={th}>{t("Masa", "Time")}</th>
                <th scope="col" className={th}>{t("Staf", "Staff")}</th>
                <th scope="col" className={th}>{t("Tindakan", "Action")}</th>
                <th scope="col" className={`${th} hidden md:table-cell`}>{t("Butiran", "Detail")}</th>
                <th scope="col" className={th}>{t("Hasil", "Outcome")}</th>
                <th scope="col" className={`${th} text-right`} />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const Icon = ACTION_META[e.action].icon;
                return (
                  <tr key={e.id} className="transition-colors hover:bg-[var(--color-surface-raised)]">
                    <td className="whitespace-nowrap border-b border-[var(--color-border)] px-4 py-3 font-mono text-xs tabular-nums text-[var(--color-text-secondary)] last:border-b-0">
                      {e.timestamp}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                      <div className="font-semibold text-[var(--color-text)]">{e.actor}</div>
                      <div className="font-mono text-[11px] text-[var(--color-text-muted)]">{e.actorEmail}</div>
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-neutral-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                        <Icon className="h-3.5 w-3.5" />
                        {t(ACTION_META[e.action].label.ms, ACTION_META[e.action].label.en)}
                      </span>
                    </td>
                    <td className="hidden max-w-xs truncate border-b border-[var(--color-border)] px-4 py-3 text-xs text-[var(--color-text-muted)] last:border-b-0 md:table-cell">
                      {e.detail}
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 last:border-b-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                          e.outcome === "success"
                            ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                            : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
                        }`}
                      >
                        {e.outcome === "success" ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <ShieldAlert className="h-3 w-3" />
                        )}
                        {e.outcome === "success" ? t("Berjaya", "Success") : t("Gagal", "Failed")}
                      </span>
                    </td>
                    <td className="border-b border-[var(--color-border)] px-4 py-3 text-right last:border-b-0">
                      <button
                        onClick={() => openDetail(e)}
                        className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
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
                  <td colSpan={6} className="px-4 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
                    {t("Tiada rekod sepadan.", "No matching records.")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail dialog */}
      <dialog
        ref={dialogRef}
        open={selected !== null}
        onClose={() => setSelected(null)}
        onCancel={() => setSelected(null)}
        className="m-auto w-[min(460px,calc(100vw-32px))] rounded-[var(--radius-panel)] border-0 bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-[0_24px_60px_rgba(0,0,0,0.28)]"
        aria-labelledby="saudit-staff-dialog-title"
      >
        <div className="space-y-4 p-5">
          <div>
            <h2 id="saudit-staff-dialog-title" className="font-display text-[16px] font-bold">
              {t("Butiran Audit", "Audit Detail")}
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
                <span className="text-[var(--color-text-muted)]">{t("Staf", "Staff")}</span>
                <span className="font-semibold text-[var(--color-text)]">{selected.actor}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-[var(--color-text-muted)]">{t("Emel", "Email")}</span>
                <span className="font-mono text-xs text-[var(--color-text)]">{selected.actorEmail}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
                <span className="text-[var(--color-text-muted)]">{t("Tindakan", "Action")}</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {t(
                    ACTION_META[selected.action].label.ms,
                    ACTION_META[selected.action].label.en,
                  )}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-muted)]">{t("Butiran", "Detail")}</span>
                <p className="mt-1 rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] p-2.5 text-[13px] text-[var(--color-text-secondary)]">
                  {selected.detail}
                </p>
              </div>
              <div className="flex justify-between border-t border-[var(--color-border)] pt-2">
                <span className="text-[var(--color-text-muted)]">IP</span>
                <span className="font-mono text-xs tabular-nums text-[var(--color-text)]">{selected.ip}</span>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Clock className="h-3.5 w-3.5" />
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

      <p className="m-0 flex items-center gap-1.5 text-[11.5px] text-[var(--color-text-muted)]">
        <ScrollText className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        {t(
          "Setiap tindakan staf direkod dengan masa, alamat IP dan hasilnya.",
          "Every staff action is recorded with time, IP address and outcome.",
        )}
      </p>
    </div>
  );
}

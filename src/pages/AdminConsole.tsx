import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileSpreadsheet,
  Info,
  LayoutGrid,
  Loader2,
  Settings2,
  ShieldCheck,
  Search,
  UserCog,
  UsersRound,
} from "lucide-react";
import { cn, formatKlDateTime as formatKlDateTimeUtil, parseDbDate } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { followupApi, type AdminImportBatch, type AdminUser, type StageRule } from "@/lib/followup-api";
import { FollowupEmptyState, FollowupErrorState, FollowupLoading } from "@/components/FollowupStates";
import { translateReason } from "@/components/ImportHistoryPanel";
import { crmAccessRole, type CrmAccessRole } from "@/pages/LeadManagement";

/**
 * Admin Console — the single admin surface for the WhatsApp Follow-Up CRM.
 * Tabs: Overview (live KPIs), Follow-up stage rules, Users & roles,
 * Lead transfer, Import monitor. All data comes from /api/followup/admin/*.
 */

type AdminTab = "overview" | "stages" | "users" | "transfer" | "imports";

type TFn = (ms: string, en: string) => string;

/** Formats a timestamp for display in Asia/Kuala_Lumpur (D1 bare-UTC aware). */
export function formatKlDateTime(iso: string): string {
  return formatKlDateTimeUtil(iso);
}

/** Derives the import status label from the batch counters (there is no status column). */
export function importBatchStatus(b: { insertedRows: number; duplicateRows: number; failedRows: number; totalRows: number }): "done" | "partial" | "failed" {
  if (b.insertedRows === 0 && b.totalRows > 0) return "failed";
  if (b.failedRows + b.duplicateRows > 0) return "partial";
  return "done";
}

/** Query state shared by every admin tab. */
interface AdminQuery<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/** Minimal data hook for the admin endpoints (mirrors useFollowup's contract). */
function useAdminQuery<T>(key: string, fetcher: () => Promise<T>): AdminQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading((cur) => cur || data === null);
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const result = await fetcher();
        if (alive) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error, refetch: run };
}

export default function AdminConsole() {
  const { t, lang } = useLang();
  const session = getSession();
  const accessRole: CrmAccessRole | null = session ? crmAccessRole(session.role) : null;
  const [tab, setTab] = useState<AdminTab>("overview");
  const [notice, setNotice] = useState("");

  const stagesQ = useAdminQuery<StageRule[]>("stages", () => followupApi.stages());
  const usersQ = useAdminQuery<AdminUser[]>("users", () => followupApi.adminUsers());
  const importsQ = useAdminQuery<AdminImportBatch[]>("imports", () => followupApi.adminImports({ status: "all" }));

  function showNotice(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 4000);
  }

  const users = usersQ.data ?? [];
  const salesUsers = useMemo(() => users.filter((u) => u.role === "sales" && u.active), [users]);

  const tabs: { key: AdminTab; label: [string, string]; icon: typeof LayoutGrid }[] = [
    { key: "overview", label: ["Ringkasan", "Overview"], icon: LayoutGrid },
    { key: "stages", label: ["Peringkat Susulan", "Follow-up Stages"], icon: CalendarClock },
    { key: "users", label: ["Pengguna & Peranan", "Users & Roles"], icon: UserCog },
    { key: "transfer", label: ["Pindah Lead", "Lead Transfer"], icon: ArrowLeftRight },
    { key: "imports", label: ["Monitor Import", "Import Monitor"], icon: Download },
  ];

  if (accessRole !== "ADMIN") {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="max-w-md text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-[var(--color-danger)]" />
          <h1 className="mt-4 font-display text-[20px] font-bold">
            {t("Akses ditolak", "Access denied")}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            {t(
              "Konsol Admin hanya untuk Super Admin dan Management.",
              "The Admin Console is restricted to Super Admin and Management.",
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-4 py-6 md:px-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
            <Settings2 className="h-3.5 w-3.5" />
            {t("Konsol Admin", "Admin Console")}
          </div>
          <h1 className="m-0 mt-1 font-display text-[24px] font-bold leading-tight">
            {t("Kawal Keseluruhan CRM", "Control the Entire CRM")}
          </h1>
          <p className="m-0 mt-1 text-[13px] text-muted-foreground">
            {t(
              "Peringkat susulan, pengguna, pemilikan lead dan import — semuanya di satu tempat.",
              "Follow-up stages, users, lead ownership and imports — all in one place.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold">
          <UsersRound className="h-3.5 w-3.5 text-muted-foreground" />
          {t(`${salesUsers.length} sales aktif`, `${salesUsers.length} active sales`)}
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1" aria-label={t("Tab konsol", "Console tabs")}>
        {tabs.map((tb) => {
          const Icon = tb.icon;
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.key)}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors",
                active
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "text-muted-foreground hover:bg-[var(--color-surface-raised)] hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(tb.label[0], tb.label[1])}
            </button>
          );
        })}
      </nav>

      {tab === "overview" && (
        <OverviewPanel
          t={t}
          lang={lang}
          stages={stagesQ}
          users={users}
          usersLoading={usersQ.loading}
          imports={importsQ}
          onGo={setTab}
        />
      )}
      {tab === "stages" && (
        <StagesPanel
          t={t}
          query={stagesQ}
          onSaved={async () => {
            await stagesQ.refetch();
            showNotice(t("Peraturan peringkat disimpan.", "Stage rules saved."));
          }}
        />
      )}
      {tab === "users" && <UsersPanel t={t} query={usersQ} />}
      {tab === "transfer" && (
        <TransferPanel
          t={t}
          users={salesUsers}
          loading={usersQ.loading}
          onDone={async (msg) => {
            await usersQ.refetch();
            showNotice(msg);
          }}
        />
      )}
      {tab === "imports" && <ImportsPanel t={t} query={importsQ} />}

      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[80] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[13px] font-semibold shadow-xl"
        >
          {notice}
        </div>
      )}
    </div>
  );
}

/** Overview: live KPI cards + quick links to each console area. */
function OverviewPanel({
  t,
  lang,
  stages,
  users,
  usersLoading,
  imports,
  onGo,
}: {
  t: TFn;
  lang: string;
  stages: AdminQuery<StageRule[]>;
  users: AdminUser[];
  usersLoading: boolean;
  imports: AdminQuery<AdminImportBatch[]>;
  onGo: (tab: AdminTab) => void;
}) {
  const activeSales = users.filter((u) => u.role === "sales" && u.active).length;
  const totalLeads = users.reduce((sum, u) => sum + u.openLeads, 0);
  const stageRules = stages.data ?? [];
  const totalDays = stageRules.filter((r) => r.active).reduce((sum, r) => sum + r.daysAfterPrevious, 0);
  // Month prefix in KL (the batch createdAt is a bare-UTC D1 timestamp).
  const nowKl = new Date(Date.now() + 8 * 3_600_000);
  const monthPrefix = `${nowKl.getUTCFullYear()}-${String(nowKl.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthImports = (imports.data ?? []).filter((b) => {
    const d = parseDbDate(b.createdAt);
    const kl = new Date(d.getTime() + 8 * 3_600_000);
    return `${kl.getUTCFullYear()}-${String(kl.getUTCMonth() + 1).padStart(2, "0")}` === monthPrefix;
  });
  const failedThisMonth = monthImports.reduce((s, i) => s + i.failedRows + i.duplicateRows, 0);

  const kpis: { label: [string, string]; value: string; hint: [string, string]; icon: typeof LayoutGrid; tone: string }[] = [
    {
      label: ["Peringkat aktif", "Active stages"],
      value: stages.loading ? "—" : `${stageRules.filter((r) => r.active).length}/${stageRules.length || 3}`,
      hint: [`${totalDays} hari kitaran`, `${totalDays}-day cycle`],
      icon: CalendarClock,
      tone: "var(--color-info)",
    },
    {
      label: ["Sales aktif", "Active sales"],
      value: usersLoading ? "—" : `${activeSales}`,
      hint: [`${users.length} jumlah akaun`, `${users.length} total accounts`],
      icon: UserCog,
      tone: "var(--color-primary)",
    },
    {
      label: ["Lead terbuka", "Open leads"],
      value: usersLoading ? "—" : `${totalLeads}`,
      hint: ["ditugaskan kepada sales", "assigned to sales"],
      icon: UsersRound,
      tone: "var(--color-warning)",
    },
    {
      label: ["Import bulan ini", "Imports this month"],
      value: imports.loading ? "—" : `${monthImports.length}`,
      hint: [`${failedThisMonth} baris gagal`, `${failedThisMonth} failed rows`],
      icon: Download,
      tone: "var(--color-success)",
    },
  ];

  const quickLinks: { tab: AdminTab; label: [string, string]; desc: [string, string]; icon: typeof LayoutGrid }[] = [
    { tab: "stages", label: ["Peringkat Susulan", "Follow-up Stages"], desc: ["Tetapkan bila FU1/FU2/FU3 dijadualkan.", "Set when FU1/FU2/FU3 are scheduled."], icon: CalendarClock },
    { tab: "users", label: ["Pengguna & Peranan", "Users & Roles"], desc: ["Urus akaun sales dan peranan.", "Manage sales accounts and roles."], icon: UserCog },
    { tab: "transfer", label: ["Pindah Lead", "Lead Transfer"], desc: ["Pindah pemilikan lead antara sales.", "Move lead ownership between sales."], icon: ArrowLeftRight },
    { tab: "imports", label: ["Monitor Import", "Import Monitor"], desc: ["Jejak import lead dan baris gagal.", "Track lead imports and failed rows."], icon: Download },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t("Ringkasan KPI", "KPI summary")}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label[1]}
              className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
            >
              <div className="grid h-9 w-9 flex-none place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${k.tone} 14%, transparent)`, color: k.tone }}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">{t(k.label[0], k.label[1])}</p>
                <p className="m-0 mt-0.5 font-display text-[24px] font-bold leading-none">{k.value}</p>
                <p className="m-0 mt-1 text-[11.5px] text-muted-foreground">{t(k.hint[0], k.hint[1])}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Tindakan pantas", "Quick actions")}>
        <h2 className="m-0 font-display text-[15px] font-bold">{t("Tindakan Pantas", "Quick Actions")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.tab}
                type="button"
                onClick={() => onGo(q.tab)}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-raised)]"
              >
                <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="m-0 text-[13.5px] font-bold">{t(q.label[0], q.label[1])}</p>
                  <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">{t(q.desc[0], q.desc[1])}</p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <p className="m-0 text-[11.5px] text-muted-foreground">
        {t("Semua masa mengikut Asia/Kuala_Lumpur (UTC+8).", "All times are Asia/Kuala_Lumpur (UTC+8).")}
        {" · "}
        {lang === "ms" ? "Bahasa Melayu" : "English"}
      </p>
    </div>
  );
}

/** Stage rules editor: days between stages and due hour (KL). Persists via PUT /admin/stages. */
function StagesPanel({
  t,
  query,
  onSaved,
}: {
  t: TFn;
  query: AdminQuery<StageRule[]>;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<StageRule[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const rules = query.data ?? [];
  // The draft is a local working copy of the server rules; it resets when the server data changes.
  const current = draft ?? rules;

  useEffect(() => {
    setDraft(null);
  }, [JSON.stringify(rules)]);

  function patch(idx: number, partial: Partial<StageRule>) {
    setDraft((cur) => (cur ?? rules).map((r, i) => (i === idx ? { ...r, ...partial } : r)));
  }

  /** Walks the draft rules from "now" and returns each active stage's due instant. */
  const preview = useMemo(() => {
    const out: { stage: string; at: Date; label: string }[] = [];
    let cursor = new Date();
    for (const r of current) {
      if (!r.active) continue;
      cursor = new Date(cursor.getTime() + r.daysAfterPrevious * 86_400_000);
      // Snap to the due hour in KL. KL is UTC+8 with no DST, so fixed offset maths is exact.
      const kl = new Date(cursor.getTime() + 8 * 3_600_000);
      kl.setUTCHours(r.dueHourKL, 0, 0, 0);
      const at = new Date(kl.getTime() - 8 * 3_600_000);
      if (at.getTime() < cursor.getTime()) {
        // Due hour already passed today → roll to the next day.
        at.setUTCDate(at.getUTCDate() + 1);
      }
      cursor = at;
      out.push({
        stage: r.stage,
        at,
        label: new Intl.DateTimeFormat("en-MY", {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Kuala_Lumpur",
        }).format(at),
      });
    }
    return out;
  }, [current]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await followupApi.saveStages(current);
      setDraft(saved);
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const activeCount = current.filter((r) => r.active).length;
  const totalDays = current.filter((r) => r.active).reduce((s, r) => s + r.daysAfterPrevious, 0);
  const dirty = JSON.stringify(current) !== JSON.stringify(rules);

  if (query.loading) return <FollowupLoading />;
  if (query.error) return <FollowupErrorState message={query.error} onRetry={query.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="m-0 font-display text-[15px] font-bold">{t("Peraturan Peringkat Susulan", "Follow-up Stage Rules")}</h2>
        <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">
          {t(
            "Berapa hari selepas peringkat sebelumnya setiap susulan dijadualkan, dan pada jam berapa (waktu KL) ia perlu dibuat.",
            "How many days after the previous stage each follow-up is scheduled, and at what KL hour it becomes due.",
          )}
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {current.map((r, idx) => (
            <div
              key={r.stage}
              className={cn(
                "grid gap-3 rounded-xl border p-4 md:grid-cols-[100px_1fr_1fr_auto]",
                r.active ? "border-[var(--color-border)] bg-[var(--color-surface-raised)]" : "border-[var(--color-border)] opacity-60",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-[var(--color-primary-soft)] px-2 py-1 font-mono text-[12px] font-bold text-[var(--color-primary)]">{r.stage}</span>
                <span className="text-[12px] text-muted-foreground">
                  {idx === 0 ? t("Serta-merta", "Immediate") : t(`Selepas ${r.daysAfterPrevious} hari`, `After ${r.daysAfterPrevious} day(s)`)}
                </span>
              </div>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted-foreground">
                {t("Hari selepas peringkat sebelumnya", "Days after previous stage")}
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={r.daysAfterPrevious}
                  disabled={idx === 0 || !r.active}
                  onChange={(e) => patch(idx, { daysAfterPrevious: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-foreground disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted-foreground">
                {t("Jam sasaran (KL)", "Due hour (KL)")}
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={r.dueHourKL}
                  disabled={!r.active}
                  onChange={(e) => patch(idx, { dueHourKL: Math.max(0, Math.min(23, Number(e.target.value) || 0)) })}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-foreground disabled:opacity-50"
                />
              </label>
              <label className="flex items-center gap-2 text-[12px] font-semibold">
                <input
                  type="checkbox"
                  checked={r.active}
                  onChange={(e) => patch(idx, { active: e.target.checked })}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                {r.active ? t("Aktif", "Active") : t("Mati", "Off")}
              </label>
            </div>
          ))}
        </div>

        {saveError && (
          <p role="alert" className="m-0 mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-danger)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("Gagal menyimpan: ", "Failed to save: ")}
            {saveError}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning)]" />
            {t("Perubahan terpakai untuk lead baharu sahaja.", "Changes apply to new leads only.")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => setDraft(null)}
              className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("Set Semula", "Reset")}
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? t("Menyimpan…", "Saving…") : t("Simpan Peraturan", "Save Rules")}
            </button>
          </div>
        </div>
      </section>

      {/* Timeline preview: shows the concrete KL dates a new lead would hit. */}
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5" aria-label={t("Pratonton garis masa", "Timeline preview")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 font-display text-[15px] font-bold">{t("Pratonton Garis Masa", "Timeline Preview")}</h2>
          <span className="rounded-full bg-[var(--color-surface-raised)] px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
            {t(`${activeCount} peringkat · ${totalDays} hari`, `${activeCount} stages · ${totalDays} days`)}
          </span>
        </div>
        <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">
          {t("Jika lead baharu masuk sekarang, susulan akan dijadualkan seperti berikut:", "If a new lead arrives now, follow-ups are scheduled as follows:")}
        </p>

        <ol className="relative m-0 mt-4 flex list-none flex-col gap-0 p-0">
          {preview.map((p, i) => (
            <li key={p.stage} className="relative flex gap-3 pb-4 last:pb-0">
              {i < preview.length - 1 && <span className="absolute left-[9px] top-5 h-full w-px bg-[var(--color-border)]" aria-hidden="true" />}
              <span className="relative z-10 mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-[var(--color-primary-foreground)]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12px] font-bold text-[var(--color-primary)]">{p.stage}</span>
                  <span className="text-[13px] font-semibold">{p.label}</span>
                </div>
                <p className="m-0 text-[11.5px] text-muted-foreground">
                  {i === 0
                    ? t("Sebaik lead diimport", "As soon as the lead is imported")
                    : t(`+${current.filter((r) => r.active)[i]?.daysAfterPrevious ?? 0} hari selepas peringkat sebelumnya`, `+${current.filter((r) => r.active)[i]?.daysAfterPrevious ?? 0} days after the previous stage`)}
                </p>
              </div>
            </li>
          ))}
          {preview.length === 0 && (
            <li className="text-[12.5px] text-muted-foreground">{t("Tiada peringkat aktif.", "No active stages.")}</li>
          )}
        </ol>
        <p className="m-0 mt-3 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          {t("Semua masa dalam Asia/Kuala_Lumpur (UTC+8).", "All times in Asia/Kuala_Lumpur (UTC+8).")}
        </p>
      </section>
    </div>
  );
}

/** Users & roles: list accounts, change role, toggle active. Persists via PATCH /admin/users/:id. */
function UsersPanel({
  t,
  query,
}: {
  t: TFn;
  query: AdminQuery<AdminUser[]>;
}) {
    const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminUser["role"]>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const users = query.data ?? [];

  const ROLE_LABEL: Record<AdminUser["role"], [string, string]> = {
    super_admin: ["Super Admin", "Super Admin"],
    management: ["Management", "Management"],
    sales: ["Sales", "Sales"],
    finance: ["Finance", "Finance"],
    operations: ["Operations", "Operations"],
  };
  const ROLE_ORDER: AdminUser["role"][] = ["super_admin", "management", "sales"];

  const activeSuperAdmins = users.filter((u) => u.role === "super_admin" && u.active).length;

  async function patchUser(id: string, partial: { role?: AdminUser["role"]; active?: boolean }) {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    // Never allow demoting or deactivating the last active super admin (also enforced server-side → 409).
    if (target.role === "super_admin" && target.active && activeSuperAdmins <= 1) {
      const losesAdmin = (partial.role !== undefined && partial.role !== "super_admin") || partial.active === false;
      if (losesAdmin) return;
    }
    setSavingId(id);
    setSaveError(null);
    try {
      await followupApi.updateUser(id, partial);
      await query.refetch();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingId(null);
    }
  }

  const q = search.trim().toLowerCase();
  const visible = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const counts = ROLE_ORDER.map((r) => ({ role: r, n: users.filter((u) => u.role === r).length }));

  if (query.loading) return <FollowupLoading />;
  if (query.error) return <FollowupErrorState message={query.error} onRetry={query.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 font-display text-[15px] font-bold">{t("Akaun Pengguna", "User Accounts")}</h2>
          <p className="m-0 text-[12px] text-muted-foreground">
            {t(`${users.length} akaun · ${users.filter((u) => u.active).length} aktif`, `${users.length} accounts · ${users.filter((u) => u.active).length} active`)}
          </p>
        </div>

        {/* Role summary chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {counts.map((c) => (
            <button
              key={c.role}
              type="button"
              onClick={() => setRoleFilter(roleFilter === c.role ? "all" : c.role)}
              aria-pressed={roleFilter === c.role}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                roleFilter === c.role
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface-raised)] text-muted-foreground hover:text-foreground",
              )}
            >
              {t(ROLE_LABEL[c.role][0], ROLE_LABEL[c.role][1])} · {c.n}
            </button>
          ))}
        </div>

        {/* Search */}
        <label className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2">
          <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Cari nama atau emel…", "Search name or email…")}
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            aria-label={t("Cari pengguna", "Search users")}
          />
        </label>

        {saveError && (
          <p role="alert" className="m-0 mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-danger)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {saveError}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {visible.map((u) => {
            const isLastSuper = u.role === "super_admin" && u.active && activeSuperAdmins <= 1;
            const busy = savingId === u.id;
            return (
              <div
                key={u.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-xl border p-3",
                  u.active ? "border-[var(--color-border)] bg-[var(--color-surface-raised)]" : "border-[var(--color-border)] opacity-60",
                )}
              >
                <div className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--color-primary-soft)] text-[13px] font-bold text-[var(--color-primary)]">
                  {u.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="m-0 flex items-center gap-1.5 truncate text-[13.5px] font-bold">
                    {u.name}
                    {isLastSuper && (
                      <span className="rounded bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-warning)]">
                        {t("Admin terakhir", "Last admin")}
                      </span>
                    )}
                  </p>
                  <p className="m-0 truncate text-[11.5px] text-muted-foreground">{u.email}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    u.role === "super_admin" && "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
                    u.role === "management" && "bg-[var(--color-info-soft)] text-[var(--color-info)]",
                    u.role === "sales" && "bg-[var(--color-success-soft)] text-[var(--color-success)]",
                  )}
                >
                  {t(ROLE_LABEL[u.role][0], ROLE_LABEL[u.role][1])}
                </span>
                <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {t(`${u.openLeads} lead`, `${u.openLeads} leads`)}
                </span>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label={t("Menyimpan", "Saving")} />
                ) : (
                  <select
                    value={u.role}
                    disabled={!u.active || isLastSuper}
                    onChange={(e) => patchUser(u.id, { role: e.target.value as AdminUser["role"] })}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12px] font-semibold text-foreground disabled:opacity-50"
                    aria-label={t("Peranan", "Role")}
                  >
                    <option value="sales">Sales</option>
                    <option value="management">Management</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                )}
                <label className="flex items-center gap-1.5 text-[11.5px] font-semibold">
                  <input
                    type="checkbox"
                    checked={u.active}
                    disabled={isLastSuper || busy}
                    onChange={(e) => patchUser(u.id, { active: e.target.checked })}
                    className="h-4 w-4 accent-[var(--color-primary)] disabled:opacity-50"
                  />
                  {u.active ? t("Aktif", "Active") : t("Mati", "Off")}
                </label>
              </div>
            );
          })}
          {visible.length === 0 && (
            <FollowupEmptyState
              icon={UserCog}
              compact
              title={t("Tiada pengguna sepadan.", "No matching users.")}
              description={users.length === 0 ? t("Akaun staff akan muncul di sini.", "Staff accounts will appear here.") : undefined}
            />
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Lead transfer: move the open leads of one sales rep to another.
 * The backend transfer endpoint is per-lead (POST /leads/:id/transfer), so
 * this panel lists the source rep's leads and transfers them one by one,
 * reporting progress and per-lead failures.
 */
function TransferPanel({
  t,
  users,
  loading,
  onDone,
}: {
  t: TFn;
  users: AdminUser[];
  loading: boolean;
  onDone: (msg: string) => Promise<void>;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ moved: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fromUser = users.find((u) => u.id === from) ?? null;
  const toUser = users.find((u) => u.id === to) ?? null;
  const sameUser = !!fromUser && fromUser.id === toUser?.id;
  const canTransfer = !!fromUser && !!toUser && !sameUser && fromUser.openLeads > 0 && !busy;

  async function runTransfer() {
    if (!fromUser || !toUser) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setConfirming(false);
    try {
      // Fetch the source rep's leads (transfer is per-lead on the server).
      const res = await followupApi.leads({ owner: fromUser.id, limit: 200 });
      const leadIds = res.data.map((l) => l.id);
      setProgress({ done: 0, total: leadIds.length });
      let moved = 0;
      let failed = 0;
      for (const id of leadIds) {
        try {
          await followupApi.transfer(id, { ownerUserId: toUser.id, reason: reason.trim() || undefined });
          moved++;
        } catch {
          failed++;
        }
        setProgress({ done: moved + failed, total: leadIds.length });
      }
      setResult({ moved, failed });
      await onDone(
        failed === 0
          ? t(`${moved} lead dipindahkan kepada ${toUser.name}.`, `${moved} leads transferred to ${toUser.name}.`)
          : t(`${moved} lead dipindahkan, ${failed} gagal.`, `${moved} leads transferred, ${failed} failed.`),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="m-0 font-display text-[15px] font-bold">{t("Pindah Pemilikan Lead", "Transfer Lead Ownership")}</h2>
        <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">
          {t(
            "Pindahkan semua lead terbuka milik seorang sales kepada sales lain. Rekod jejak audit akan disimpan.",
            "Move all open leads owned by one sales rep to another. An audit trail record is kept.",
          )}
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted-foreground">
            {t("Dari (pemilik semasa)", "From (current owner)")}
            <select
              value={from}
              disabled={busy}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-foreground disabled:opacity-50"
            >
              <option value="">{loading ? t("Memuatkan…", "Loading…") : t("Pilih sales…", "Select sales…")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.openLeads})
                </option>
              ))}
            </select>
          </label>

          <div className="hidden items-end pb-2 text-muted-foreground md:flex">
            <ArrowLeftRight className="h-5 w-5" />
          </div>

          <label className="flex flex-col gap-1 text-[12px] font-semibold text-muted-foreground">
            {t("Kepada (pemilik baharu)", "To (new owner)")}
            <select
              value={to}
              disabled={busy}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-foreground disabled:opacity-50"
            >
              <option value="">{t("Pilih sales…", "Select sales…")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.openLeads})
                </option>
              ))}
            </select>
          </label>
        </div>

        {sameUser && (
          <p className="m-0 mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-danger)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("Pemilik baharu mesti berbeza daripada pemilik semasa.", "The new owner must differ from the current owner.")}
          </p>
        )}
        {fromUser && fromUser.openLeads === 0 && (
          <p className="m-0 mt-3 flex items-center gap-1.5 text-[12px] text-[var(--color-warning)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t("Sales ini tiada lead terbuka untuk dipindahkan.", "This sales rep has no open leads to transfer.")}
          </p>
        )}

        <label className="mt-4 flex flex-col gap-1 text-[12px] font-semibold text-muted-foreground">
          {t("Sebab pemindahan", "Transfer reason")}
          <textarea
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t("cth. Sales bertukar wilayah, penstrukturan semula…", "e.g. Sales changed region, restructuring…")}
            className="resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-foreground disabled:opacity-50"
          />
        </label>

        {progress && (
          <p role="status" className="m-0 mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t(`Memindahkan ${progress.done}/${progress.total}…`, `Transferring ${progress.done}/${progress.total}…`)}
          </p>
        )}
        {result && (
          <p role="status" className="m-0 mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-success)]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t(`${result.moved} berjaya, ${result.failed} gagal.`, `${result.moved} succeeded, ${result.failed} failed.`)}
          </p>
        )}
        {error && (
          <p role="alert" className="m-0 mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-danger)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-[12px] text-muted-foreground">
            {fromUser && toUser && !sameUser
              ? t(
                  `${fromUser.openLeads} lead akan dipindahkan daripada ${fromUser.name} kepada ${toUser.name}.`,
                  `${fromUser.openLeads} leads will be moved from ${fromUser.name} to ${toUser.name}.`,
                )
              : t("Pilih pemilik semasa dan pemilik baharu untuk teruskan.", "Pick a current owner and a new owner to continue.")}
          </p>
          <button
            type="button"
            disabled={!canTransfer}
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {t("Pindahkan Lead", "Transfer Leads")}
          </button>
        </div>
      </section>

      {/* Confirmation dialog */}
      {confirming && fromUser && toUser && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="transfer-confirm-title">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 id="transfer-confirm-title" className="m-0 font-display text-[15px] font-bold">
                  {t("Sahkan Pemindahan Lead", "Confirm Lead Transfer")}
                </h3>
                <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  {t(
                    `${fromUser.openLeads} lead terbuka akan dipindahkan daripada ${fromUser.name} kepada ${toUser.name}. Tindakan ini direkodkan dalam jejak audit.`,
                    `${fromUser.openLeads} open leads will be moved from ${fromUser.name} to ${toUser.name}. This action is recorded in the audit trail.`,
                  )}
                </p>
              </div>
            </div>
            {reason.trim() && (
              <p className="m-0 mt-3 rounded-lg bg-[var(--color-surface-raised)] px-3 py-2 text-[12px] text-muted-foreground">
                <span className="font-semibold text-foreground">{t("Sebab:", "Reason:")}</span> {reason.trim()}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
              >
                {t("Batal", "Cancel")}
              </button>
              <button
                type="button"
                autoFocus
                disabled={busy}
                onClick={runTransfer}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {t("Ya, Pindahkan", "Yes, Transfer")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ImportStatus = ReturnType<typeof importBatchStatus>;

/** Import monitor: batch list with imported/failed counts, status badges and expandable failed rows. */
function ImportsPanel({ t, query }: { t: TFn; query: AdminQuery<AdminImportBatch[]> }) {
  const [statusFilter, setStatusFilter] = useState<"all" | ImportStatus>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const STATUS_LABEL: Record<ImportStatus, [string, string]> = {
    done: ["Selesai", "Done"],
    partial: ["Sebahagian", "Partial"],
    failed: ["Gagal", "Failed"],
  };
  const STATUS_ORDER: ImportStatus[] = ["done", "partial", "failed"];

  const all = query.data ?? [];
  const batches = [...all]
    .filter((b) => statusFilter === "all" || importBatchStatus(b) === statusFilter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (query.loading) return <FollowupLoading />;
  if (query.error) return <FollowupErrorState message={query.error} onRetry={query.refetch} />;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="m-0 font-display text-[15px] font-bold">{t("Sejarah Import Lead", "Lead Import History")}</h2>
        <p className="m-0 mt-1 text-[12.5px] text-muted-foreground">
          {t("Setiap import fail CSV/Excel direkodkan dengan kiraan berjaya dan gagal.", "Each CSV/Excel file import is recorded with success and failure counts.")}
        </p>

        {/* Status filter chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
              statusFilter === "all"
                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-raised)] text-muted-foreground hover:text-foreground",
            )}
          >
            {t("Semua", "All")} · {all.length}
          </button>
          {STATUS_ORDER.map((s) => {
            const n = all.filter((b) => importBatchStatus(b) === s).length;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                  statusFilter === s
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-raised)] text-muted-foreground hover:text-foreground",
                )}
              >
                {t(STATUS_LABEL[s][0], STATUS_LABEL[s][1])} · {n}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {batches.map((b) => {
            const isOpen = expanded.has(b.id);
            const status = importBatchStatus(b);
            const canExpand = b.errors.length > 0;
            return (
              <div key={b.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <div className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-[var(--color-surface)] text-muted-foreground">
                    <FileSpreadsheet className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13.5px] font-bold">{b.fileName}</p>
                    <p className="m-0 text-[11.5px] text-muted-foreground">
                      {t(`Oleh ${b.createdByName}`, `By ${b.createdByName}`)} · {formatKlDateTime(b.createdAt)}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface)]">
                        <div
                          className={cn("h-full rounded-full", status === "failed" ? "bg-[var(--color-danger)]" : "bg-[var(--color-success)]")}
                          style={{ width: `${b.totalRows ? Math.round((b.insertedRows / b.totalRows) * 100) : 0}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {b.insertedRows}/{b.totalRows}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      status === "done" && "bg-[var(--color-success-soft)] text-[var(--color-success)]",
                      status === "partial" && "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
                      status === "failed" && "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
                    )}
                  >
                    {t(STATUS_LABEL[status][0], STATUS_LABEL[status][1])}
                  </span>
                  {b.failedRows > 0 && (
                    <span className="rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-danger)]">
                      {t(`${b.failedRows} gagal`, `${b.failedRows} failed`)}
                    </span>
                  )}
                  {b.duplicateRows > 0 && (
                    <span className="rounded-full bg-[var(--color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-warning)]">
                      {t(`${b.duplicateRows} pendua`, `${b.duplicateRows} duplicates`)}
                    </span>
                  )}
                  {canExpand && (
                    <button
                      type="button"
                      onClick={() => toggle(b.id)}
                      aria-expanded={isOpen}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11.5px] font-semibold hover:bg-[var(--color-surface)]"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                      {isOpen ? t("Tutup butiran", "Hide details") : t("Lihat butiran", "View details")}
                    </button>
                  )}
                </div>

                {isOpen && canExpand && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <p className="m-0 mb-2 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">
                      {t("Baris ditolak", "Rejected rows")}
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                      <table className="w-full text-left text-[12px]">
                        <thead className="bg-[var(--color-surface-raised)] text-[11px] uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-semibold">{t("Baris", "Row")}</th>
                            <th className="px-3 py-2 font-semibold">{t("Nama", "Name")}</th>
                            <th className="px-3 py-2 font-semibold">{t("Telefon", "Phone")}</th>
                            <th className="px-3 py-2 font-semibold">{t("Sebab", "Reason")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.errors.map((e) => {
                            const rawName = typeof e.raw?.name === "string" ? e.raw.name : "";
                            const rawPhone = typeof e.raw?.phone === "string" ? e.raw.phone : "";
                            return (
                            <tr key={e.id} className="border-t border-[var(--color-border)] align-top">
                              <td className="px-3 py-2 font-mono text-[11.5px]">{e.rowNumber}</td>
                              <td className="max-w-[180px] truncate px-3 py-2 text-[11.5px] text-muted-foreground" title={rawName}>
                                {rawName || <em>{t("(kosong)", "(empty)")}</em>}
                              </td>
                              <td className="max-w-[160px] truncate px-3 py-2 font-mono text-[11.5px] text-muted-foreground" title={rawPhone}>
                                {rawPhone || <em>{t("(kosong)", "(empty)")}</em>}
                              </td>
                              <td className="px-3 py-2 text-[11.5px]">{translateReason(e.reason, t)}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {batches.length === 0 && (
            <FollowupEmptyState
              icon={FileSpreadsheet}
              compact
              title={all.length === 0 ? t("Tiada import lagi.", "No imports yet.") : t("Tiada import untuk penapis ini.", "No imports for this filter.")}
              description={all.length === 0 ? t("Sejarah import akan muncul setelah fail lead diimport.", "Import history will appear once a lead file is imported.") : undefined}
            />
          )}
        </div>

        <p className="m-0 mt-4 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          {t("Butiran baris gagal dipaparkan per import. Klik 'Lihat butiran' untuk butiran lengkap.", "Failed-row details are shown per import. Click 'View details' for the full breakdown.")}
        </p>
      </section>
    </div>
  );
}

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Crown,
  ExternalLink,
  Play,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import {
  followupApi,
  type FollowupLead,
  type FollowupStage,
} from "@/lib/followup-api";
import { useFuReport, useLeadList, useTemplates } from "@/lib/useFollowup";
import {
  FollowupEmptyState,
  FollowupErrorState,
  FollowupLoading,
} from "@/components/FollowupStates";
import { stageTone } from "@/components/FollowupTaskRow";
import { fillTemplate, waMeUrl } from "@/components/TemplatePickerDialog";
import { flattenTemplateGroups, type WaTemplate } from "@/pages/WhatsAppTemplates";

/**
 * Mesin Follow-Up — the three-stage FU1/FU2/FU3 scheduler.
 *
 * Mirrors the DesainPakeAI prototype (mesin-follow-up.page.jsx): three stage
 * cards, a lead list split into Active / Paused / Escalation / Responded tabs,
 * an escalation queue, and a manual-confirm dialog. Every action goes through
 * the real /api/followup/* endpoints; nothing sends a message automatically.
 */

type EngineTab = "active" | "paused" | "escalated" | "responded";

/** Maps a lead's followup state + status to the engine tab it belongs to. */
function engineStateOf(lead: FollowupLead): EngineTab {
  if (lead.followupState === "paused") return "paused";
  if (lead.followupState === "escalated") return "escalated";
  if (lead.followupState === "done" || lead.followupStatus === "responded" || lead.followupStatus === "won" || lead.followupStatus === "lost")
    return "responded";
  return "active";
}

function stageLabel(stage: FollowupStage): string {
  return stage;
}

/** Sort leads by next follow-up time ascending; nulls go last. */
function byNextFollowup(a: FollowupLead, b: FollowupLead): number {
  const ta = a.nextFollowupAt ? new Date(a.nextFollowupAt).getTime() : Number.POSITIVE_INFINITY;
  const tb = b.nextFollowupAt ? new Date(b.nextFollowupAt).getTime() : Number.POSITIVE_INFINITY;
  return ta - tb;
}

function formatNext(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
    hour12: false,
  }).format(d);
}

/** A generic card shell shared by both columns. */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
      <h2 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">{title}</h2>
      {aside}
    </div>
  );
}

export default function FollowUpEngine() {
  const { t, lang } = useLang();
  const [activeTab, setActiveTab] = useState<EngineTab>("active");
  const [fuFilter, setFuFilter] = useState<"all" | FollowupStage>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [notice, setNotice] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const session = getSession();
  const templatesQuery = useTemplates();
  const templates = useMemo(() => flattenTemplateGroups(templatesQuery.data ?? []), [templatesQuery.data]);
  const reportQuery = useFuReport();

  const list = useLeadList({}, 500);
  const leads = useMemo(() => list.data?.data ?? [], [list.data]);

  const counts = useMemo(
    () => ({
      active: leads.filter((l) => engineStateOf(l) === "active").length,
      paused: leads.filter((l) => engineStateOf(l) === "paused").length,
      escalated: leads.filter((l) => engineStateOf(l) === "escalated").length,
      responded: leads.filter((l) => engineStateOf(l) === "responded").length,
    }),
    [leads],
  );

  interface StaffFuCount { userId: string; name: string; fu1: number; fu2: number; fu3: number; }
  // FU1/FU2/FU3 = follow-ups COMPLETED (confirmed WhatsApp actions), not
  // leads waiting at a stage — each number is work the staff has done.
  // Sales only ever see their own numbers (the backend already scopes the
  // rows; this also hides other staff from the UI entirely).
  const isAdmin = session?.role === "super_admin" || session?.role === "management";
  const report = useMemo<StaffFuCount[]>(() => {
    const map = new Map<string, StaffFuCount>();
    const myId = session?.userId;
    for (const row of reportQuery.data ?? []) {
      if (!isAdmin && row.userId !== myId) continue; // sales: own data only
      const e = map.get(row.userId) ?? { userId: row.userId, name: row.name, fu1: 0, fu2: 0, fu3: 0 };
      if (row.stage === "FU1") e.fu1 += row.count;
      else if (row.stage === "FU2") e.fu2 += row.count;
      else if (row.stage === "FU3") e.fu3 += row.count;
      map.set(row.userId, e);
    }
    return [...map.values()].sort(
      (a, b) => (b.fu1 + b.fu2 + b.fu3) - (a.fu1 + a.fu2 + a.fu3),
    );
  }, [reportQuery.data, isAdmin, session?.userId]);

  const visible = useMemo(
    () =>
      leads
        .filter((l) => engineStateOf(l) === activeTab)
        .filter((l) => fuFilter === "all" || (l.followupStage ?? "FU1") === fuFilter)
        .filter((l) => {
          if (!dateFrom && !dateTo) return true;
          const t = l.nextFollowupAt ? new Date(l.nextFollowupAt).getTime() : NaN;
          if (Number.isNaN(t)) return false;
          const fromMs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : Number.NEGATIVE_INFINITY;
          const toMs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Number.POSITIVE_INFINITY;
          return t >= fromMs && t <= toMs;
        })
        .sort(byNextFollowup),
    [leads, activeTab, fuFilter, dateFrom, dateTo],
  );

  const escalated = useMemo(
    () => leads.filter((l) => engineStateOf(l) === "escalated").sort(byNextFollowup),
    [leads],
  );

  async function refresh() {
    await list.refetch();
    setNotice(t("Jadual dikira semula daripada status lead (waktu Malaysia).", "Schedule updated from the lead status (Malaysia time)."));
  }

  async function advanceStage(lead: FollowupLead) {
    setSubmitting(true);
    setNotice("");
    try {
      const stage = lead.followupStage ?? "FU1";
      await followupApi.complete(lead.id, { stage });
      setNotice(
        stage === "FU3"
          ? t(`${lead.name}: FU3 selesai — dinaikkan untuk semakan admin.`, `${lead.name}: FU3 done — escalated for admin review.`)
          : t(`${lead.name}: ${stage} selesai. Peringkat seterusnya dijadualkan.`, `${lead.name}: ${stage} done. Next stage scheduled.`),
      );
      await list.refetch();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  /** Pick the default WhatsApp template for a lead: prefer an active template
   * matching the lead's follow-up stage, else the first active template. */
  function defaultTemplateFor(lead: FollowupLead): WaTemplate | null {
    const active = templates.filter((x) => x.active);
    if (active.length === 0) return null;
    const stage = lead.followupStage;
    const byStage = active.filter((x) => x.stage === stage && x.locale === lang);
    if (byStage.length > 0) return byStage[0];
    const byStageAnyLocale = active.filter((x) => x.stage === stage);
    if (byStageAnyLocale.length > 0) return byStageAnyLocale[0];
    const byLocale = active.filter((x) => x.locale === lang);
    return (byLocale[0] ?? active[0]);
  }

  /** One click: open WhatsApp with the default filled message, then
   * auto-advance the follow-up stage. */
  function openWhatsApp(lead: FollowupLead) {
    const tpl = defaultTemplateFor(lead);
    if (!tpl) {
      setNotice(t("Tiada templat WhatsApp aktif.", "No active WhatsApp template."));
      return;
    }
    const message = fillTemplate(tpl.body, {
      leadName: lead.name,
      packageName: lead.destination ?? "",
      date: lead.nextFollowupAt
        ? new Date(lead.nextFollowupAt).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" })
        : "",
      salesName: session?.name ?? "",
    });
    const url = waMeUrl(lead.phone, message);
    if (!url) {
      setNotice(t(`Nombor telefon tidak sah untuk ${lead.name}.`, `Invalid phone number for ${lead.name}.`));
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    void advanceStage(lead);
  }

  async function returnToFu1(lead: FollowupLead) {
    setSubmitting(true);
    setNotice("");
    try {
      await followupApi.review(lead.id, { outcome: "handover", note: t("Dikembalikan ke urutan FU1", "Returned to the FU1 sequence") });
      setNotice(t(`${lead.name}: lead dinaikkan dikembalikan ke urutan FU1.`, `${lead.name}: escalated lead returned to the FU1 sequence.`));
      await list.refetch();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const TABS: { id: EngineTab; label: string }[] = [
    { id: "active", label: t("Aktif", "Active") },
    { id: "paused", label: t("Dijeda", "Paused") },
    { id: "escalated", label: t("Eskalasi", "Escalation") },
    { id: "responded", label: t("Dijawab", "Responded") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight text-[var(--color-text)]">
            {t("Mesin Follow-Up", "Follow-Up Engine")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t(
              "Tiga peringkat susulan FU1–FU3. Tekan butang untuk buka WhatsApp dan susulan akan bergerak ke peringkat seterusnya.",
              "Three follow-up stages: FU1–FU3. Tap the button to open WhatsApp and the follow-up moves to the next stage.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {t("Kira semula jadual", "Recompute schedules")}
        </button>
      </header>

      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-info-soft)] px-4 py-2.5 text-[13px] text-[var(--color-info)]">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" aria-label={t("Tutup notis", "Dismiss")} onClick={() => setNotice("")} className="grid place-items-center border-0 bg-transparent text-inherit">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Three-stage flow + completed counts, combined into one row of cards */}
      <div data-tour="engine-stages" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { num: 1, stage: "FU1" as const, title: t("FU1 — kenalan pertama", "FU1 — first contact"), desc: t("Dijadualkan automatik apabila lead masuk.", "Scheduled automatically when a lead comes in.") },
          { num: 2, stage: "FU2" as const, title: t("FU2 — peringatan kedua", "FU2 — second reminder"), desc: t("Dijadualkan selepas FU1 selesai tanpa jawapan.", "Scheduled after FU1 is done with no reply.") },
          { num: 3, stage: "FU3" as const, title: t("FU3 — eskalasi", "FU3 — escalation"), desc: t("Tiada jawapan selepas FU3 bermakna lead perlu semakan admin.", "No reply after FU3 means the lead needs an admin review.") },
        ].map((step) => {
          const stage = step.stage;
          const done = report.reduce((s, r) => s + (stage === "FU1" ? r.fu1 : stage === "FU2" ? r.fu2 : r.fu3), 0);
          return (
            <div key={step.num} className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[12px] font-bold text-[var(--color-primary)]">
                  {step.num}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--color-primary)]" title={t("Susulan disahkan", "Follow-ups completed")}>
                  {done}
                </span>
              </div>
              <strong className="text-[14px] font-semibold text-[var(--color-text)]">{step.title}</strong>
              <p className="m-0 text-[12.5px] leading-relaxed text-muted-foreground">{step.desc}</p>
              {isAdmin && report.length > 0 && done > 0 && (
                <ul className="m-0 mt-1 flex list-none flex-col gap-1 border-t border-[var(--color-border)] pt-2">
                  {report.map((r) => {
                    const n = stage === "FU1" ? r.fu1 : stage === "FU2" ? r.fu2 : r.fu3;
                    if (n === 0) return null;
                    return (
                      <li key={r.userId} className="flex items-center justify-between text-[12px]">
                        <span className="truncate text-[var(--color-text-secondary)]">{r.name}</span>
                        <span className="font-semibold tabular-nums text-[var(--color-text)]">{n}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card>
          <CardHead
            title={t("Enjin follow-up lead", "Lead follow-up engine")}
            aside={
              <div className="inline-flex flex-wrap gap-1 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-1" role="tablist" aria-label={t("Keadaan enjin follow-up", "Follow-up engine states")}>
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-medium",
                      activeTab === tab.id
                        ? "bg-[var(--color-surface)] font-semibold text-[var(--color-text)] shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label} ({counts[tab.id]})
                  </button>
                ))}
              </div>
            }
          />

          {/* Filter bar — FU stage + date range */}
          <div className="flex flex-wrap items-end gap-2 border-b border-[var(--color-border)] px-4 py-3">
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
              {t("Peringkat FU", "FU stage")}
              <select
                value={fuFilter}
                onChange={(e) => setFuFilter(e.target.value as "all" | FollowupStage)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12.5px] text-foreground"
              >
                <option value="all">{t("Semua peringkat", "All stages")}</option>
                <option value="FU1">FU1</option>
                <option value="FU2">FU2</option>
                <option value="FU3">FU3</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
              {t("Dari", "From")}
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12.5px] text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-muted-foreground">
              {t("Hingga", "To")}
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12.5px] text-foreground"
              />
            </label>
            {(fuFilter !== "all" || dateFrom !== "" || dateTo !== "") && (
              <button
                type="button"
                onClick={() => { setFuFilter("all"); setDateFrom(""); setDateTo(""); }}
                className="ml-auto rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
              >
                {t("Kosongkan penapis", "Clear filters")}
              </button>
            )}
          </div>

          {list.loading ? (
            <FollowupLoading />
          ) : list.status === "error" ? (
            <FollowupErrorState message={list.error ?? ""} onRetry={() => void list.refetch()} />
          ) : visible.length === 0 ? (
            <FollowupEmptyState
              compact
              icon={CheckCircle2}
              title={fuFilter !== "all" || dateFrom !== "" || dateTo !== "" ? t("Tiada lead padan penapis ini", "No leads match these filters") : t("Tiada lead dalam keadaan ini", "No leads in this state")}
              description={
                fuFilter !== "all" || dateFrom !== "" || dateTo !== ""
                  ? t("Tukar peringkat FU atau julat tarikh.", "Change the FU stage or the date range.")
                  : t("Lead akan muncul di sini apabila statusnya berubah.", "Leads will appear here as their status changes.")
              }
            />
          ) : (
            <div role="tabpanel">
              {visible.map((lead) => {
                const stage = lead.followupStage ?? "FU1";
                const tone = stageTone(stage);
                const state = engineStateOf(lead);
                const isTop = activeTab === "active" && visible[0]?.id === lead.id;
                return (
                  <div
                    key={lead.id}
                    data-tour={visible[0]?.id === lead.id ? "engine-lead-action" : undefined}
                    className={cn(
                      "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-[var(--color-border)] px-4 py-3 first:border-t-0",
                      isTop && "bg-[var(--color-primary-soft)]",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {isTop && <Crown className="h-3.5 w-3.5 text-[var(--color-primary)]" />}
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.02em]" style={{ background: tone.bg, color: tone.fg }}>
                        {stageLabel(stage)}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <strong className="truncate text-[13.5px] font-semibold text-[var(--color-text)]">{lead.name}</strong>
                      <span className="truncate text-[12px] text-[var(--color-text-secondary)]">{lead.destination ?? "—"}</span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {state === "responded"
                          ? t("Dijawab · urutan dihentikan", "Responded · sequence stopped")
                          : state === "escalated"
                            ? t("Dinaikkan · tiada respons selepas FU3", "Escalated · no response after FU3")
                            : state === "paused"
                              ? t("Dijeda", "Paused")
                              : t(`Seterusnya: ${formatNext(lead.nextFollowupAt)} (MYT)`, `Next: ${formatNext(lead.nextFollowupAt)} (MYT)`)}
                      </span>
                    </span>
                    <span className="flex flex-wrap justify-end gap-1.5">
                      {state === "active" && (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => openWhatsApp(lead)}
                          className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#25D366] px-2.5 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("Follow up", "Follow up")}
                        </button>
                      )}
                      {state === "paused" && (
                        <button type="button" disabled={submitting} onClick={() => void followupApi.complete(lead.id, { stage }).then(() => list.refetch())} className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50">
                          <Play className="h-3 w-3" />
                          {t("Sambung", "Resume")}
                        </button>
                      )}
                      {state === "escalated" && (
                        <>
                          <span className="text-[12px] font-semibold text-[var(--color-danger)]">{t("Perlu semakan", "Needs review")}</span>
                          <button type="button" disabled={submitting} onClick={() => void returnToFu1(lead)} className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50">
                            <RotateCcw className="h-3 w-3" />
                            {t("Kembali ke FU1", "Return to FU1")}
                          </button>
                        </>
                      )}
                      {state === "responded" && (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-success)]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("Dijawab", "Responded")}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHead
            title={t("Antrean eskalasi", "Escalation queue")}
            aside={
              <span className="inline-flex items-center rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-danger)]">
                {counts.escalated}
              </span>
            }
          />
          <div className="flex flex-col">
            {escalated.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="m-0 text-[13px] text-muted-foreground">
                  {t("Tiada lead menunggu semakan admin.", "No leads awaiting admin review.")}
                </p>
              </div>
            ) : (
              escalated.map((lead) => (
                <div key={lead.id} className="border-t border-[var(--color-border)] px-5 py-3 first:border-t-0">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[13.5px] font-semibold text-[var(--color-text)]">{lead.name}</strong>
                  </div>
                  <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
                    {t("Tiada jawapan selepas tiga kali cubaan. Semak lead ini atau hantar balik ke urutan.", "No reply after three tries. Check this lead or send it back to the sequence.")}
                  </p>
                  <button type="button" disabled={submitting} onClick={() => void returnToFu1(lead)} className="mt-2 inline-flex items-center gap-1 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50">
                    <RotateCcw className="h-3 w-3" />
                    {t("Kembali ke FU1", "Return to FU1")}
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

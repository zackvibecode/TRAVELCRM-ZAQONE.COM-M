import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  PauseCircle,
  ListChecks,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { crmAccessRole } from "@/pages/LeadManagement";
import TemplatePickerDialog from "@/components/TemplatePickerDialog";
import { flattenTemplateGroups } from "@/pages/WhatsAppTemplates";
import FollowupTaskRow, {
  klStartOfTodayMs,
  needsReview,
  type FollowupStage,
  type FollowupHistoryIcon,
} from "@/components/FollowupTaskRow";
import OverdueQueuePanel from "@/components/OverdueQueuePanel";
import LeadHistoryNotesPanel from "@/components/LeadHistoryNotesPanel";
import FollowupSchedulePanel from "@/components/FollowupSchedulePanel";
import { followupApi, type FollowupLead as ApiLead, type TimelineEntry } from "@/lib/followup-api";
import { useFollowupQueue, useTemplates } from "@/lib/useFollowup";
import {
  FollowupEmptyState,
  FollowupErrorState,
  FollowupLoading,
} from "@/components/FollowupStates";

/** Lead shape the Follow-Up Center components consume. */
interface CenterLead {
  id: string;
  name: string;
  phone: string;
  packageName: string;
  stage: FollowupStage;
  /** ISO datetime of the scheduled follow-up (Asia/Kuala_Lumpur day). */
  scheduledAt: string;
  owner: string;
  notes: string;
  paused: boolean;
  history: { icon: FollowupHistoryIcon; text: string; time: string }[];
}

const EMPTY_HISTORY: CenterLead["history"] = [];

/** Maps an API timeline entry type to a row/panel icon. */
function historyIcon(type: string): FollowupHistoryIcon {
  switch (type) {
    case "note":
      return "note";
    case "pause":
      return "pause";
    case "resume":
      return "resume";
    case "stage_change":
    case "transfer":
    case "review":
      return "stage_change";
    case "phone":
      return "phone";
    default:
      return "whatsapp";
  }
}

type Translate = (ms: string, en: string) => string;

/** Relative time label (KL) for a history entry. */
function relativeTime(iso: string, t: Translate): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.round(ms / 60_000);
  if (min < 1) return t("Baru sekarang", "Just now");
  if (min < 60) return t(`${min} min lalu`, `${min} min ago`);
  const hrs = Math.round(min / 60);
  if (hrs < 24) return t(`${hrs} jam lalu`, `${hrs}h ago`);
  const days = Math.round(hrs / 24);
  return t(`${days} hari lalu`, `${days}d ago`);
}

/** Converts an API lead row + its history into the component shape. */
function toCenterLead(lead: ApiLead, history: TimelineEntry[], ownerName: string, t: Translate): CenterLead {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    packageName: lead.destination ?? "",
    stage: (lead.followupStage as FollowupStage) ?? "FU1",
    scheduledAt: lead.nextFollowupAt ?? new Date().toISOString(),
    owner: ownerName,
    notes: lead.notes ?? "",
    paused: lead.followupState === "paused",
    history: history.map((h) => ({
      icon: historyIcon(h.type),
      text: h.text,
      time: relativeTime(h.at, t),
    })),
  };
}

function MetricCard({ label, icon: Icon, value, note }: { label: string; icon: typeof Clock; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-display text-[24px] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]">{value}</span>
      <span className="text-[12px] text-muted-foreground">{note}</span>
    </div>
  );
}

export default function FollowUpCenter() {
  const { t } = useLang();
  const session = getSession();
  const accessRole = session ? crmAccessRole(session.role) : null;

  const queue = useFollowupQueue();
  const templatesQuery = useTemplates();
  const templates = useMemo(() => flattenTemplateGroups(templatesQuery.data ?? []), [templatesQuery.data]);

  /** Per-lead history, fetched lazily when a lead is selected. */
  const [historyByLead, setHistoryByLead] = useState<Record<string, TimelineEntry[]>>({});
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [pausedRows, setPausedRows] = useState<CenterLead[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"today" | "overdue" | "paused">("today");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<CenterLead | null>(null);
  const [reviewOutcome, setReviewOutcome] = useState<"won" | "lost" | "handover">("won");
  const [reviewNote, setReviewNote] = useState("");
  const [waTarget, setWaTarget] = useState<CenterLead | null>(null);
  const [busy, setBusy] = useState<string>("");

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  function ownerNameOf(id: string): string {
    return ownerNames[id] ?? (accessRole === "SALES" ? session?.name ?? "" : id);
  }

  // ADMIN rows carry owner ids — resolve display names once.
  useEffect(() => {
    if (accessRole !== "ADMIN" || Object.keys(ownerNames).length > 0) return;
    let alive = true;
    (async () => {
      try {
        const users = await followupApi.adminUsers();
        if (!alive) return;
        setOwnerNames(Object.fromEntries(users.map((u) => [u.id, u.name])));
      } catch {
        // Name lookup is cosmetic — ids are shown on failure.
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessRole]);

  const leads: CenterLead[] = useMemo(() => {
    if (!queue.data) return [];
    const rows = [...queue.data.today, ...queue.data.overdue];
    const seen = new Set<string>();
    return rows.flatMap((row) => {
      if (seen.has(row.id)) return [];
      seen.add(row.id);
      return [toCenterLead(row, historyByLead[row.id] ?? EMPTY_HISTORY, ownerNameOf(row.ownerUserId), t)];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.data, historyByLead, ownerNames]);

  // Paused leads live outside the active queue — loaded separately.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await followupApi.leads({ state: "paused", limit: 100 });
        if (!alive) return;
        setPausedRows(res.data.map((row) => toCenterLead(row, historyByLead[row.id] ?? EMPTY_HISTORY, ownerNameOf(row.ownerUserId), t)));
      } catch {
        if (alive) setPausedRows([]);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.data, ownerNames]);

  const active = useMemo(() => leads.filter((l) => !l.paused), [leads]);
  const todayList = useMemo(() => {
    const endOfTodayKL = klStartOfTodayMs() + 86_400_000;
    return active
      .filter((l) => new Date(l.scheduledAt).getTime() <= endOfTodayKL && new Date(l.scheduledAt).getTime() >= klStartOfTodayMs())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [active]);
  const overdueList = useMemo(
    () => active.filter((l) => new Date(l.scheduledAt).getTime() < klStartOfTodayMs()).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [active],
  );
  const pausedList = useMemo(() => [...pausedRows].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()), [pausedRows]);
  const reviewSet = useMemo(() => {
    const start = klStartOfTodayMs();
    return new Set(active.filter((l) => needsReview(l.stage, l.scheduledAt, start)).map((l) => l.id));
  }, [active]);
  const reviewCount = reviewSet.size;

  const allForSelection = useMemo(() => [...leads, ...pausedRows], [leads, pausedRows]);
  const selected = allForSelection.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId) return;
    let alive = true;
    (async () => {
      try {
        const h = await followupApi.leadHistory(selectedId);
        if (!alive) return;
        setHistoryByLead((cur) => ({ ...cur, [selectedId]: h.timeline }));
      } catch {
        // History is supplementary; the row still renders without it.
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedId]);

  async function runBusy(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  const completeFollowup = (id: string) => runBusy(id, async () => {
    const lead = allForSelection.find((l) => l.id === id);
    await followupApi.complete(id, { stage: lead?.stage ?? "FU1" });
    await queue.refetch();
    const h = await followupApi.leadHistory(id);
    setHistoryByLead((cur) => ({ ...cur, [id]: h.timeline }));
    showNotice(t("Susulan direkodkan sebagai selesai.", "Follow-up recorded as complete."));
    setSelectedId(id);
  });

  const postponeFollowup = (id: string, hours: number) => runBusy(id, async () => {
    await followupApi.postpone(id, { to: new Date(Date.now() + hours * 3_600_000).toISOString() });
    await queue.refetch();
    showNotice(t(`Susulan ditangguhkan ${hours} jam.`, `Follow-up postponed by ${hours} hours.`));
  });

  const pauseFollowup = (id: string) => runBusy(id, async () => {
    await followupApi.pause(id, { reason: t("Dijeda dari Pusat Susulan", "Paused from Follow-Up Center") });
    await queue.refetch();
    showNotice(t("Turutan susulan dijeda.", "Follow-up sequence paused."));
  });

  const addNote = (id: string, note: string) => runBusy(id, async () => {
    await followupApi.addNote(id, note);
    const h = await followupApi.leadHistory(id);
    setHistoryByLead((cur) => ({ ...cur, [id]: h.timeline }));
    showNotice(t("Nota disimpan.", "Note saved."));
  });

  function openReviewForSelected() {
    if (!selected) return;
    setReviewTarget(selected);
    setReviewOutcome("won");
    setReviewNote("");
  }

  const confirmReview = () => runBusy(reviewTarget?.id ?? "", async () => {
    if (!reviewTarget) return;
    const outcomeLabel = reviewOutcome === "won" ? t("Menang", "Won") : reviewOutcome === "lost" ? t("Hilang", "Lost") : t("Serah semula", "Hand over");
    await followupApi.review(reviewTarget.id, { outcome: reviewOutcome, note: reviewNote.trim() || undefined });
    setReviewTarget(null);
    await queue.refetch();
    showNotice(t(`Tinjauan ${reviewTarget.name} ditutup sebagai ${outcomeLabel}.`, `${reviewTarget.name}'s review closed as ${outcomeLabel}.`));
  });

  const shownToday = reviewOnly ? todayList.filter((l) => reviewSet.has(l.id)) : todayList;
  const shownOverdue = reviewOnly ? overdueList.filter((l) => reviewSet.has(l.id)) : overdueList;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight">
            {t("Pusat Susulan", "Follow-Up Center")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {(() => {
              const klDate = new Intl.DateTimeFormat("en-MY", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Kuala_Lumpur",
              }).format(new Date());
              return t(
                `${klDate} · Asia/Kuala_Lumpur · setiap susulan jatuh tempo, tertunggak dan dijeda di satu tempat`,
                `${klDate} · Asia/Kuala_Lumpur · every due, overdue and paused follow-up in one place`,
              );
            })()}
          </p>
        </div>
      </header>

      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-success-soft)] px-4 py-2.5 text-[13px] text-[var(--color-success)]">
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" aria-label={t("Tutup notis", "Dismiss")} onClick={() => setNotice("")} className="grid place-items-center border-0 bg-transparent text-inherit">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={t("Ringkasan susulan", "Follow-up summary")}>
        <MetricCard label={t("Tertunggak Hari Ini", "Due today")} icon={ListChecks} value={String(todayList.length)} note={t("Peringkat FU dijadualkan hari ini (MYT)", "FU stage scheduled for today (MYT)")} />
        <MetricCard label={t("Tertunggak", "Overdue")} icon={AlertTriangle} value={String(overdueList.length)} note={t("Melebihi jadual, masih belum dibalas", "Past schedule, still unanswered")} />
        <MetricCard label={t("Dijeda", "Paused")} icon={PauseCircle} value={String(pausedList.length)} note={t("Turutan dijeda atau lead telah membalas", "Sequence paused or lead responded")} />
      </section>

      {queue.loading ? (
        <FollowupLoading />
      ) : queue.status === "error" ? (
        <FollowupErrorState message={queue.error ?? ""} onRetry={() => void queue.refetch()} />
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="px-4 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div data-tour="fu-today-tab" className="inline-flex items-center gap-1 rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-1" role="tablist" aria-label={t("Antrean susulan", "Follow-up queues")}>
                    <button type="button" role="tab" aria-selected={tab === "today"} onClick={() => setTab("today")} className={cn("inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-medium", tab === "today" ? "bg-[var(--color-surface)] font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      {t("Hari Ini", "Due")}
                      <span className="rounded-full bg-[var(--color-neutral-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{shownToday.length}</span>
                    </button>
                    <button type="button" role="tab" aria-selected={tab === "overdue"} onClick={() => setTab("overdue")} className={cn("inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-medium", tab === "overdue" ? "bg-[var(--color-surface)] font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      {t("Tertunggak", "Overdue")}
                      <span className="rounded-full bg-[var(--color-neutral-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{shownOverdue.length}</span>
                    </button>
                    <button type="button" role="tab" aria-selected={tab === "paused"} onClick={() => setTab("paused")} className={cn("inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-medium", tab === "paused" ? "bg-[var(--color-surface)] font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      {t("Dijeda", "Paused")}
                      <span className="rounded-full bg-[var(--color-neutral-soft)] px-1.5 py-0.5 text-[11px] font-bold tabular-nums">{pausedList.length}</span>
                    </button>
                  </div>
                  {accessRole === "ADMIN" && (
                    <label className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
                      <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} className="accent-[var(--color-primary)]" />
                      {t("Perlu tinjauan", "Needs review")} ({reviewCount})
                    </label>
                  )}
                </div>
              </div>

              {tab === "paused" ? (
                pausedList.length === 0 ? (
                  <FollowupEmptyState compact icon={PauseCircle} title={t("Tiada lead dijeda", "No paused leads")} description={t("Lead yang dijeda akan muncul di sini.", "Leads you pause will appear here.")} />
                ) : (
                  <ul className="m-0 flex flex-col list-none p-2">
                    {pausedList.map((l) => (
                      <FollowupTaskRow key={l.id} id={l.id} name={l.name} phone={l.phone} packageName={l.packageName} stage={l.stage} scheduledAt={l.scheduledAt} owner={l.owner} paused lastHistoryIcon={l.history[0]?.icon} selected={selectedId === l.id} onSelect={setSelectedId} onTogglePause={() => void completeFollowup(l.id)} />
                    ))}
                  </ul>
                )
              ) : (tab === "overdue" ? shownOverdue : shownToday).length === 0 ? (
                <FollowupEmptyState compact icon={CheckCircle2} title={tab === "overdue" ? t("Tiada susulan tertunggak", "No overdue follow-ups") : t("Semua selesai untuk hari ini", "All clear for today")} description={t("Tiada lead yang perlu disusul sekarang.", "No leads need following up right now.")} />
              ) : (
                <ul className="m-0 flex flex-col list-none p-2">
                  {(tab === "overdue" ? shownOverdue : shownToday).map((l) => (
                    <FollowupTaskRow key={l.id} id={l.id} name={l.name} phone={l.phone} packageName={l.packageName} stage={l.stage} scheduledAt={l.scheduledAt} owner={l.owner} paused={false} lastHistoryIcon={l.history[0]?.icon} selected={selectedId === l.id} onSelect={setSelectedId} onComplete={() => void completeFollowup(l.id)} onPostpone={() => void postponeFollowup(l.id, 4)} onTogglePause={() => void pauseFollowup(l.id)} needsReview={reviewSet.has(l.id)} />
                  ))}
                </ul>
              )}
            </section>

            <aside className="flex min-w-0 flex-col gap-4">
              {selected ? (
                <>
                  <FollowupSchedulePanel leadName={selected.name} stage={selected.stage} scheduledAt={selected.scheduledAt} paused={selected.paused} />
                  <LeadHistoryNotesPanel leadName={selected.name} notes={selected.notes} history={selected.history} onAddNote={(note) => void addNote(selected.id, note)} />
                  <button type="button" onClick={() => setWaTarget(selected)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-[12.5px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t("Buka WhatsApp", "Open WhatsApp")}
                  </button>
                  {accessRole === "ADMIN" && reviewSet.has(selected.id) && (
                    <button type="button" onClick={openReviewForSelected} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-danger)] px-3 py-2 text-[12.5px] font-bold text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t("Tinjau admin", "Admin review")}
                    </button>
                  )}
                </>
              ) : (
                <FollowupEmptyState compact icon={MessageCircle} title={t("Pilih sebuah lead", "Select a lead")} description={t("Sejarah dan catatan pelanggan akan dipaparkan di sini.", "History and customer notes will appear here.")} />
              )}
              {accessRole === "ADMIN" && (
                <OverdueQueuePanel leads={overdueList} selectedId={selectedId} onSelect={setSelectedId} onComplete={(id) => void completeFollowup(id)} onPostpone={(id) => void postponeFollowup(id, 4)} onTogglePause={(id) => void pauseFollowup(id)} reviewSet={reviewSet} />
              )}
            </aside>
          </div>
        </>
      )}

      {waTarget && (
        <TemplatePickerDialog
          open
          templates={templates}
          lead={{
            leadName: waTarget.name,
            packageName: waTarget.packageName,
            date: new Date(waTarget.scheduledAt).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" }),
            salesName: session?.name ?? "",
            phone: waTarget.phone,
          }}
          onClose={() => setWaTarget(null)}
        />
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={t("Tutup tinjauan admin", "Close admin review")}>
          <div className="flex w-full max-w-[440px] flex-col gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 font-display text-[16px] font-bold">{t("Tutup tinjauan: ", "Close review: ")}{reviewTarget.name}</h2>
              <button type="button" onClick={() => setReviewTarget(null)} aria-label={t("Tutup", "Close")} className="grid h-8 w-8 place-items-center rounded-lg border-0 bg-transparent hover:bg-[var(--color-surface-muted)]"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[12px] font-semibold text-muted-foreground">{t("Keputusan", "Outcome")}</span>
              <div className="flex flex-wrap gap-2">
                {(["won", "lost", "handover"] as const).map((o) => (
                  <button key={o} type="button" onClick={() => setReviewOutcome(o)} className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-semibold", reviewOutcome === o ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "border-[var(--color-border)] bg-[var(--color-surface)] text-muted-foreground")}>
                    {o === "won" ? t("Menang", "Won") : o === "lost" ? t("Hilang", "Lost") : t("Serah semula", "Hand over")}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-muted-foreground">{t("Nota (pilihan)", "Note (optional)")}</span>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[13px]" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReviewTarget(null)} className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold">{t("Batal", "Cancel")}</button>
              <button type="button" onClick={() => void confirmReview()} disabled={busy === reviewTarget.id} className="rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60">{t("Sahkan", "Confirm")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

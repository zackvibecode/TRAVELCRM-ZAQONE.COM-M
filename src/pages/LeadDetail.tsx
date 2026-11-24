import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Loader2,
  MessageCircle,
  ShieldCheck,
  UserCircle2,
  X,
} from "lucide-react";
import { cn, parseDbDate, waLink } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { crmAccessRole, formatKlDate } from "@/pages/LeadManagement";
import { LeadAvatar } from "@/components/LeadHistoryNotesPanel";
import NeutralNotFound from "@/components/NeutralNotFound";
import { formatSchedule, stageTone } from "@/components/FollowupTaskRow";
import {
  FollowupEmptyState,
  FollowupErrorState,
  FollowupLoading,
} from "@/components/FollowupStates";
import {
  followupApi,
  type FollowupLead,
  type LeadHistory,
  type TimelineEntry,
} from "@/lib/followup-api";

/** Pipeline stage labels — same set as the list page, kept local so the
 *  detail route only depends on the pure helpers LeadManagement exports. */
const STAGE_LABELS: Record<string, [string, string]> = {
  new: ["Baharu", "New"],
  contacted: ["Dihubungi", "Contacted"],
  qualified: ["Layak", "Qualified"],
  quotation: ["Sebut Harga", "Quotation"],
  won: ["Menang", "Won"],
  lost: ["Hilang", "Lost"],
  archived: ["Diarkibkan", "Archived"],
};

const STATE_LABELS: Record<string, [string, string]> = {
  active: ["Aktif", "Active"],
  paused: ["Dijeda", "Paused"],
  done: ["Selesai", "Done"],
  escalated: ["Dinaikkan", "Escalated"],
};

type Translate = (ms: string, en: string) => string;

/** Maps an API timeline entry type to a human-readable kind label. */
function historyKind(type: string): [string, string] {
  switch (type) {
    case "note":
      return ["Nota", "Note"];
    case "call":
    case "phone":
      return ["Panggilan", "Call"];
    case "whatsapp":
      return ["WhatsApp", "WhatsApp"];
    case "email":
      return ["E-mel", "Email"];
    case "stage_change":
      return ["Perubahan peringkat", "Stage change"];
    case "transfer":
      return ["Pemilikan dipindah", "Ownership transferred"];
    case "pause":
      return ["Dijeda", "Paused"];
    case "resume":
      return ["Disambung semula", "Resumed"];
    case "postpone":
      return ["Ditangguh", "Postponed"];
    case "escalation":
      return ["Dinaikkan", "Escalated"];
    case "review":
      return ["Tinjauan admin", "Admin review"];
    default:
      return [type, type];
  }
}

/** Relative time label for a history entry (English/Bahasa Malaysia). */
function relativeTime(iso: string, t: Translate): string {
  const ms = Date.now() - parseDbDate(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const min = Math.round(ms / 60_000);
  if (min < 1) return t("Baru sekarang", "Just now");
  if (min < 60) return t(`${min} min lalu`, `${min} min ago`);
  const hrs = Math.round(min / 60);
  if (hrs < 24) return t(`${hrs} jam lalu`, `${hrs}h ago`);
  const days = Math.round(hrs / 24);
  return t(`${days} hari lalu`, `${days}d ago`);
}

/**
 * Activity text sometimes embeds a raw user id (e.g. "Ownership transferred
 * to user <id>"). Swap any known id for its display name so the timeline
 * reads naturally; unknown ids are left untouched.
 */
function resolveActivityText(text: string, ownerMap: Map<string, string>, selfName: string): string {
  let out = text;
  for (const [id, name] of ownerMap) {
    if (id && name && out.includes(id)) out = out.split(id).join(name);
  }
  const selfId = getSession()?.userId;
  if (selfId && selfName && out.includes(selfId)) out = out.split(selfId).join(selfName);
  return out;
}

/**
 * Lead detail page. The lead is fetched from GET /leads/:id, which is
 * ownership-guarded server-side with a neutral 404 (never 403) so the
 * existence of another sales' lead never leaks — the UI mirrors that by
 * rendering the same NeutralNotFound for missing and forbidden ids.
 */
export default function LeadDetail() {
  const { t } = useLang();
  const { id = "" } = useParams<{ id: string }>();
  const session = getSession();
  const accessRole = session ? crmAccessRole(session.role) : null;
  const isAdmin = accessRole === "ADMIN";

  const [lead, setLead] = useState<FollowupLead | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [error, setError] = useState("");
  /** Owner display name — ADMIN resolves it from /admin/users; SALES is the owner. */
  const [ownerName, setOwnerName] = useState("");
  const [history, setHistory] = useState<LeadHistory | null>(null);
  const [historyStatus, setHistoryStatus] = useState<"loading" | "ready" | "error">("loading");
  const [historyError, setHistoryError] = useState("");
  const [ownerMap, setOwnerMap] = useState<Map<string, string>>(new Map());
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "danger">("success");
  const [busy, setBusy] = useState(false);

  const [noteDraft, setNoteDraft] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");

  function showNotice(message: string, tone: "success" | "danger" = "success") {
    setNoticeTone(tone);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  /** Loads the lead; a 404 (missing or not yours) becomes the neutral page. */
  async function loadLead() {
    setStatus("loading");
    try {
      const row = await followupApi.lead(id);
      setLead(row);
      setStatus("ready");
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/\b404\b|not found/i.test(message)) {
        setStatus("notfound");
      } else {
        setError(message);
        setStatus("error");
      }
    }
  }

  useEffect(() => {
    setLead(null);
    setHistory(null);
    setNoteDraft("");
    void loadLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Timeline + customer notes, fetched lazily once the lead is known.
  useEffect(() => {
    if (!lead) return;
    let alive = true;
    setHistoryStatus("loading");
    (async () => {
      try {
        const h = await followupApi.leadHistory(lead.id);
        if (!alive) return;
        setHistory(h);
        setHistoryStatus("ready");
      } catch (err) {
        if (!alive) return;
        setHistoryError(err instanceof Error ? err.message : String(err));
        setHistoryStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ADMIN sees owner ids on the row — resolve them to display names once.
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      try {
        const users = await followupApi.adminUsers();
        if (!alive) return;
        const map = new Map(users.map((u) => [u.id, u.name]));
        setOwnerName((current) => current || map.get(lead?.ownerUserId ?? "") || "");
        setOwnerMap(map);
      } catch {
        // Name lookup is cosmetic — ids are shown on failure.
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, lead?.ownerUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : String(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  /** Reload lead + timeline after a mutation so the panel stays truthful. */
  async function refreshAll() {
    await loadLead();
    if (!lead) return;
    try {
      const h = await followupApi.leadHistory(lead.id);
      setHistory(h);
      setHistoryStatus("ready");
    } catch {
      // The lead row alone is still useful if the timeline fails.
    }
  }

  const addNote = (text: string) =>
    runBusy(async () => {
      await followupApi.addNote(id, text);
      setNoteDraft("");
      await refreshAll();
      showNotice(t("Nota disimpan.", "Note saved."));
    });

  const confirmTransfer = () =>
    runBusy(async () => {
      if (!transferTo) return;
      await followupApi.transfer(id, { ownerUserId: transferTo });
      setTransferOpen(false);
      setTransferTo("");
      await refreshAll();
      showNotice(t("Pemilikan lead dipindahkan.", "Lead ownership transferred."));
    });

  const confirmPause = () =>
    runBusy(async () => {
      await followupApi.pause(id, { reason: pauseReason.trim() || t("Dijeda dari halaman lead", "Paused from lead page") });
      setPauseOpen(false);
      setPauseReason("");
      await refreshAll();
      showNotice(t("Turutan susulan dijeda.", "Follow-up sequence paused."));
    });

  const resumable = lead?.followupState === "paused";
  /** Owner or ADMIN may pause / transfer / add notes — mirrors the server guard. */
  const canAct = isAdmin || (accessRole === "SALES" && lead?.ownerUserId === session?.userId);
  const resolvedOwner = lead
    ? isAdmin
      ? ownerMap.get(lead.ownerUserId) ?? ownerName ?? lead.ownerUserId
      : session?.name ?? ""
    : "";
  const sched = lead?.nextFollowupAt ? formatSchedule(lead.nextFollowupAt, t) : null;
  const pill = lead?.followupStage ? stageTone(lead.followupStage) : null;
  const timeline: TimelineEntry[] = history?.timeline ?? [];
  const notes = history?.notes ?? [];

  if (status === "loading") {
    return (
      <div className="flex flex-col gap-5">
        <BackLink t={t} />
        <FollowupLoading />
      </div>
    );
  }

  if (status === "notfound") {
    return <NeutralNotFound />;
  }

  if (status === "error" || !lead) {
    return (
      <div className="flex flex-col gap-5">
        <BackLink t={t} />
        <FollowupErrorState message={error} onRetry={() => void loadLead()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link
          to="/lead-management"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("Pengurusan Lead", "Lead Management")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <LeadAvatar name={lead.name} />
          <div className="min-w-0">
            <h1 className="m-0 break-words font-display text-[22px] font-bold tracking-tight">
              {lead.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
              {pill && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
                  style={{ background: pill.bg, color: pill.fg }}
                >
                  {lead.followupStage}
                </span>
              )}
              {lead.followupState && lead.followupState !== "active" && (
                <span className="rounded-full bg-[var(--color-neutral-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
                  {t(...STATE_LABELS[lead.followupState] ?? [lead.followupState, lead.followupState])}
                </span>
              )}
              <span>· {t(...STAGE_LABELS[lead.stage] ?? [lead.stage, lead.stage])}</span>
              {lead.destination && <span>· {lead.destination}</span>}
              {lead.createdAt && <span>· {t("dicipta", "created")} {formatKlDate(lead.createdAt)}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAct && (
            <>
              <button
                type="button"
                onClick={() => setPauseOpen(true)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
              >
                {resumable ? t("Sambung semula", "Resume") : t("Jeda", "Pause")}
              </button>
              {isAdmin && ownerMap.size > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTransferTo("");
                    setTransferOpen(true);
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                >
                  {t("Pindahkan pemilikan", "Transfer ownership")}
                </button>
              )}
            </>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold",
              isAdmin
                ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "bg-[var(--color-info-soft)] text-[var(--color-info)]",
            )}
          >
            {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <UserCircle2 className="h-3.5 w-3.5" />}
            {accessRole ?? ""}
          </span>
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-[13px]",
            noticeTone === "success"
              ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
              : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
          )}
        >
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" aria-label={t("Tutup notis", "Dismiss")} onClick={() => setNotice("")} className="grid place-items-center border-0 bg-transparent text-inherit">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="m-0 font-display text-[15px] font-bold">
            {t("Maklumat Lead", "Lead Information")}
          </h2>
          <dl className="m-0 grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
            <dt className="text-[12px] text-muted-foreground">{t("Telefon", "Phone")}</dt>
            <dd className="m-0 flex items-center gap-2 [font-variant-numeric:tabular-nums]">
              {lead.phone}
              <a
                href={`${waLink(lead.phone, lead.phoneNormalized)}?text=${encodeURIComponent(t("Halo, ini susulan berkaitan pakej perjalanan anda.", "Hi, this is a follow-up on your travel package."))}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-2 py-1 text-[11.5px] font-semibold hover:bg-[var(--color-surface-muted)]"
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </a>
            </dd>
            {lead.email && (
              <>
                <dt className="text-[12px] text-muted-foreground">{t("E-mel", "Email")}</dt>
                <dd className="m-0 break-all">{lead.email}</dd>
              </>
            )}
            <dt className="text-[12px] text-muted-foreground">{t("Destinasi", "Destination")}</dt>
            <dd className="m-0">{lead.destination ?? t("—", "—")}</dd>
            <dt className="text-[12px] text-muted-foreground">{t("Pax", "Pax")}</dt>
            <dd className="m-0">{String(lead.pax)}</dd>
            <dt className="text-[12px] text-muted-foreground">{t("Status", "Status")}</dt>
            <dd className="m-0">{t(...STAGE_LABELS[lead.stage] ?? [lead.stage, lead.stage])}</dd>
            <dt className="text-[12px] text-muted-foreground">{t("Pemilik", "Owner")}</dt>
            <dd className="m-0">
              {resolvedOwner}
              {lead.ownerUserId === session?.userId && (
                <span className="ml-1.5 rounded-full bg-[var(--color-info-soft)] px-1.5 text-[10.5px] font-bold text-[var(--color-info)]">
                  {t("Anda", "You")}
                </span>
              )}
            </dd>
          </dl>

          <h2 className="m-0 mt-2 font-display text-[15px] font-bold">
            {t("Sejarah & Nota", "History & Notes")}
          </h2>
          {/* Customer notes composer — owner or ADMIN only. */}
          {canAct && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = noteDraft.trim();
                if (text) void addNote(text);
              }}
              className="flex flex-col gap-2"
            >
              <label htmlFor="new-customer-note" className="sr-only">
                {t("Tambah catatan pelanggan", "Add customer note")}
              </label>
              <textarea
                id="new-customer-note"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                disabled={busy}
                placeholder={t("Tulis catatan tentang pelanggan ini…", "Write a note about this customer…")}
                className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-primary)]"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] text-muted-foreground">
                  {t("Catatan hanya untuk pasukan dalaman.", "Notes are for the internal team only.")}
                </span>
                <button
                  type="submit"
                  disabled={noteDraft.trim() === "" || busy}
                  className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--color-primary-foreground)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("Simpan Nota", "Save Note")}
                </button>
              </div>
            </form>
          )}

          {/* Customer notes list (from GET /leads/:id/history → notes). */}
          {historyStatus === "loading" ? (
            <div className="flex items-center gap-2 py-2 text-[12.5px] text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t("Memuatkan nota…", "Loading notes…")}
            </div>
          ) : historyStatus === "error" ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-danger-soft)] px-3 py-2 text-[12.5px] text-[var(--color-danger)]" role="alert">
              <AlertTriangle className="h-3.5 w-3.5 flex-none" />
              <span className="min-w-0 flex-1">{historyError}</span>
              <button type="button" onClick={() => void refreshAll()} className="font-semibold hover:underline">
                {t("Cuba semula", "Try again")}
              </button>
            </div>
          ) : notes.length === 0 ? (
            <p className="m-0 text-[12.5px] text-muted-foreground">
              {t("Tiada nota lagi.", "No notes yet.")}
            </p>
          ) : (
            <ul className="m-0 flex flex-col gap-2.5 p-0">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5"
                >
                  <p className="m-0 whitespace-pre-line text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                    {note.text}
                  </p>
                  <p className="m-0 mt-1.5 text-[11px] text-muted-foreground">
                    {ownerMap.get(note.createdBy) ?? (note.createdBy === session?.userId ? session?.name ?? "" : note.createdBy)} · {formatKlDateTime(note.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {/* Activity timeline (engine events: pauses, transfers, confirmations). */}
          <h3 className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("Sejarah aktiviti", "Activity history")}
          </h3>
          {historyStatus === "loading" ? (
            <div className="flex items-center gap-2 py-2 text-[12.5px] text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              {t("Memuatkan sejarah…", "Loading history…")}
            </div>
          ) : historyStatus === "error" ? (
            <FollowupEmptyState
              compact
              icon={AlertTriangle}
              title={t("Sejarah tidak dapat dimuatkan", "History could not be loaded")}
              description={historyError}
              action={
                <button
                  type="button"
                  onClick={() => void refreshAll()}
                  className="text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {t("Cuba semula", "Try again")}
                </button>
              }
            />
          ) : timeline.length === 0 ? (
            <FollowupEmptyState
              compact
              title={t("Tiada aktiviti lagi.", "No activity yet.")}
              description={t("Aktiviti susulan akan muncul di sini.", "Follow-up activity will appear here.")}
            />
          ) : (
            <ul className="m-0 flex flex-col gap-3 p-0">
              {timeline.map((entry) => {
                const kind = historyKind(entry.type);
                return (
                  <li key={entry.id} className="flex gap-2.5 text-[12.5px] text-[var(--color-text-secondary)]">
                    <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[9.5px] font-bold uppercase text-muted-foreground">
                      {t(...kind).slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <span className="block whitespace-pre-line">{resolveActivityText(entry.text, ownerMap, session?.name ?? "")}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {t(...kind)} · {ownerMap.get(entry.user) ?? (entry.user === session?.userId ? session?.name ?? "" : entry.user)} · {relativeTime(entry.at, t)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="m-0 font-display text-[15px] font-bold">
            {t("Susulan Seterusnya", "Next Follow-Up")}
          </h2>
          {lead.followupState === "paused" ? (
            <div className="flex items-center gap-2 text-[13px]">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-[var(--color-text-secondary)]">{t(...STATE_LABELS.paused)}</span>
            </div>
          ) : sched ? (
            <div className="flex items-center gap-2 text-[13px]">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className={cn("font-semibold [font-variant-numeric:tabular-nums]", sched.overdue ? "text-[var(--color-danger)]" : "text-foreground")}>
                {sched.overdue ? `${t("Lewat", "Overdue")} — ` : ""}
                {sched.label}
              </span>
            </div>
          ) : (
            <p className="m-0 text-[12.5px] text-muted-foreground">
              {t("Tiada susulan dijadualkan.", "No follow-up scheduled.")}
            </p>
          )}
          {lead.pauseReason && lead.followupState === "paused" && (
            <p className="m-0 whitespace-pre-line text-[12px] text-muted-foreground">
              {lead.pauseReason}
            </p>
          )}
          <p className="m-0 text-[12px] text-muted-foreground">
            {t(
              "Masa dikira mengikut zon Asia/Kuala_Lumpur.",
              "Times are calculated in the Asia/Kuala_Lumpur zone.",
            )}
          </p>
        </aside>
      </div>

      <TransferDialog
        open={transferOpen}
        users={ownerMap}
        current={lead.ownerUserId}
        value={transferTo}
        onChange={setTransferTo}
        busy={busy}
        onCancel={() => setTransferOpen(false)}
        onConfirm={() => void confirmTransfer()}
        t={t}
      />
      <PauseDialog
        open={pauseOpen}
        reason={pauseReason}
        onChange={setPauseReason}
        busy={busy}
        onCancel={() => setPauseOpen(false)}
        onConfirm={() => void confirmPause()}
        t={t}
      />
    </div>
  );
}

/** Transfer dialog — ADMIN only; target chosen from the active CRM users. */
function TransferDialog({
  open,
  users,
  current,
  value,
  onChange,
  busy,
  onCancel,
  onConfirm,
  t,
}: {
  open: boolean;
  users: Map<string, string>;
  current: string;
  value: string;
  onChange: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: Translate;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-title"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div className="flex w-full max-w-[420px] flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
        <h2 id="transfer-title" className="m-0 font-display text-[17px] font-bold">
          {t("Pindahkan pemilikan", "Transfer ownership")}
        </h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-muted-foreground">{t("Pemilik baharu", "New owner")}</span>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-[13px]"
          >
            <option value="">{t("Pilih…", "Pick…")}</option>
            {[...users.entries()]
              .filter(([id]) => id !== current)
              .map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
          >
            {t("Batal", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || value === ""}
            autoFocus={false}
            className="rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
          >
            {busy ? t("Memproses…", "Processing…") : t("Pindah", "Transfer")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pause dialog — asks for an optional reason that lands in the timeline. */
function PauseDialog({
  open,
  reason,
  onChange,
  busy,
  onCancel,
  onConfirm,
  t,
}: {
  open: boolean;
  reason: string;
  onChange: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  t: Translate;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}
    >
      <div className="flex w-full max-w-[420px] flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
        <h2 id="pause-title" className="m-0 font-display text-[17px] font-bold">
          {t("Jeda susulan", "Pause follow-up")}
        </h2>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-muted-foreground">{t("Sebab (pilihan)", "Reason (optional)")}</span>
          <textarea
            value={reason}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            autoFocus
            placeholder={t("Contoh: pelanggan di luar negara.", "E.g. customer is overseas.")}
            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2 text-[13px] outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
          >
            {t("Batal", "Cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
          >
            {busy ? t("Memproses…", "Processing…") : t("Sahkan", "Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackLink({ t }: { t: Translate }) {
  return (
    <div>
      <Link
        to="/lead-management"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("Pengurusan Lead", "Lead Management")}
      </Link>
    </div>
  );
}

/** Formats an ISO timestamp as date + time in the Asia/Kuala_Lumpur zone. */
function formatKlDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}


import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageCircle,
  PauseCircle,
  Phone,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

/** Follow-up stage labels — FU1/FU2/FU3 three-stage sequence. */
export type FollowupStage = "FU1" | "FU2" | "FU3";

export type FollowupHistoryIcon =
  | "phone"
  | "whatsapp"
  | "note"
  | "stage_change"
  | "pause"
  | "resume";

export const FOLLOWUP_HISTORY_ICONS: Record<
  FollowupHistoryIcon,
  typeof Phone
> = {
  phone: Phone,
  whatsapp: MessageCircle,
  note: StickyNote,
  stage_change: ChevronRight,
  pause: PauseCircle,
  resume: ChevronRight,
};

export const STAGE_ORDER: Record<FollowupStage, number> = {
  FU1: 1,
  FU2: 2,
  FU3: 3,
};

export function stageTone(stage: FollowupStage): {
  bg: string;
  fg: string;
} {
  const map: Record<FollowupStage, { bg: string; fg: string }> = {
    FU1: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
    FU2: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
    FU3: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  };
  return map[stage];
}

/**
 * Formats a schedule as a Kuala Lumpur-time label plus overdue flag.
 * Shared by the task list and the detail panel. The relative prefix is
 * translated ("in"/"dalam") when a translate fn is provided.
 */
export function formatSchedule(
  iso: string,
  t: (ms: string, en: string) => string = (_ms, en) => en,
): {
  label: string;
  overdue: boolean;
} {
  const scheduled = new Date(iso);
  const now = new Date();
  const diffMin = Math.round(
    (scheduled.getTime() - now.getTime()) / 60_000,
  );
  const klTime = new Intl.DateTimeFormat("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(scheduled);
  // Unit abbreviations follow the active language (h/m are shared; "d" is not).
  const uD = t("h", "d");
  const uH = "h";
  const uM = "m";
  if (diffMin < 0) {
    const abs = Math.abs(diffMin);
    const days = Math.floor(abs / 1440);
    const hours = Math.floor((abs % 1440) / 60);
    const part =
      days > 0
        ? `${days}${uD} ${hours}${uH}`
        : hours > 0
          ? `${hours}${uH} ${abs % 60}${uM}`
          : `${abs}${uM}`;
    return { label: `${part} · ${klTime}`, overdue: true };
  }
  if (diffMin < 60)
    return { label: `${t("dalam", "in")} ${diffMin}${uM}`, overdue: false };
  return {
    label: `${t("dalam", "in")} ${Math.floor(diffMin / 60)}${uH} ${diffMin % 60}${uM} · ${klTime}`,
    overdue: false,
  };
}

export function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p?.[0]?.toUpperCase())
    .join("");
}

/**
 * Malaysia is UTC+8 year-round (no DST), so a fixed offset safely marks the
 * KL day boundary. Returns the epoch ms of 00:00 Asia/Kuala_Lumpur today.
 */
export function klStartOfTodayMs(): number {
  const todayKL = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
  return new Date(`${todayKL}T00:00:00+08:00`).getTime();
}

/** Whole days an ISO schedule is late relative to the KL day boundary. */
export function daysLate(iso: string, startOfTodayMs: number): number {
  const scheduled = new Date(iso).getTime();
  if (scheduled >= startOfTodayMs) return 0;
  return Math.floor((startOfTodayMs - scheduled) / 86_400_000);
}

/**
 * "Needs review" flag: a lead on its last stage (FU3) whose schedule is
 * already past. The three-stage sequence is exhausted, so the lead is a
 * candidate for admin escalation instead of another automated nudge.
 */
export function needsReview(
  stage: FollowupStage,
  scheduledAt: string,
  startOfTodayMs: number = klStartOfTodayMs(),
): boolean {
  return stage === "FU3" && new Date(scheduledAt).getTime() < startOfTodayMs;
}

/** Row shape shared by the Follow-Up Center lists (frontend mock layer). */
export interface FollowupTaskRowProps {
  id: string;
  name: string;
  phone: string;
  packageName: string;
  stage: FollowupStage;
  /** ISO datetime of the scheduled follow-up. */
  scheduledAt: string;
  owner: string;
  paused: boolean;
  lastHistoryIcon?: FollowupHistoryIcon;
  selected?: boolean;
  onSelect: (id: string) => void;
  /** Quick action: mark the follow-up complete (advances FU stage). */
  onComplete?: (id: string) => void;
  /** Quick action: postpone the follow-up (default +4h). */
  onPostpone?: (id: string) => void;
  /** Quick action: pause/resume the sequence. */
  onTogglePause?: (id: string) => void;
  /** Flag: lead needs admin review (FU3 exhausted and past schedule). */
  needsReview?: boolean;
}

/**
 * A single row in the Today's Task List / Overdue Queue. Clicking it selects
 * the lead so the detail panel shows its history and quick actions. Inline
 * quick-action buttons (complete / postpone / pause) let sales act directly
 * from the list without navigating away.
 */
export default function FollowupTaskRow({
  id,
  name,
  packageName,
  stage,
  scheduledAt,
  owner,
  paused,
  lastHistoryIcon,
  selected,
  onSelect,
  onComplete,
  onPostpone,
  onTogglePause,
  needsReview,
}: FollowupTaskRowProps) {
  const { t } = useLang();
  const sched = formatSchedule(scheduledAt, t);
  const pill = stageTone(stage);
  const Icon = lastHistoryIcon
    ? FOLLOWUP_HISTORY_ICONS[lastHistoryIcon]
    : Phone;
  const hasQuickActions = Boolean(onComplete || onPostpone || onTogglePause);

  return (
    <li>
      <div
        className={cn(
          "group/row flex w-full items-center gap-3 border-b border-[var(--color-border)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-surface-raised)]",
          selected && "bg-[var(--color-primary-soft)]",
          needsReview && !selected && "bg-[var(--color-warning-soft)]/40",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(id)}
          aria-current={selected ? "true" : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--color-neutral-soft)] text-[12px] font-bold text-[var(--color-text-secondary)]">
            {initialsOf(name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 flex flex-wrap items-center gap-x-1.5 text-[13.5px] font-semibold">
              <span className="truncate">{name}</span>
              {needsReview && (
                <span className="inline-flex flex-none items-center gap-1 rounded-full bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-warning)]">
                  <AlertTriangle className="h-3 w-3" />
                  {t("Perlu Ditinjau", "Needs Review")}
                </span>
              )}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
              <span className="truncate">{packageName}</span>
              <span className="max-md:hidden">· {owner}</span>
            </div>
          </div>
          <div className="flex flex-none flex-col items-end gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
              style={{ background: pill.bg, color: pill.fg }}
            >
              {stage}
            </span>
            {paused && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-neutral-soft)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                <PauseCircle className="h-3 w-3" />
                {t("Dijeda", "Paused")}
              </span>
            )}
            <span
              className={cn(
                "text-[11.5px] font-semibold [font-variant-numeric:tabular-nums]",
                sched.overdue
                  ? "text-[var(--color-danger)]"
                  : "text-muted-foreground",
              )}
            >
              {sched.overdue ? `${t("Lewat", "Overdue")} ` : ""}
              {sched.label}
            </span>
          </div>
        </button>

        {hasQuickActions && (
          <div
            className="flex flex-none items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 max-md:opacity-100"
            role="group"
            aria-label={t("Aksi cepat", "Quick actions")}
          >
            {onComplete && (
              <button
                type="button"
                title={t("Tandakan selesai", "Mark complete")}
                aria-label={t(`Tandakan ${name} selesai`, `Mark ${name} complete`)}
                onClick={() => onComplete(id)}
                className="grid h-7 w-7 place-items-center rounded-lg text-[var(--color-success)] hover:bg-[var(--color-success-soft)] focus-ring"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            {onPostpone && (
              <button
                type="button"
                title={t("Tangguh 4 jam", "Postpone 4 hours")}
                aria-label={t(`Tangguhkan susulan ${name} 4 jam`, `Postpone ${name} by 4 hours`)}
                onClick={() => onPostpone(id)}
                className="grid h-7 w-7 place-items-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] focus-ring"
              >
                <Clock className="h-4 w-4" />
              </button>
            )}
            {onTogglePause && (
              <button
                type="button"
                title={paused ? t("Sambung semula", "Resume") : t("Jeda susulan", "Pause follow-up")}
                aria-label={
                  paused
                    ? t(`Sambung semula susulan ${name}`, `Resume ${name} follow-up`)
                    : t(`Jeda susulan ${name}`, `Pause ${name} follow-up`)
                }
                onClick={() => onTogglePause(id)}
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-lg focus-ring",
                  paused
                    ? "text-[var(--color-info)] hover:bg-[var(--color-info-soft)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]",
                )}
              >
                <PauseCircle className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        <Icon className="h-3.5 w-3.5 flex-none text-muted-foreground max-md:hidden" />
      </div>
    </li>
  );
}

import { CalendarClock, CheckCircle2, CircleDashed, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  STAGE_ORDER,
  formatSchedule,
  stageTone,
  type FollowupStage,
} from "@/components/FollowupTaskRow";

interface FollowupSchedulePanelProps {
  leadName: string;
  /** Current stage in the FU1 → FU2 → FU3 sequence. */
  stage: FollowupStage;
  /** ISO datetime of the scheduled next follow-up. */
  scheduledAt: string;
  paused: boolean;
  /** Per-stage completion flags derived from history (FU1/FU2 done, etc). */
  completedStages?: FollowupStage[];
}

const STAGES: FollowupStage[] = ["FU1", "FU2", "FU3"];

/**
 * Schedule detail panel — shows where the lead sits in the three-stage
 * sequence (FU1 → FU2 → FU3) as a vertical timeline, plus the next
 * follow-up card with the Kuala Lumpur-time label and overdue flag.
 */
export default function FollowupSchedulePanel({
  leadName,
  stage,
  scheduledAt,
  paused,
  completedStages = [],
}: FollowupSchedulePanelProps) {
  const { t } = useLang();
  const sched = formatSchedule(scheduledAt, t);
  const currentOrder = STAGE_ORDER[stage];

  return (
    <div className="flex flex-col gap-4">
      {/* Next follow-up card */}
      <div
        className={cn(
          "flex flex-col gap-1.5 rounded-[var(--radius-card)] border p-4",
          sched.overdue
            ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-raised)]",
        )}
      >
        <p className="m-0 flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {t("Susulan Seterusnya", "Next Follow-Up")}
        </p>
        <p
          className={cn(
            "m-0 font-display text-[18px] font-bold leading-tight [font-variant-numeric:tabular-nums]",
            sched.overdue ? "text-[var(--color-danger)]" : "text-foreground",
          )}
        >
          {sched.overdue ? `${t("Lewat", "Overdue")} · ` : ""}
          {sched.label}
        </p>
        <p className="m-0 text-[11.5px] text-muted-foreground">
          {paused
            ? t("Turutan dijeda — jadwal tidak akan maju.", "Sequence paused — schedule will not advance.")
            : t("Waktu mengikut Asia/Kuala_Lumpur (UTC+8).", "Times are in Asia/Kuala_Lumpur (UTC+8).")}
        </p>
      </div>

      {/* Three-stage timeline */}
      <div className="flex flex-col gap-2">
        <p className="m-0 text-[12px] font-bold uppercase tracking-wider text-muted-foreground">
          {t("Turutan 3 Peringkat", "3-Stage Sequence")}
        </p>
        <ol className="m-0 flex flex-col gap-0 p-0" aria-label={t(`Peringkat susulan ${leadName}`, `Follow-up stages for ${leadName}`)}>
          {STAGES.map((s, i) => {
            const order = STAGE_ORDER[s];
            const done = completedStages.includes(s) || order < currentOrder;
            const current = s === stage;
            const pill = stageTone(s);
            const isLast = i === STAGES.length - 1;
            return (
              <li key={s} className="flex gap-3">
                {/* rail */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full",
                      done
                        ? "bg-[var(--color-success)] text-white"
                        : current
                          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                          : "border border-[var(--color-border)] bg-[var(--color-surface)] text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : current && paused ? (
                      <PauseCircle className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDashed className="h-3.5 w-3.5" />
                    )}
                  </span>
                  {!isLast && (
                    <span
                      className={cn(
                        "my-0.5 w-px flex-1",
                        done ? "bg-[var(--color-success)]/60" : "bg-[var(--color-border)]",
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>
                {/* content */}
                <div className={cn("pb-3", isLast && "pb-0")}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{ background: pill.bg, color: pill.fg }}
                    >
                      {s}
                    </span>
                    <span className="text-[12.5px] font-semibold">
                      {done
                        ? t("Selesai", "Done")
                        : current
                          ? paused
                            ? t("Dijeda", "Paused")
                            : t("Aktif", "Active")
                          : t("Menunggu", "Waiting")}
                    </span>
                  </div>
                  <p className="m-0 mt-0.5 text-[11.5px] text-muted-foreground">
                    {done
                      ? t("Pengesahan manual direkodkan.", "Manual confirmation recorded.")
                      : current
                        ? t("Susulan ini sedang berjalan.", "This follow-up is in progress.")
                        : t("Akan dijadualkan selepas peringkat sebelumnya selesai.", "Scheduled after the previous stage completes.")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

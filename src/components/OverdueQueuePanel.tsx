import { useMemo } from "react";
import { AlertTriangle, CalendarClock, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import FollowupTaskRow, {
  daysLate,
  klStartOfTodayMs,
  type FollowupStage,
  type FollowupHistoryIcon,
} from "@/components/FollowupTaskRow";

/** A lead in the overdue queue (frontend mock layer). */
export interface OverdueLead {
  id: string;
  name: string;
  phone: string;
  packageName: string;
  stage: FollowupStage;
  /** ISO datetime of the scheduled follow-up, already past. */
  scheduledAt: string;
  owner: string;
  paused: boolean;
  history: { icon: FollowupHistoryIcon; text: string; time: string }[];
}

interface OverdueQueuePanelProps {
  leads: OverdueLead[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onComplete?: (id: string) => void;
  onPostpone?: (id: string) => void;
  onTogglePause?: (id: string) => void;
  /** Lead ids flagged "needs review" (FU3 past schedule). */
  reviewSet?: Set<string>;
}

/** Day-bucket label for the queue — "2 days late", "3 days late", … */
function bucketLabel(days: number, t: (ms: string, en: string) => string) {
  if (days <= 0)
    return { title: t("Hari ini", "Today"), note: t("Jatuh tempo hari ini", "Due today") };
  if (days === 1)
    return { title: t("1 hari lewat", "1 day late"), note: t("Semalam", "Yesterday") };
  return {
    title: t(`${days} hari lewat`, `${days} days late`),
    note: t(`${days} hari lalu`, `${days} days ago`),
  };
}

/**
 * The Overdue Queue — gathers follow-ups already past their schedule grouped
 * by how many days late they are, so no lead is missed. Rows reuse
 * FollowupTaskRow so quick actions stay available directly from the queue.
 */
export default function OverdueQueuePanel({
  leads,
  selectedId,
  onSelect,
  onComplete,
  onPostpone,
  onTogglePause,
  reviewSet,
}: OverdueQueuePanelProps) {
  const { t } = useLang();

  const buckets = useMemo(() => {
    const startOfToday = klStartOfTodayMs();
    const byDay = new Map<number, OverdueLead[]>();
    for (const lead of leads) {
      const days = daysLate(lead.scheduledAt, startOfToday);
      const list = byDay.get(days) ?? [];
      list.push(lead);
      byDay.set(days, list);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([days, items]) => ({
        days,
        label: bucketLabel(days, t),
        // Within a bucket keep chronological order (oldest schedule first).
        items: items.sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
        ),
      }));
  }, [leads, t]);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-5 py-12 text-center text-muted-foreground">
        <Inbox className="h-6 w-6 text-[var(--color-success)]" />
        <p className="m-0 font-semibold text-foreground">
          {t("Tiada susulan tertunggak", "No overdue follow-ups")}
        </p>
        <p className="m-0 text-[13px]">
          {t(
            "Semua lead mengikut jadual — teruskan kerja yang baik!",
            "Every lead is on schedule — nice work!",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {buckets.map(({ days, label, items }) => (
        <section key={days} aria-label={label.title}>
          <div
            className={cn(
              "flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2",
              days >= 2 && "bg-[var(--color-danger-soft)]",
            )}
          >
            {days >= 1 ? (
              <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span
              className={cn(
                "text-[12px] font-bold uppercase tracking-wider",
                days >= 1 ? "text-[var(--color-danger)]" : "text-muted-foreground",
              )}
            >
              {label.title}
            </span>
            <span className="text-[11.5px] text-muted-foreground">· {label.note}</span>
            <span className="ml-auto rounded-full bg-[var(--color-surface)] px-1.5 text-[11px] font-bold text-[var(--color-text-secondary)]">
              {items.length}
            </span>
          </div>
          <ul className="m-0 list-none p-0">
            {items.map((lead) => (
              <FollowupTaskRow
                key={lead.id}
                {...lead}
                lastHistoryIcon={lead.history[0]?.icon}
                selected={selectedId === lead.id}
                needsReview={reviewSet?.has(lead.id)}
                onSelect={onSelect}
                onComplete={onComplete}
                onPostpone={onPostpone}
                onTogglePause={onTogglePause}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

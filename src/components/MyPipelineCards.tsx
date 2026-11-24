import { Link } from "react-router-dom";
import { ArrowRight, Inbox, Target, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { STATUS_LABELS, type LeadStatus } from "@/pages/LeadManagement";

/** Pipeline stages shown on the personal summary, in funnel order. */
const FUNNEL: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

const FUNNEL_TONE: Record<LeadStatus, { bg: string; fg: string }> = {
  new: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
  contacted: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  qualified: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
  won: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  lost: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  archived: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
};

export interface MyPipelineSummary {
  /** Lead counts by status for the signed-in sales rep. */
  counts: Partial<Record<LeadStatus, number>>;
  /** Leads whose next follow-up is already past schedule. */
  overdue: number;
  /** Follow-ups due before the end of the KL day. */
  dueToday: number;
}

interface MyPipelineCardsProps {
  summary: MyPipelineSummary;
  /** Signed-in rep's display name, for the heading. */
  ownerName?: string;
}

/**
 * Personal pipeline summary — the signed-in sales rep's own leads split by
 * status, plus the two queues that need action today (due / overdue). Each
 * card links to Lead Management pre-filtered to that status.
 */
export default function MyPipelineCards({ summary, ownerName }: MyPipelineCardsProps) {
  const { t } = useLang();
  const active = FUNNEL.filter((s) => s !== "won" && s !== "lost");
  const openTotal = active.reduce((sum, s) => sum + (summary.counts[s] ?? 0), 0);
  const won = summary.counts.won ?? 0;
  const lost = summary.counts.lost ?? 0;

  return (
    <section
      className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      aria-label={t("Ringkasan pipeline saya", "My pipeline summary")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 flex items-center gap-2 text-[14px] font-bold">
          <UserCircle2 className="h-4 w-4 text-[var(--color-primary)]" />
          {ownerName
            ? t(`Pipeline ${ownerName}`, `${ownerName}'s Pipeline`)
            : t("Pipeline Saya", "My Pipeline")}
        </h2>
        <Link
          to="/lead-management"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
        >
          {t("Urus lead", "Manage leads")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Open pipeline — one card per active status */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {FUNNEL.map((status) => {
          const count = summary.counts[status] ?? 0;
          const tone = FUNNEL_TONE[status];
          return (
            <Link
              key={status}
              to={`/lead-management?status=${status}`}
              className="group flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3.5 transition-colors hover:border-[var(--color-border-strong)]"
            >
              <span className="truncate text-[11.5px] font-semibold text-muted-foreground">
                {t(...STATUS_LABELS[status])}
              </span>
              <span
                className="font-display text-[22px] font-bold leading-tight [font-variant-numeric:tabular-nums]"
                style={{ color: tone.fg }}
              >
                {count}
              </span>
              <span className="inline-flex h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <span
                  className="h-full rounded-full transition-[width] group-hover:opacity-80"
                  style={{
                    width: `${openTotal ? Math.round((count / openTotal) * 100) : 0}%`,
                    background: tone.fg,
                  }}
                />
              </span>
            </Link>
          );
        })}
        <div className="col-span-2 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-[12px] text-muted-foreground sm:col-span-3 xl:col-span-5">
          <span>
            {t("Lead aktif", "Open leads")}: <strong className="text-foreground">{openTotal}</strong>
            {" · "}
            {t("Menang", "Won")}: <strong className="text-[var(--color-success)]">{won}</strong>
            {" · "}
            {t("Hilang", "Lost")}: <strong className="text-[var(--color-danger)]">{lost}</strong>
          </span>
          {won + lost > 0 && (
            <span className="tabular-nums">
              {t("Kadar menang", "Win rate")}: <strong className="text-foreground">{Math.round((won / (won + lost)) * 100)}%</strong>
            </span>
          )}
        </div>
      </div>

      {/* Action queues for today */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/followups"
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-card)] border p-3.5 transition-colors",
            summary.dueToday > 0
              ? "border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]"
              : "border-[var(--color-border)] bg-[var(--color-surface-raised)]",
          )}
        >
          <Inbox className="h-5 w-5 flex-none text-[var(--color-primary)]" />
          <div className="min-w-0">
            <p className="m-0 text-[12px] font-semibold text-muted-foreground">
              {t("Jatuh tempo hari ini", "Due today")}
            </p>
            <p className="m-0 font-display text-[18px] font-bold [font-variant-numeric:tabular-nums]">
              {summary.dueToday}
            </p>
          </div>
        </Link>
        <Link
          to="/followups"
          className={cn(
            "flex items-center gap-3 rounded-[var(--radius-card)] border p-3.5 transition-colors",
            summary.overdue > 0
              ? "border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]"
              : "border-[var(--color-border)] bg-[var(--color-surface-raised)]",
          )}
        >
          <Target className="h-5 w-5 flex-none text-[var(--color-danger)]" />
          <div className="min-w-0">
            <p className="m-0 text-[12px] font-semibold text-muted-foreground">
              {t("Tertunggak", "Overdue")}
            </p>
            <p className="m-0 font-display text-[18px] font-bold [font-variant-numeric:tabular-nums]">
              {summary.overdue}
            </p>
          </div>
        </Link>
      </div>
    </section>
  );
}

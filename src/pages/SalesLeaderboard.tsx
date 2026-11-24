import { useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  Crown,
  Medal,
  MessageCircle,
  Star,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { initialsOf } from "@/components/FollowupTaskRow";
import { crmAccessRole } from "@/pages/LeadManagement";
import MyPipelineCards from "@/components/MyPipelineCards";
import FollowupTrendCharts, { type TrendPoint } from "@/components/FollowupTrendCharts";
import {
  FollowupEmptyState,
  FollowupErrorState,
  FollowupLoading,
} from "@/components/FollowupStates";
import { useAdminUsers, useLeaderboard, useMySummary, useTrend } from "@/lib/useFollowup";
import type { RankedScore } from "@/lib/followup-api";

/**
 * Ranking period — the leaderboard is scoped to one window so scores are
 * comparable between sales reps. The server owns the window maths, the
 * scoring and the ranks; the page only renders what it returns.
 */
type Period = "week" | "month" | "all";

/** Trend window (in KL days) that matches each ranking period. */
function trendDaysFor(period: Period): number {
  if (period === "week") return 7;
  if (period === "month") return 30;
  return 90;
}

const RANK_ICON = [Crown, Medal, Star] as const;

export default function SalesLeaderboard() {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("month");
  /** Sales filter ("all" or a rep's user id). ADMIN only — narrows every query to one rep. */
  const [salesFilter, setSalesFilter] = useState<string>("all");
  const session = getSession();
  const accessRole = session ? crmAccessRole(session.role) : null;
  const isAdmin = accessRole === "ADMIN";

  // "all" means unscoped; the server still restricts SALES to their own data.
  const owner = salesFilter === "all" ? undefined : salesFilter;

  const leaderboard = useLeaderboard(period, owner);
  const trend = useTrend(trendDaysFor(period), owner);
  const summary = useMySummary(owner);
  const adminUsers = useAdminUsers();

  /** Reps allowed in the sales filter — sales-facing roles only. */
  const salesRepOptions = useMemo(
    () =>
      isAdmin
        ? (adminUsers.data ?? []).filter(
            (u) => u.role === "super_admin" || u.role === "management" || u.role === "sales",
          )
        : [],
    [isAdmin, adminUsers.data],
  );

  // Server-ranked scores — sorted by rank, never re-scored or re-scaled here.
  const rows = useMemo(
    () => [...(leaderboard.data?.scores ?? [])].sort((a, b) => a.rank - b.rank),
    [leaderboard.data],
  );

  const maxScore = rows[0]?.score ?? 1;
  const podium = rows.slice(0, 3);
  const totals = leaderboard.data?.totals ?? { completed: 0, uniqueLeads: 0, won: 0 };
  // "Active sales" = reps with at least one confirmed follow-up in the period.
  const activeSales = rows.length;

  /** Trend points in the chart's shape (API already returns one bucket per KL day). */
  const trendPoints = useMemo<TrendPoint[]>(
    () =>
      (trend.data?.trend ?? []).map((p) => ({
        date: p.date,
        followups: p.completed,
        uniqueLeads: p.uniqueLeads,
      })),
    [trend.data],
  );

  const periods: { value: Period; label: string }[] = [
    { value: "week", label: t("Minggu Ini", "This Week") },
    { value: "month", label: t("Bulan Ini", "This Month") },
    { value: "all", label: t("Keseluruhan", "All Time") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight">
            {t("Dashboard & Peringkat", "Dashboard & Leaderboard")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t(
              "Peringkat dikira daripada aktiviti unik — setiap lead dan setiap hari aktif dikira sekali sahaja.",
              "Rankings are based on unique activity — each lead and each active day counts only once.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              {t("Sales", "Sales")}
              <select
                value={salesFilter}
                onChange={(e) => setSalesFilter(e.target.value)}
                aria-label={t("Tapis mengikut sales", "Filter by sales")}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12.5px] font-semibold"
              >
                <option value="all">{t("Semua Sales", "All Sales")}</option>
                {salesRepOptions.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
          )}
          <div
            className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
            role="tablist"
            aria-label={t("Tempoh penilaian", "Ranking period")}
          >
            {periods.map((p) => (
              <button
                key={p.value}
                type="button"
                role="tab"
                aria-selected={period === p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  period === p.value
                    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          {isAdmin && salesFilter !== "all" && (
            <button
              type="button"
              onClick={() => setSalesFilter("all")}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:text-foreground"
            >
              {t("Buang penapis sales", "Clear sales filter")}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </header>

      {/* Personal pipeline — the signed-in rep's own leads first */}
      {summary.loading ? (
        <FollowupLoading />
      ) : summary.status === "error" ? (
        <FollowupErrorState message={summary.error ?? ""} onRetry={() => void summary.refetch()} />
      ) : summary.data ? (
        <MyPipelineCards
          summary={summary.data}
          ownerName={owner ? salesRepOptions.find((u) => u.id === owner)?.name ?? session?.name : session?.name}
        />
      ) : null}

      {leaderboard.loading ? (
        <FollowupLoading />
      ) : leaderboard.status === "error" ? (
        <FollowupErrorState message={leaderboard.error ?? ""} onRetry={() => void leaderboard.refetch()} />
      ) : rows.length === 0 ? (
        <FollowupEmptyState
          icon={Trophy}
          title={t("Tiada aktiviti lagi", "No activity yet")}
          description={t(
            "Papan peringkat akan dipaparkan setelah susulan direkodkan.",
            "The leaderboard will appear once follow-ups are recorded.",
          )}
        />
      ) : (
      <>

      {/* Summary — team totals for the selected period */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("Ringkasan pasukan", "Team summary")}>
        <SummaryCard icon={Users} label={t("Lead Unik Disusul", "Unique Leads Worked")} value={String(totals.uniqueLeads)} />
        <SummaryCard icon={CheckCircle2} label={t("Susulan Selesai", "Follow-Ups Done")} value={String(totals.completed)} />
        <SummaryCard icon={Trophy} label={t("Deal Dimenangi", "Deals Won")} value={String(totals.won)} />
        <SummaryCard icon={Award} label={t("Sales Aktif", "Active Sales")} value={String(activeSales)} />
      </section>

      {/* Trend + side-by-side comparison (honours the sales filter) */}
      {trend.loading ? (
        <FollowupLoading />
      ) : trend.status === "error" ? (
        <FollowupErrorState message={trend.error ?? ""} onRetry={() => void trend.refetch()} />
      ) : (
        <FollowupTrendCharts trend={trendPoints} scores={rows} days={trendDaysFor(period)} />
      )}

      {/* Podium — top 3 */}
      <section
        className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
        aria-label={t("Tiga Teratas", "Top 3")}
      >
        <h2 className="m-0 flex items-center gap-2 text-[14px] font-bold">
          <Trophy className="h-4 w-4 text-[var(--color-warning)]" />
          {t("Tiga Teratas", "Top 3")}
        </h2>
        {podium.length === 0 ? (
          <FollowupEmptyState
            compact
            icon={Trophy}
            title={t("Belum ada peringkat", "No rankings yet")}
            description={t(
              "Belum ada aktiviti susulan untuk tempoh ini. Peringkat muncul setelah sales mula menandakan susulan selesai.",
              "No follow-up activity for this period yet. Rankings appear once sales start marking follow-ups complete.",
            )}
          />
        ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {podium.map((r, i) => {
            const Icon = RANK_ICON[i];
            return (
              <div
                key={r.id}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[var(--radius-card)] border p-4 text-center",
                  i === 0
                    ? "border-[var(--color-warning)]/50 bg-[var(--color-warning-soft)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-raised)]",
                )}
              >
                <span
                  className={cn(
                    "grid h-12 w-12 place-items-center rounded-full text-[15px] font-bold",
                    i === 0
                      ? "bg-[var(--color-warning)] text-white"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-primary)]",
                  )}
                >
                  {initialsOf(r.name)}
                </span>
                <Icon
                  className={cn(
                    "h-5 w-5",
                    i === 0 ? "text-[var(--color-warning)]" : "text-muted-foreground",
                  )}
                />
                <p className="m-0 truncate text-[14px] font-bold">{r.name}</p>
                <p className="m-0 font-display text-[20px] font-bold [font-variant-numeric:tabular-nums]">
                  {r.score}
                </p>
                <p className="m-0 text-[11.5px] text-muted-foreground">
                  {t("Lead unik", "Unique leads")}: {r.uniqueLeads} · {t("Menang", "Won")}: {r.won}
                </p>
              </div>
            );
          })}
        </div>
        )}
      </section>

      {/* Full ranking table */}
      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
          <Crown className="h-4 w-4 text-[var(--color-warning)]" />
          <h2 className="m-0 text-[14px] font-bold">{t("Senarai Penuh", "Full Ranking")}</h2>
        </div>
        {rows.length === 0 ? (
          <FollowupEmptyState
            compact
            icon={Users}
            title={t("Tiada data untuk ditunjukkan", "Nothing to show")}
            description={
              owner
                ? t(
                    "Sales yang dipilih tiada aktiviti untuk tempoh ini.",
                    "The selected sales rep has no activity for this period.",
                  )
                : t(
                    "Belum ada aktiviti susulan direkodkan. Import lead dan mulakan susulan untuk mengisi papan peringkat.",
                    "No follow-up activity recorded yet. Import leads and start following up to fill the leaderboard.",
                  )
            }
          />
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-[var(--color-surface-raised)] text-left text-[11.5px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">{t("Kedudukan", "Rank")}</th>
                <th className="px-4 py-2.5 font-semibold">{t("Sales", "Sales")}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{t("Skor", "Score")}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{t("Lead Unik", "Unique Leads")}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{t("Hari Aktif", "Active Days")}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{t("Menang", "Won")}</th>
                <th className="px-4 py-2.5 text-right font-semibold">{t("Susulan Selesai", "Follow-Ups Done")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: RankedScore) => {
                const i = r.rank - 1;
                // Row ids are staff user ids, so the signed-in rep is matched by id.
                const isMe = Boolean(session && r.id === session.userId);
                return (
                <tr
                  key={r.id}
                  className={cn(
                    "border-t border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-raised)]",
                    isMe && "bg-[var(--color-primary-soft)] hover:bg-[var(--color-primary-soft)]",
                  )}
                >
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-grid h-6 w-6 place-items-center rounded-full text-[11.5px] font-bold",
                        i < 3
                          ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
                          : "bg-[var(--color-neutral-soft)] text-[var(--color-text-secondary)]",
                      )}
                    >
                      {r.rank}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--color-neutral-soft)] text-[11px] font-bold text-[var(--color-text-secondary)]">
                        {initialsOf(r.name)}
                      </span>
                      <span className="font-semibold">{r.name}</span>
                      {isMe && (
                        <span className="rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--color-on-primary)]">
                          {t("Anda", "You")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-surface-muted)] sm:block">
                        <div
                          className="h-full rounded-full bg-[var(--color-primary)]"
                          style={{ width: `${Math.round((r.score / maxScore) * 100)}%` }}
                        />
                      </div>
                      <span className="font-display font-bold [font-variant-numeric:tabular-nums]">{r.score}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right [font-variant-numeric:tabular-nums]">{r.uniqueLeads}</td>
                  <td className="px-4 py-2.5 text-right [font-variant-numeric:tabular-nums]">{r.activeDays}</td>
                  <td className="px-4 py-2.5 text-right [font-variant-numeric:tabular-nums]">{r.won}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground [font-variant-numeric:tabular-nums]">{r.completed}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
        <p className="m-0 flex items-start gap-1.5 border-t border-[var(--color-border)] px-4 py-2.5 text-[11.5px] text-muted-foreground">
          <MessageCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
          {t(
            "Skor = (lead unik × 10) + (hari aktif × 5) + (deal dimenangi × 25). Jumlah susulan selesai tidak dikira dalam skor supaya mengulang lead yang sama tidak menaikkan peringkat.",
            "Score = (unique leads × 10) + (active days × 5) + (deals won × 25). Total follow-ups done is not scored, so re-nudging the same lead does not raise a rank.",
          )}
        </p>
      </section>
      </>
      )}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-display text-[24px] font-bold leading-tight [font-variant-numeric:tabular-nums]">{value}</span>
    </div>
  );
}

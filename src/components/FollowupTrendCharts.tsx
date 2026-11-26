import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp, Users } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { initialsOf } from "@/components/FollowupTaskRow";
import type { RankedScore } from "@/lib/followup-api";

/** One day of team follow-up activity. */
export interface TrendPoint {
  /** Calendar date of the KL day (YYYY-MM-DD). */
  date: string;
  /** Follow-ups confirmed that day. */
  followups: number;
  /** Distinct leads touched that day. */
  uniqueLeads: number;
}

// Short weekday labels Mon→Sun in both UI languages, derived from the
// point's real date so the chart follows the active language.
const DAY_MS = ["Aha", "Isn", "Sel", "Rab", "Kha", "Jum", "Sab"];
const DAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * `date` is a KL calendar date (yyyy-mm-dd). Parsed as UTC midnight so the
 * weekday is stable regardless of the viewer's timezone.
 */
function weekdayIndexOf(date: string): number {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getUTCDay();
}

/** dd/mm label for the x-axis, also derived from the UTC-parsed date. */
function shortDateOf(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

interface FollowupTrendChartsProps {
  trend: TrendPoint[];
  /** Team scores used for the side-by-side comparison bars. */
  scores: RankedScore[];
  /** Number of days the trend covers — drives the heading (7 / 30 / 90). */
  days?: number;
}

/**
 * Trend + comparison charts for the Dashboard & Leaderboard page.
 *   Left  — daily line chart of follow-ups vs. unique leads.
 *   Right — horizontal comparison of each rep's unique-lead count.
 * Both read from unique-activity data so they agree with the ranking score.
 */
export default function FollowupTrendCharts({ trend, scores, days = 7 }: FollowupTrendChartsProps) {
  const { t, lang } = useLang();

  const trendData = useMemo(
    () =>
      trend.map((p) => ({
        ...p,
        label:
          days <= 7
            ? (lang === "ms" ? DAY_MS : DAY_EN)[weekdayIndexOf(p.date)]
            : shortDateOf(p.date),
      })),
    [trend, lang, days],
  );

  const compareData = useMemo(
    () =>
      [...scores]
        .sort((a, b) => b.leadsOwned - a.leadsOwned)
        .slice(0, 6)
        .map((s) => ({ name: s.name, short: initialsOf(s.name), leadsOwned: s.leadsOwned })),
    [scores],
  );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      {/* 7-day trend */}
      <section className="min-w-0 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="m-0 flex items-center gap-2 text-[14px] font-bold">
          <TrendingUp className="h-4 w-4 text-[var(--color-primary)]" />
          {days === 7
            ? t("Tren 7 Hari", "7-Day Trend")
            : days === 30
              ? t("Tren 30 Hari", "30-Day Trend")
              : t("Tren 90 Hari", "90-Day Trend")}
        </h2>
        <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
          {t(
            "Susulan selesai berbanding lead unik yang disentuh setiap hari.",
            "Follow-ups completed versus unique leads touched each day.",
          )}
        </p>
        {trendData.length === 0 ? (
          <div className="mt-3 flex h-[220px] flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground">
            <TrendingUp className="h-6 w-6 text-[var(--color-text-secondary)]" />
            <p className="m-0 text-[13px]">
              {t("Tiada aktiviti untuk tempoh ini.", "No activity for this period yet.")}
            </p>
          </div>
        ) : (
        <div className="mt-3 h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-border-strong)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  fontSize: 12,
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11.5 }}
              />
              <Line
                type="monotone"
                dataKey="followups"
                name={t("Susulan selesai", "Follow-ups done")}
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 0, fill: "var(--color-primary)" }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="uniqueLeads"
                name={t("Lead unik", "Unique leads")}
                stroke="var(--color-info)"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, strokeWidth: 0, fill: "var(--color-info)" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}
      </section>

      {/* Side-by-side comparison */}
      <section className="min-w-0 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="m-0 text-[14px] font-bold">{t("Perbandingan Lead", "Lead Comparison")}</h2>
        <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
          {t(
            "6 sales teratas mengikut bilangan lead yang dimiliki.",
            "Top 6 reps by leads owned.",
          )}
        </p>
        {compareData.length === 0 ? (
          <div className="mt-3 flex h-[220px] flex-col items-center justify-center gap-2 px-5 text-center text-muted-foreground">
            <Users className="h-6 w-6 text-[var(--color-text-secondary)]" />
            <p className="m-0 text-[13px]">
              {t(
                "Tiada sales dengan aktiviti untuk tempoh ini.",
                "No sales reps with activity for this period.",
              )}
            </p>
          </div>
        ) : (
        <div className="mt-3 h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compareData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
              />
              <YAxis
                dataKey="short"
                type="category"
                width={44}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--color-text-secondary)", fontSize: 11.5, fontWeight: 600 }}
              />
              <Tooltip
                cursor={{ fill: "var(--color-surface-muted)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  fontSize: 12,
                }}
              />
              <Bar dataKey="leadsOwned" name={t("Lead", "Leads")} radius={[0, 6, 6, 0]} barSize={18}>
                {compareData.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={i === 0 ? "var(--color-primary)" : "var(--color-info)"}
                    opacity={i === 0 ? 1 : 0.55 + 0.45 * (1 - i / Math.max(1, compareData.length - 1))}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </section>
    </div>
  );
}

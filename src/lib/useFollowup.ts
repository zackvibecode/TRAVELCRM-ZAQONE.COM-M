/**
 * Data hooks for the WhatsApp Follow-Up CRM pages.
 *
 * Each hook wraps one followupApi call with the loading / error / refetch
 * state every page needs, so pages stay declarative and consistent:
 *
 *   const { data, loading, error, refetch } = useFollowupQueue();
 *
 * A hook only re-fetches when its key arguments change (serialised), and
 * never sets state after unmount. `refresh()` re-runs the same query and is
 * what mutations call to keep the screen truthful after a change.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { followupApi, type FollowupLead, type FuReportRow, type LeadFacets, type MyPipelineSummary } from "@/lib/followup-api";

export type QueryStatus = "idle" | "loading" | "ready" | "error";

export interface Query<T> {
  data: T | null;
  status: QueryStatus;
  /** true only during the very first load (no data yet). */
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Generic read hook. `fetcher` must be a stable or memoised function; the
 * `key` string is what triggers a re-fetch when it changes.
 */
function useQuery<T>(key: string, fetcher: () => Promise<T>): Query<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    setStatus((s) => (s === "ready" ? s : "loading"));
    try {
      const result = await fetcherRef.current();
      setData(result);
      setStatus("ready");
      setError(null);
    } catch (err) {
      setError(messageOf(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setStatus((s) => (s === "ready" ? s : "loading"));
      try {
        const result = await fetcherRef.current();
        if (!alive) return;
        setData(result);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(messageOf(err));
        setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data,
    status,
    loading: status === "loading" || status === "idle",
    error,
    refetch: run,
  };
}

// ---------------------------------------------------------------------------
// Work queues
// ---------------------------------------------------------------------------

/** GET /today — today's tasks and the overdue queue in one call. */
export function useFollowupQueue(owner?: string): Query<{ today: FollowupLead[]; overdue: FollowupLead[]; window: { start: string; end: string }; timezone: string }> {
  return useQuery(`queue:${owner ?? ""}`, () => followupApi.today({ owner }));
}

/** GET /me/summary — the signed-in rep's pipeline numbers. */
export function useMySummary(owner?: string): Query<MyPipelineSummary> {
  return useQuery(`summary:${owner ?? ""}`, () => followupApi.mySummary({ owner }));
}

/** GET /leads with combined filters. */
export interface LeadFilters {
  q?: string;
  status?: string;
  stage?: string;
  fu?: string;
  state?: string;
  owner?: string;
}

export function useLeadList(filters: LeadFilters, limit = 50): Query<{ data: FollowupLead[]; paging: { limit: number; offset: number; count: number } }> {
  const key = `leads:${JSON.stringify(filters)}:${limit}`;
  return useQuery(key, () => followupApi.leads({ ...filters, limit }));
}

/** GET /leads/facets — counts that drive filter chips. */
export function useLeadFacets(owner?: string): Query<LeadFacets> {
  return useQuery(`facets:${owner ?? ""}`, () => followupApi.leadFacets({ owner }));
}

/** GET /report/fu — confirmed follow-ups completed per stage per staff. */
export function useFuReport(): Query<FuReportRow[]> {
  return useQuery("report-fu", () => followupApi.reportFu());
}

/** GET /leaderboard — team ranking for one period/owner. */
export function useLeaderboard(period: "week" | "month" | "all", owner?: string) {
  return useQuery(`lb:${period}:${owner ?? ""}`, () => followupApi.leaderboard({ period, owner }));
}

/** GET /leaderboard/trend — daily activity for the charts. */
export function useTrend(days: number, owner?: string) {
  return useQuery(`trend:${days}:${owner ?? ""}`, () => followupApi.trend({ days, owner }));
}

/** GET /templates — all template groups. */
export function useTemplates() {
  return useQuery("templates", () => followupApi.templates());
}

/** GET /admin/stages */
export function useStageRules() {
  return useQuery("stages", () => followupApi.stages());
}

/** GET /admin/users */
export function useAdminUsers() {
  return useQuery("admin-users", () => followupApi.adminUsers());
}

/** GET /admin/imports */
export function useAdminImports(status: "all" | "ok" | "partial" | "failed" = "all") {
  return useQuery(`admin-imports:${status}`, () => followupApi.adminImports({ status }));
}

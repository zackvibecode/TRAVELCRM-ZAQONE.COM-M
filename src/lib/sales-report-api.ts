import { apiFetch } from "@/lib/api";

/**
 * Sales Report API — monthly numbers, Team Mission targets and (via
 * lead-sources) the source breakdown. Scoping is server-enforced: sales
 * users always receive their own numbers.
 */

export type TargetMetric = "leads" | "followups" | "won" | "bookings" | "revenue";

export interface SalesOverview {
  month: string;
  ownerUserId: string | null;
  customers: number;
  bookings: number;
  revenue: number;
  newLeads: number;
  wonLeads: number;
  followups: number;
  sources: Array<{ sourceId: string | null; sourceName: string; count: number }>;
  daily: Array<{ day: string; leads: number; followups: number }>;
  previous: {
    customers: number;
    bookings: number;
    revenue: number;
    newLeads: number;
    wonLeads: number;
    followups: number;
  };
}

export interface SalesTarget {
  id: string;
  month: string;
  /** null = team-wide target. */
  userId: string | null;
  metric: TargetMetric;
  targetValue: number;
  createdBy: string | null;
  createdAt: string;
}

export interface LeadSource {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface LeadSourceSummaryRow {
  id: string;
  name: string;
  leads: number;
  won: number;
  winRatePct: number;
}

const BASE = "/sales-report";

export const salesReportApi = {
  overview: (month?: string, owner?: string) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (owner && owner !== "all") params.set("owner", owner);
    const qs = params.toString();
    return apiFetch<{ overview: SalesOverview }>(
      `${BASE}/overview${qs ? `?${qs}` : ""}`,
    ).then((r) => r.overview);
  },

  targets: (month?: string) => {
    const params = month ? `?month=${month}` : "";
    return apiFetch<{ targets: SalesTarget[]; month: string }>(
      `${BASE}/targets${params}`,
    ).then((r) => r);
  },

  createTarget: (body: {
    month: string;
    userId: string | null;
    metric: TargetMetric;
    targetValue: number;
  }) =>
    apiFetch<{ target: SalesTarget }>(`${BASE}/targets`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.target),

  updateTarget: (id: string, body: { metric?: TargetMetric; targetValue?: number }) =>
    apiFetch<{ target: SalesTarget }>(`${BASE}/targets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => r.target),

  deleteTarget: (id: string) =>
    apiFetch<{ success: boolean }>(`${BASE}/targets/${id}`, { method: "DELETE" }),
};

/** Lead sources list + per-source lead counts (different backend routes). */
export const leadSourceApi = {
  list: (includeInactive = false) =>
    apiFetch<{ data: LeadSource[] }>(
      `/lead-sources${includeInactive ? "?includeInactive=true" : ""}`,
    ).then((r) => r.data),

  create: (body: { name: string; description?: string; active?: boolean }) =>
    apiFetch<{ data: LeadSource }>("/lead-sources", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  update: (
    id: string,
    body: { name?: string; description?: string | null; active?: boolean },
  ) =>
    apiFetch<{ data: LeadSource }>(`/lead-sources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/lead-sources/${id}`, { method: "DELETE" }),
};

/** Percent change between current and previous month (guards divide-by-zero). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// ---------------------------------------------------------------------------
// Data hooks — same minimal Query pattern as useFollowup.ts.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from "react";

export type SalesQueryStatus = "idle" | "loading" | "ready" | "error";

export interface SalesQuery<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useSalesQuery<T>(key: string, fetcher: () => Promise<T>): SalesQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<SalesQueryStatus>("idle");
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
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    (async () => {
      try {
        const result = await fetcherRef.current();
        if (!alive) return;
        setData(result);
        setStatus("ready");
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
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
    loading: status === "loading" || status === "idle",
    error,
    refetch: run,
  };
}

/** GET /sales-report/overview for one month (and optional owner filter). */
export function useSalesOverview(month: string, owner?: string): SalesQuery<SalesOverview> {
  return useSalesQuery(`overview:${month}:${owner ?? ""}`, () =>
    salesReportApi.overview(month, owner),
  );
}

/** GET /sales-report/targets for one month. */
export function useSalesTargets(month: string): SalesQuery<{ targets: SalesTarget[]; month: string }> {
  return useSalesQuery(`targets:${month}`, () => salesReportApi.targets(month));
}

/** GET /lead-sources?includeInactive=true — for the CRUD list. */
export function useLeadSources(): SalesQuery<LeadSource[]> {
  return useSalesQuery("lead-sources", () => leadSourceApi.list(true));
}

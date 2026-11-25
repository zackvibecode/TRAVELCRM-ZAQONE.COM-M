import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Share Report API — sales submit their own entries (customer name, packs,
 * lead source). Dashboard numbers come from these entries, NOT from
 * follow-up/bookings. Scoping is server-enforced.
 */

export type TargetMetric = "customers" | "packs";

export interface ShareDashboard {
  month: string;
  ownerUserId: string | null;
  customers: number;
  packs: number;
  previous: { customers: number; packs: number };
  sources: Array<{ source: string; count: number }>;
  daily: Array<{ day: string; entries: number; packs: number }>;
  reps: Array<{ userId: string; userName: string; customers: number; packs: number }>;
}

export interface ShareEntry {
  id: string;
  month: string;
  userId: string;
  userName: string;
  customerName: string;
  packs: number;
  source: string;
  notes: string | null;
  createdAt: string;
}

export interface SalesTarget {
  id: string;
  month: string;
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

export const shareReportApi = {
  dashboard: (month?: string, owner?: string) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (owner && owner !== "all") params.set("owner", owner);
    const qs = params.toString();
    return apiFetch<{ dashboard: ShareDashboard }>(
      `/share-report/dashboard${qs ? `?${qs}` : ""}`,
    ).then((r) => r.dashboard);
  },

  entries: (month?: string, owner?: string) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (owner && owner !== "all") params.set("owner", owner);
    const qs = params.toString();
    return apiFetch<{ entries: ShareEntry[] }>(
      `/share-report/entries${qs ? `?${qs}` : ""}`,
    ).then((r) => r.entries);
  },

  createEntry: (body: {
    month: string;
    customerName: string;
    packs: number;
    source?: string;
    notes?: string;
  }) =>
    apiFetch<{ entry: ShareEntry }>("/share-report/entries", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.entry),

  updateEntry: (
    id: string,
    body: { customerName?: string; packs?: number; source?: string; notes?: string },
  ) =>
    apiFetch<{ entry: ShareEntry }>(`/share-report/entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => r.entry),

  deleteEntry: (id: string) =>
    apiFetch<{ success: boolean }>(`/share-report/entries/${id}`, { method: "DELETE" }),
};

export const salesReportApi = {
  targets: (month?: string) => {
    const params = month ? `?month=${month}` : "";
    return apiFetch<{ targets: SalesTarget[]; month: string }>(
      `/sales-report/targets${params}`,
    ).then((r) => r);
  },
  createTarget: (body: {
    month: string;
    userId: string | null;
    metric: TargetMetric;
    targetValue: number;
  }) =>
    apiFetch<{ target: SalesTarget }>("/sales-report/targets", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.target),
  updateTarget: (id: string, body: { metric?: TargetMetric; targetValue?: number }) =>
    apiFetch<{ target: SalesTarget }>(`/sales-report/targets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => r.target),
  deleteTarget: (id: string) =>
    apiFetch<{ success: boolean }>(`/sales-report/targets/${id}`, { method: "DELETE" }),
};

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
// Data hooks — minimal Query pattern (same style as useFollowup.ts).
// ---------------------------------------------------------------------------

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

export function useShareDashboard(month: string, owner?: string): SalesQuery<ShareDashboard> {
  return useSalesQuery(`share-dashboard:${month}:${owner ?? ""}`, () =>
    shareReportApi.dashboard(month, owner),
  );
}

export function useShareEntries(month: string, owner?: string): SalesQuery<ShareEntry[]> {
  return useSalesQuery(`share-entries:${month}:${owner ?? ""}`, () =>
    shareReportApi.entries(month, owner),
  );
}

export function useSalesTargets(month: string): SalesQuery<{ targets: SalesTarget[]; month: string }> {
  return useSalesQuery(`targets:${month}`, () => salesReportApi.targets(month));
}

export function useLeadSources(): SalesQuery<LeadSource[]> {
  return useSalesQuery("lead-sources", () => leadSourceApi.list(true));
}

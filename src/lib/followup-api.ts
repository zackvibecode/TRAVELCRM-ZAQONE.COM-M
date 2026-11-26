/**
 * Typed client for the /api/followup/* domain (WhatsApp Follow-Up CRM).
 *
 * All functions go through apiFetch (cookie + bearer auth). Response
 * shapes mirror the Hono handlers so the pages never guess a field name.
 * Every function throws on non-2xx with the server's error message, so
 * pages can show a single, honest error state.
 */
import { apiFetch } from "@/lib/api";
import { API_BASE_URL } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/** Envelope every /api/followup handler returns on success. */
interface Ok<T> {
  success: true;
  data: T;
}

/** Caller's CRM role — single source of truth for ownership rules. */
export type FollowupAccess = "ADMIN" | "SALES";

export interface MeResponse {
  access: FollowupAccess;
  staff: { id: string; name: string; email: string; role: string };
}

/** Pipeline stage as the CRM stores it. */
export const FOLLOWUP_STAGES = ["FU1", "FU2", "FU3"] as const;
export type FollowupStage = (typeof FOLLOWUP_STAGES)[number];

export const FOLLOWUP_STATES = ["active", "paused", "done", "escalated"] as const;
export type FollowupState = (typeof FOLLOWUP_STATES)[number];

export const FOLLOWUP_STATUSES = ["new", "responded", "won", "lost", "paused"] as const;
export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

/** A lead row as returned by GET /leads (full DB row). */
export interface FollowupLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  destination: string | null;
  pax: number;
  budget: number;
  stage: "new" | "contacted" | "qualified" | "quotation" | "won" | "lost";
  sourceId: string | null;
  assignedTo: string | null;
  nextFollowUp: string | null;
  lastActivityAt: string | null;
  notes: string | null;
  customerId: string | null;
  ownerUserId: string;
  followupStatus: FollowupStatus | null;
  followupState: FollowupState | null;
  nextFollowupAt: string | null;
  followupStage: FollowupStage | null;
  followupStageAt: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  escalatedAt: string | null;
  lastContactedAt: string | null;
  followupCompletedAt: string | null;
  phoneNormalized: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LeadListResponse {
  data: FollowupLead[];
  paging: { limit: number; offset: number; count: number; total?: number };
}

/** `byOwner` as the server serialises it — keyed by owner user id. */
export type LeadFacetsByOwner = Record<string, { count: number; name: string }>;

export interface LeadFacets {
  total: number;
  byFollowupStatus: Record<string, number>;
  byStage: Record<string, number>;
  byOwner: { id: string; name: string; count: number }[];
  byFu?: Record<string, number>;
  byState?: Record<string, number>;
}

/** Server-side wire shape of GET /leads/facets (byOwner keyed by user id). */
interface LeadFacetsWire extends Omit<LeadFacets, "byOwner"> {
  byOwner: LeadFacetsByOwner;
}

/** Flattens the keyed `byOwner` map into the list shape the UI consumes. */
function normalizeFacets(w: LeadFacetsWire): LeadFacets {
  return {
    ...w,
    byOwner: Object.entries(w.byOwner ?? {}).map(([id, v]) => ({ id, name: v.name, count: v.count })),
  };
}

/** One confirmed follow-up count row from GET /report/fu. */
export interface FuReportRow {
  userId: string;
  name: string;
  stage: "FU1" | "FU2" | "FU3";
  count: number;
}

/** One timeline entry from GET /leads/:id/history. */
export interface TimelineEntry {
  id: string;
  leadId: string;
  stage?: string;
  type: string;
  text: string;
  confirmed?: boolean;
  user: string;
  at: string;
}

export interface LeadHistory {
  activities: TimelineEntry[];
  notes: { id: string; leadId: string; text: string; createdBy: string; createdAt: string }[];
  timeline: TimelineEntry[];
}

export const PIPELINE_STAGES = ["new", "contacted", "qualified", "won", "lost", "archived"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface MyPipelineSummary {
  /** Lead count per pipeline stage; stages with 0 leads are omitted. */
  counts: Partial<Record<PipelineStage, number>>;
  overdue: number;
  dueToday: number;
  total: number;
  ownerUserId: string;
  window: { start: string; end: string };
  timezone: string;
}

export interface SalesScore {
  id: string;
  name: string;
  /** Total confirmed follow-ups (FU1 + FU2 + FU3). */
  completed: number;
  /** Confirmed FU1 follow-ups. */
  fu1: number;
  /** Confirmed FU2 follow-ups. */
  fu2: number;
  /** Confirmed FU3 follow-ups. */
  fu3: number;
  uniqueLeads: number;
  activeDays: number;
  won: number;
  /** Total leads currently owned by this rep, across every stage. */
  leadsOwned: number;
}

export interface RankedScore extends SalesScore {
  rank: number;
}

export interface LeaderboardResponse {
  period: string;
  scores: RankedScore[];
  totals: { completed: number; uniqueLeads: number; won: number; leadsOwned: number; fu1: number; fu2: number; fu3: number } | null;
  previous: { completed: number; uniqueLeads: number; won: number; leadsOwned: number; fu1: number; fu2: number; fu3: number } | null;
  window: { from: string; to: string } | null;
  previousWindow: { from: string; to: string } | null;
  today: { start: string; end: string };
  timezone: string;
  scope: { scoped: boolean; ownerUserId: string | null };
}

export interface TrendResponse {
  days: number;
  trend: { date: string; completed: number; uniqueLeads: number }[];
  timezone: string;
  window: { from: string | null; to: string | null };
  scope: { scoped: boolean; ownerUserId: string | null };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface TemplateVariant {
  id: string;
  body: string;
  updatedAt: string;
}

/** One logical template (code) with its EN and MS variants. */
export interface TemplateGroup {
  code: string;
  name: string;
  stage: string | null;
  active: boolean;
  updatedAt: string;
  variants: { en?: TemplateVariant; ms?: TemplateVariant };
}

export interface TemplatePayload {
  code?: string;
  name: string;
  stage?: string | null;
  active?: boolean;
  enBody: string;
  msBody: string;
}

export interface TemplatePreview {
  leadId: string;
  code: string;
  locale: "en" | "ms";
  name: string;
  stage: string | null;
  body: string;
  missing: string[];
  packageName: string;
  length: number;
  limit: number;
  tooLong: boolean;
  phone: string;
  phoneDigits: string;
  phoneError: string | null;
  waUrl: string | null;
}

// ---------------------------------------------------------------------------
// Admin console
// ---------------------------------------------------------------------------

export interface StageRule {
  stage: FollowupStage;
  daysAfterPrevious: number;
  dueHourKL: number;
  active: boolean;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "management" | "sales" | "finance" | "operations";
  active: boolean;
  status: "active" | "pending" | "suspended";
  openLeads: number;
}

export interface AdminImportBatch {
  id: string;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  failedRows: number;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  errors: { id: string; rowNumber: number; reason: string; raw: Record<string, unknown> }[];
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const BASE = "/api/followup";

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * GET /leads/export streams the file directly (Content-Disposition), so this
 * is a plain navigation rather than an apiFetch. Only q / status / owner /
 * stage are supported server-side. API_BASE_URL is prefixed so the download
 * hits the Worker when the frontend is served from another origin.
 */
export function exportLeads(
  filters: { q?: string; status?: string; owner?: string; stage?: string },
  format: "csv" | "xlsx" = "csv",
): void {
  const url = `${API_BASE_URL}${BASE}/leads/export${qs({ ...filters, format })}`;
  window.open(url, "_blank");
}

export const followupApi = {
  // Identity -----------------------------------------------------------------
  me: () => apiFetch<Ok<MeResponse>>(`${BASE}/me`).then((r) => r.data),

  // Leads --------------------------------------------------------------------
  leads: (params: {
    q?: string;
    status?: string;
    stage?: string;
    fu?: string;
    state?: string;
    owner?: string;
    limit?: number;
    offset?: number;
  } = {}) =>
    apiFetch<LeadListResponse>(`${BASE}/leads${qs(params)}`).then((r) => ({
      data: r.data,
      paging: r.paging,
    })),

  leadFacets: (params: { owner?: string } = {}) =>
    apiFetch<Ok<LeadFacetsWire>>(`${BASE}/leads/facets${qs(params)}`).then((r) => normalizeFacets(r.data)),

  /** GET /leads/all-ids — every visible lead id matching the filters (max 5000). */
  leadAllIds: (params: { q?: string; status?: string; owner?: string; stage?: string; fu?: string; state?: string } = {}) =>
    apiFetch<Ok<string[]> & { count: number }>(`${BASE}/leads/all-ids${qs(params)}`).then((r) => r.data),

  /** GET /report/fu — confirmed follow-ups completed per stage per staff. */
  reportFu: () => apiFetch<Ok<FuReportRow[]>>(`${BASE}/report/fu`).then((r) => r.data),

  /** GET /leads/:id returns `{ lead, activities, notes }`; we unwrap the row. */
  lead: (id: string) =>
    apiFetch<Ok<{ lead: FollowupLead; activities: unknown[]; notes: unknown[] }>>(`${BASE}/leads/${id}`).then(
      (r) => r.data.lead,
    ),

  leadHistory: (id: string) => apiFetch<Ok<LeadHistory>>(`${BASE}/leads/${id}/history`).then((r) => r.data),

  /** DELETE /leads/:id — hard delete. Management/Admin only (403 for sales). */
  deleteLead: (id: string) =>
    apiFetch<Ok<{ id: string }>>(`${BASE}/leads/${id}`, { method: "DELETE" }).then((r) => r.data),

  complete: (id: string, body: { stage: FollowupStage; note?: string } = { stage: "FU1" }) =>
    apiFetch<Ok<{ leadId: string; stage: string; nextStage: string | null; nextFollowupAt: string | null }>>(
      `${BASE}/leads/${id}/complete`,
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.data),

  postpone: (id: string, body: { to: string; reason?: string }) =>
    apiFetch<Ok<{ leadId: string; nextFollowupAt: string }>>(`${BASE}/leads/${id}/postpone`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  pause: (id: string, body: { reason: string }) =>
    apiFetch<Ok<{ leadId: string; followupState: string }>>(`${BASE}/leads/${id}/pause`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  transfer: (id: string, body: { ownerUserId: string; reason?: string }) =>
    apiFetch<Ok<{ leadId: string; ownerUserId: string }>>(`${BASE}/leads/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  addNote: (id: string, text: string) =>
    apiFetch<Ok<{ id: string; leadId: string; text: string; createdBy: string; createdAt: string }>>(
      `${BASE}/leads/${id}/notes`,
      { method: "POST", body: JSON.stringify({ text }) },
    ).then((r) => r.data),

  bulk: (body: { ids: string[]; action: "status" | "archive"; status?: string }) =>
    apiFetch<Ok<{ requested: number; updated: number; skipped: number; action: string; status: string | null }>>(`${BASE}/leads/bulk`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  /** POST /leads/bulk-delete — hard delete many leads (ADMIN only). */
  bulkDeleteLeads: (ids: string[]) =>
    apiFetch<Ok<{ requested: number; deleted: number }>>(`${BASE}/leads/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ ids }),
    }).then((r) => r.data),

  /** ADMIN-only closure of an escalated lead. */
  review: (id: string, body: { outcome: "won" | "lost" | "handover"; note?: string }) =>
    apiFetch<Ok<{ leadId: string; outcome: string }>>(`${BASE}/leads/${id}/review`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  // Work queues --------------------------------------------------------------
  today: (params: { owner?: string } = {}) =>
    apiFetch<
      Ok<{ today: FollowupLead[]; overdue: FollowupLead[]; window: { start: string; end: string }; timezone: string }>
    >(`${BASE}/today${qs(params)}`).then((r) => r.data),

  overdue: (params: { owner?: string } = {}) =>
    apiFetch<
      Ok<{
        queue: { daysLate: number; count: number; leads: FollowupLead[] }[];
        totalOverdue: number;
        boundary: string;
        window: { start: string; end: string };
        timezone: string;
      }>
    >(`${BASE}/overdue${qs(params)}`).then((r) => r.data),

  mySummary: (params: { owner?: string } = {}) =>
    apiFetch<Ok<MyPipelineSummary>>(`${BASE}/me/summary${qs(params)}`).then((r) => r.data),

  leaderboard: (params: { period?: "week" | "month" | "all"; owner?: string } = {}) =>
    apiFetch<Ok<LeaderboardResponse>>(`${BASE}/leaderboard${qs(params)}`).then((r) => r.data),

  trend: (params: { days?: number; owner?: string } = {}) =>
    apiFetch<Ok<TrendResponse>>(`${BASE}/leaderboard/trend${qs(params)}`).then((r) => r.data),

  // Templates ----------------------------------------------------------------
  templates: (params: { stage?: string; active?: "1" } = {}) =>
    apiFetch<Ok<TemplateGroup[]>>(`${BASE}/templates${qs(params)}`).then((r) => r.data),

  template: (code: string) => apiFetch<Ok<TemplateGroup>>(`${BASE}/templates/${code}`).then((r) => r.data),

  createTemplate: (body: TemplatePayload) =>
    apiFetch<Ok<TemplateGroup>>(`${BASE}/templates`, { method: "POST", body: JSON.stringify(body) }).then((r) => r.data),

  updateTemplate: (code: string, body: Partial<TemplatePayload>) =>
    apiFetch<Ok<TemplateGroup>>(`${BASE}/templates/${code}`, { method: "PUT", body: JSON.stringify(body) }).then(
      (r) => r.data,
    ),

  toggleTemplate: (code: string, active: boolean) =>
    apiFetch<Ok<{ code: string; active: boolean }>>(`${BASE}/templates/${code}/toggle`, {
      method: "POST",
      body: JSON.stringify({ active }),
    }).then((r) => r.data),

  previewTemplate: (body: { leadId: string; code: string; locale?: "en" | "ms"; dateMs?: number }) =>
    apiFetch<Ok<TemplatePreview>>(`${BASE}/templates/preview`, {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  // Admin console ------------------------------------------------------------
  stages: () => apiFetch<Ok<StageRule[]>>(`${BASE}/admin/stages`).then((r) => r.data),

  saveStages: (rules: StageRule[]) =>
    apiFetch<Ok<StageRule[]>>(`${BASE}/admin/stages`, { method: "PUT", body: JSON.stringify(rules) }).then(
      (r) => r.data,
    ),

  adminUsers: () => apiFetch<Ok<AdminUser[]>>(`${BASE}/admin/users`).then((r) => r.data),

  updateUser: (id: string, body: { role?: string; active?: boolean }) =>
    apiFetch<Ok<{ id: string; role: string; active: boolean }>>(`${BASE}/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => r.data),

  adminImports: (params: { status?: "all" | "ok" | "partial" | "failed"; limit?: number } = {}) =>
    apiFetch<Ok<AdminImportBatch[]>>(`${BASE}/admin/imports${qs(params)}`).then((r) => r.data),

  // Import (used by LeadImport page) ---------------------------------------
  importBatches: () =>
    apiFetch<Ok<AdminImportBatch[]>>(`${BASE}/import/batches`).then((r) => r.data),

  /** POST /import/parse — server-side CSV parse + mapping validation (multipart). */
  importParse: (file: File, mapping?: Partial<Record<"name" | "phone" | "destination" | "pax", number>>) => {
    const form = new FormData();
    form.append("file", file);
    if (mapping) form.append("mapping", JSON.stringify(mapping));
    return apiFetch<
      Ok<{
        fileName: string;
        totalRows: number;
        headers: string[];
        autoMapping: Record<string, number>;
        mapping: Record<string, number>;
        mappingValid: boolean;
        missingColumns: string[];
        rows: {
          rowNo: number;
          name: string;
          phoneRaw: string;
          phoneNormalized: string;
          destination: string;
          pax: number;
          problems: string[];
          duplicate: boolean;
        }[];
      }>
    >(`${BASE}/import/parse`, { method: "POST", body: form }).then((r) => r.data);
  },

  /** POST /import/commit — insert clean rows, record the batch summary (multipart). */
  importCommit: (file: File, mapping?: Partial<Record<"name" | "phone" | "destination" | "pax", number>>, ownerUserId?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (mapping) form.append("mapping", JSON.stringify(mapping));
    if (ownerUserId) form.append("ownerUserId", ownerUserId);
    return apiFetch<
      Ok<{
        batchId: string;
        fileName: string;
        totalRows: number;
        insertedRows: number;
        duplicateRows: number;
        failedRows: number;
        ownerUserId: string;
        duplicates: { rowNo: number; reason: string }[];
        failed: { rowNo: number; reason: string; name: string; phoneRaw: string }[];
      }>
    >(`${BASE}/import/commit`, { method: "POST", body: form }).then((r) => r.data);
  },

  /** POST /import/batches/:id/retry — re-import corrected failed rows. */
  importRetry: (batchId: string, rows: { rowNumber: number; name: string; phone: string }[]) =>
    apiFetch<Ok<{ batchId: string; retried: number; inserted: number; stillFailing: { rowNumber: number; reason: string }[] }>>(
      `${BASE}/import/batches/${batchId}/retry`,
      { method: "POST", body: JSON.stringify({ rows }) },
    ).then((r) => r.data),

  /** DELETE /import/batches/:id — remove an import batch and its error rows. */
  deleteImportBatch: (batchId: string) =>
    apiFetch<Ok<{ id: string }>>(`${BASE}/import/batches/${batchId}`, { method: "DELETE" }).then((r) => r.data),
};

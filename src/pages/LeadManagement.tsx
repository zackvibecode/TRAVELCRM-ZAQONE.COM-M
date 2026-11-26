import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Search,
  ShieldCheck,
  UserCircle2,
  UsersRound,
  X,
} from "lucide-react";
import { cn, parseDbDate } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { initialsOf } from "@/components/FollowupTaskRow";
import {
  FollowupEmptyState,
  FollowupErrorState,
  FollowupLoading,
} from "@/components/FollowupStates";
import { exportLeads, followupApi, type FollowupLead, type LeadFacets } from "@/lib/followup-api";
import { useLeadFacets, useLeadList, type LeadFilters } from "@/lib/useFollowup";

/**
 * Plan-level role mapping: super_admin/management act as ADMIN, sales as
 * SALES. One login, no second auth system (per the plan idea).
 */
export type CrmAccessRole = "ADMIN" | "SALES";

export function crmAccessRole(
  role: "super_admin" | "management" | "sales" | "finance" | "operations",
): CrmAccessRole | null {
  if (role === "super_admin" || role === "management") return "ADMIN";
  if (role === "sales") return "SALES";
  return null;
}

/**
 * Sales-pipeline stage per the roadmap: new / contacted / qualified / won /
 * lost / archived. This is the `stage` column on GET /leads. It is distinct
 * from `followupStatus` (new / responded / won / lost / paused), which tracks
 * the WhatsApp follow-up sequence and is what the bulk-status action sets.
 */
export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "won"
  | "lost"
  | "archived";

const STATUS_LABELS: Record<LeadStatus, [string, string]> = {
  new: ["Baharu", "New"],
  contacted: ["Dihubungi", "Contacted"],
  qualified: ["Layak", "Qualified"],
  won: ["Menang", "Won"],
  lost: ["Hilang", "Lost"],
  archived: ["Diarkibkan", "Archived"],
};
export { STATUS_LABELS };

/** Follow-up sequence status (`followup_status`) used by the bulk actions. */
export type FollowupStatusLabel = "new" | "responded" | "won" | "lost" | "paused";

const FOLLOWUP_STATUS_LABELS: Record<FollowupStatusLabel, [string, string]> = {
  new: ["Baharu", "New"],
  responded: ["Dijawab", "Responded"],
  won: ["Menang", "Won"],
  lost: ["Hilang", "Lost"],
  paused: ["Dijeda", "Paused"],
};

/** Formats a date-ish string for display in the Asia/Kuala_Lumpur zone. */
export function formatKlDate(value: string): string {
  const date = parseDbDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(date);
}

const STATUS_TONES: Record<LeadStatus, { bg: string; fg: string }> = {
  new: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
  contacted: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  qualified: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
  won: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  lost: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  archived: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
};

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 350;

/** Stage values the API can return that the UI has no label for. */
const EXTRA_STAGE_LABELS: Record<string, [string, string]> = {
  quotation: ["Sebut Harga", "Quotation"],
};

const STATE_LABELS: Record<string, [string, string]> = {
  active: ["Aktif", "Active"],
  paused: ["Dijeda", "Paused"],
  done: ["Selesai", "Done"],
  escalated: ["Dinaikkan", "Escalated"],
};

function stageLabel(stage: string): [string, string] {
  if (stage in STATUS_LABELS) return STATUS_LABELS[stage as LeadStatus];
  return EXTRA_STAGE_LABELS[stage] ?? [stage, stage];
}

function stageTone(stage: string): { bg: string; fg: string } {
  if (stage in STATUS_TONES) return STATUS_TONES[stage as LeadStatus];
  return { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" };
}

/** True when the row belongs to the signed-in sales rep (or they are ADMIN). */
function canActOn(lead: FollowupLead, accessRole: CrmAccessRole | null, userId: string | undefined): boolean {
  if (accessRole === "ADMIN") return true;
  return accessRole === "SALES" && lead.ownerUserId === userId;
}

export default function LeadManagement() {
  const { t, lang } = useLang();
  const session = getSession();
  const accessRole = session ? crmAccessRole(session.role) : null;
  const isAdmin = accessRole === "ADMIN";

  // Initial stage filter may arrive via ?status= (e.g. from the pipeline cards).
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status");

  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>(
    initialStatus && initialStatus in STATUS_LABELS ? initialStatus : "all",
  );
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [offset, setOffset] = useState(0);
  /** Bulk selection: ids of leads the current user may act on. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Debounce the search box so we do not fire a request per keystroke.
  useEffect(() => {
    const handle = window.setTimeout(() => setQuery(queryInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [queryInput]);

  const filters: LeadFilters = useMemo(
    () => ({
      ...(query ? { q: query } : {}),
      ...(stageFilter !== "all" ? { stage: stageFilter } : {}),
      ...(isAdmin && ownerFilter !== "all" ? { owner: ownerFilter } : {}),
    }),
    [query, stageFilter, isAdmin, ownerFilter],
  );

  const leadsQuery = useLeadList(filters, PAGE_SIZE);
  // useLeadList has no offset parameter, so page 2+ is fetched directly.
  const [extraRows, setExtraRows] = useState<FollowupLead[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  /** Reset paging whenever a filter changes. */
  useEffect(() => {
    setOffset(0);
    setExtraRows([]);
    setSelected(new Set());
    setAllMode(false);
  }, [filters]);

  // Facets are always fetched for the user's full visible scope (not narrowed
  // by the owner filter) so the owner dropdown and the summary cards keep
  // showing every owner / every lead, matching the metric cards' semantics.
  const facetsQuery = useLeadFacets();

  const rows = useMemo(() => leadsQuery.data?.data ?? [], [leadsQuery.data]);
  const visible = offset === 0 ? rows : extraRows;
  const facets: LeadFacets | null = facetsQuery.data;

  /** Owner display names — resolved from facets (ADMIN) or the session. */
  const ownerNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of facets?.byOwner ?? []) map.set(o.id, o.name);
    return map;
  }, [facets]);

  const owners = useMemo(() => facets?.byOwner ?? [], [facets]);

  function ownerNameOf(lead: FollowupLead): string {
    if (!isAdmin) return session?.name ?? "";
    return ownerNames.get(lead.ownerUserId) ?? lead.ownerUserId;
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  const selectable = useMemo(
    () => visible.filter((l) => canActOn(l, accessRole, session?.userId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, accessRole, session],
  );
  const allSelected = selectable.length > 0 && selectable.every((l) => selected.has(l.id));
  // Select-all scope: when "all matching" mode is on, the selection targets
  // every visible lead matching the current filters (up to 5000), not just
  // the rows rendered on this page.
  const [allMode, setAllMode] = useState(false);

  function toggleRow(id: string) {
    setAllMode(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allMode) {
      // Collapse back to the current page selection.
      setAllMode(false);
      setSelected(new Set(selectable.map((l) => l.id)));
      return;
    }
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectable.map((l) => l.id)));
    // "All matching" extends the selection beyond the visible 25 rows. The
    // server scopes SALES to their own leads, so this is safe for every role.
    void followupApi
      .leadAllIds({
        ...(query ? { q: query } : {}),
        ...(stageFilter !== "all" ? { stage: stageFilter } : {}),
        ...(ownerFilter !== "all" ? { owner: ownerFilter } : {}),
      })
      .then((ids) => {
        if (ids.length > selectable.length) {
          setAllMode(true);
          setSelected(new Set(ids));
        }
      })
      .catch(() => {
        // Fall back silently to page-scoped selection.
      });
  }

  function clearAllFilters() {
    setQueryInput("");
    setStageFilter("all");
    setOwnerFilter("all");
  }

  /** Bulk action goes through a confirm dialog, then reports a summary. */
  const [pendingBulk, setPendingBulk] = useState<{ action: "status" | "archive" | "delete"; status?: FollowupStatusLabel } | null>(null);
  /** Bulk delete is a two-step confirm: step 1 warns, step 2 asks to type PADAM. */
  const [bulkDeleteStep, setBulkDeleteStep] = useState<1 | 2>(1);
  const [bulkDeletePhrase, setBulkDeletePhrase] = useState("");
  const [bulkResult, setBulkResult] = useState<{ updated: number; skipped: number; label: string } | null>(null);
  /** Hard-delete confirm dialog (single lead): step 1 warns, step 2 asks to type PADAM. */
  const [pendingDelete, setPendingDelete] = useState<FollowupLead | null>(null);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deletePhrase, setDeletePhrase] = useState("");

  /** Opens the delete dialog — always at step 1 with an empty phrase. */
  function askDelete(lead: FollowupLead) {
    setPendingDelete(lead);
    setDeleteStep(1);
    setDeletePhrase("");
  }

  /** Closes the delete dialog and resets its step state. */
  function closeDelete() {
    if (busy) return;
    setPendingDelete(null);
    setDeleteStep(1);
    setDeletePhrase("");
  }

  /** Export dialog: CSV or XLSX of the rows matching the current filters. */
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");

  function bulkLabel(target: { action: "status" | "archive" | "delete"; status?: FollowupStatusLabel }): string {
    if (target.action === "archive") return t("Diarkibkan", "Archived");
    if (target.action === "delete") return t("Dipadam", "Deleted");
    return t(...FOLLOWUP_STATUS_LABELS[target.status ?? "new"]);
  }

  /** Selection is scoped to the current page; pages beyond the first are
   *  fetched directly because useLeadList has no offset parameter. */
  async function loadMore() {
    if (!leadsQuery.data) return;
    const nextOffset = offset + leadsQuery.data.paging.limit;
    setLoadingMore(true);
    try {
      const res = await followupApi.leads({ ...filters, limit: PAGE_SIZE, offset: nextOffset });
      setExtraRows(res.data);
      setOffset(nextOffset);
      setSelected(new Set());
    } catch (err) {
      showNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmBulk() {
    if (!pendingBulk || selected.size === 0) return;
    setBusy(true);
    try {
      if (pendingBulk.action === "delete") {
        // Set-based hard delete via the dedicated bulk-delete endpoint.
        const ids = [...selected];
        let done = 0;
        for (let i = 0; i < ids.length; i += 2000) {
          const res = await followupApi.bulkDeleteLeads(ids.slice(i, i + 2000));
          done += res.deleted;
        }
        setBulkResult({ updated: done, skipped: selected.size - done, label: bulkLabel(pendingBulk) });
      } else {
        const res = await followupApi.bulk({
          ids: [...selected],
          action: pendingBulk.action,
          ...(pendingBulk.action === "status" ? { status: pendingBulk.status } : {}),
        });
        const label = bulkLabel(pendingBulk);
        setBulkResult({ updated: res.updated, skipped: res.skipped, label });
      }
      setSelected(new Set());
      setAllMode(false);
      setOffset(0);
      setExtraRows([]);
      await Promise.all([leadsQuery.refetch(), facetsQuery.refetch()]);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingBulk(null);
      setBulkDeleteStep(1);
      setBulkDeletePhrase("");
      setBusy(false);
    }
  }

  /** Confirm + hard delete a single lead from its row. */
  async function confirmDeleteOne() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await followupApi.deleteLead(pendingDelete.id);
      showNotice(t(`Lead "${pendingDelete.name}" dipadam.`, `Lead "${pendingDelete.name}" deleted.`));
      setPendingDelete(null);
      setDeleteStep(1);
      setDeletePhrase("");
      setOffset(0);
      setExtraRows([]);
      await Promise.all([leadsQuery.refetch(), facetsQuery.refetch()]);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : String(err));
      setPendingDelete(null);
      setDeleteStep(1);
      setDeletePhrase("");
    } finally {
      setBusy(false);
    }
  }

  function doExport() {
    exportLeads(
      {
        ...(query ? { q: query } : {}),
        ...(stageFilter !== "all" ? { stage: stageFilter } : {}),
        ...(isAdmin && ownerFilter !== "all" ? { owner: ownerFilter } : {}),
      },
      exportFormat,
    );
    setExportOpen(false);
  }


  const hasActiveFilters = query !== "" || stageFilter !== "all" || ownerFilter !== "all";
  const stageCounts = facets?.byStage ?? {};
  const newCount = stageCounts.new ?? 0;
  const activeCount = (stageCounts.contacted ?? 0) + (stageCounts.qualified ?? 0) + (stageCounts.quotation ?? 0);
  const archivedCount = (stageCounts.lost ?? 0) + (stageCounts.archived ?? 0);
  const totalLeads = facets?.total ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight">
            {t("Pengurusan Lead", "Lead Management")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {accessRole === "SALES"
              ? t(`${totalLeads} lead milik anda`, `${totalLeads} leads owned by you`)
              : t(`${totalLeads} lead merentas pasukan`, `${totalLeads} leads across the team`)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            disabled={visible.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {t("Eksport", "Export")}
          </button>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold",
              isAdmin
                ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                : "bg-[var(--color-info-soft)] text-[var(--color-info)]",
            )}
          >
            {isAdmin ? <ShieldCheck className="h-3.5 w-3.5" /> : <UserCircle2 className="h-3.5 w-3.5" />}
            {accessRole ?? ""}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("Ringkasan lead", "Lead summary")}>
        <MetricCard label={t("Jumlah Lead", "Total leads")} icon={UsersRound} value={String(totalLeads)} note={accessRole === "SALES" ? t("Milik anda", "Owned by you") : ownerFilter === "all" ? t("Semua pemilik", "All owners") : (ownerNames.get(ownerFilter) ?? "")} />
        <MetricCard label={t("Baharu", "New")} icon={Filter} value={String(newCount)} note={t("Belum dihubungi", "Not contacted yet")} />
        <MetricCard label={t("Aktif", "Active")} icon={CheckCircle2} value={String(activeCount)} note={t("Dalam proses", "In progress")} />
        <MetricCard label={t("Diarkibkan", "Archived")} icon={UsersRound} value={String(archivedCount)} note={t("Tidak aktif", "Inactive")} />
      </section>

      {/* Bulk action bar — appears when at least one row is selected. */}
      {selected.size > 0 && (
        <div
          className="sticky top-2 z-30 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)] px-4 py-2.5 shadow-lg"
          role="toolbar"
          aria-label={t("Tindakan massal", "Bulk actions")}
        >
          <span className="text-[12.5px] font-bold text-[var(--color-primary)] [font-variant-numeric:tabular-nums]">
            {allMode
              ? t(
                  `Semua ${selected.size} lead (seluruh penapis) dipilih`,
                  `All ${selected.size} matching leads selected`,
                )
              : t(`${selected.size} lead dipilih`, `${selected.size} leads selected`)}
          </span>
          {allMode && (
            <span className="rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-danger)]">
              {t("termasuk luar skrin", "beyond this page")}
            </span>
          )}
          <span className="h-4 w-px bg-[var(--color-primary)]/30" aria-hidden="true" />
          <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-primary)]">
            {t("Tukar status", "Change status")}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) setPendingBulk({ action: "status", status: e.target.value as FollowupStatusLabel });
              }}
              aria-label={t("Pilih status massal", "Pick bulk status")}
              className="rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-surface)] px-2 py-1.5 text-[12px] text-foreground"
            >
              <option value="">{t("Pilih…", "Pick…")}</option>
              {(Object.keys(FOLLOWUP_STATUS_LABELS) as FollowupStatusLabel[]).map((s) => (
                <option key={s} value={s}>{t(...FOLLOWUP_STATUS_LABELS[s])}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setPendingBulk({ action: "archive" })}
            className="rounded-lg border border-[var(--color-primary)]/40 bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
          >
            {t("Arkibkan", "Archive")}
          </button>
          <button
            type="button"
            onClick={() => { setBulkDeleteStep(1); setBulkDeletePhrase(""); setPendingBulk({ action: "delete" }); }}
            className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
          >
            {t("Padam", "Delete")}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
          >
            {t("Kosongkan pilihan", "Clear selection")}
          </button>
        </div>
      )}

      {/* Confirm dialog before applying a bulk action. Delete is two-step. */}
      {pendingBulk && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-confirm-title"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setPendingBulk(null); }}
        >
          <div className="w-full max-w-[440px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            {pendingBulk.action === "delete" && bulkDeleteStep === 2 ? (
              <>
                <h2 id="bulk-confirm-title" className="m-0 font-display text-[17px] font-bold text-[var(--color-danger)]">
                  {t("Pengesahan terakhir", "Final confirmation")}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {t(
                    `${selected.size} lead akan dipadam KEKAL dan TIDAK BOLEH diundur. Taip PADAM untuk sahkan.`,
                    `${selected.size} leads will be PERMANENTLY deleted and CANNOT be undone. Type DELETE to confirm.`,
                  )}
                </p>
                <input
                  value={bulkDeletePhrase}
                  onChange={(e) => setBulkDeletePhrase(e.target.value)}
                  placeholder={lang === "ms" ? "PADAM" : "DELETE"}
                  autoComplete="off"
                  autoFocus
                  className="mt-3 w-full rounded-lg border border-[var(--color-danger)]/50 bg-[var(--color-surface)] px-3 py-2 text-[14px] font-bold tracking-widest uppercase placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingBulk(null)}
                    disabled={busy}
                    className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                  >
                    {t("Batal", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmBulk()}
                    disabled={busy || bulkDeletePhrase.trim().toUpperCase() !== (lang === "ms" ? "PADAM" : "DELETE")}
                    className="rounded-lg bg-[var(--color-danger)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? t("Memproses…", "Processing…") : t("Padam kekal", "Delete forever")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="bulk-confirm-title" className="m-0 font-display text-[17px] font-bold">
                  {pendingBulk.action === "delete"
                    ? t("Padam lead secara kekal?", "Permanently delete leads?")
                    : t("Sahkan tindakan massal", "Confirm bulk action")}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {pendingBulk.action === "delete"
                    ? t(
                        `${selected.size} lead akan dipadam KEKAL bersama semua aktiviti dan susulannya.`,
                        `${selected.size} leads will be PERMANENTLY deleted along with all activities and follow-ups.`,
                      )
                    : t(
                        `${selected.size} lead akan ditandakan "${bulkLabel(pendingBulk)}".`,
                        `${selected.size} leads will be marked as "${bulkLabel(pendingBulk)}".`,
                      )}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingBulk(null)}
                    disabled={busy}
                    autoFocus
                    className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                  >
                    {t("Batal", "Cancel")}
                  </button>
                  {pendingBulk.action === "delete" ? (
                    <button
                      type="button"
                      onClick={() => setBulkDeleteStep(2)}
                      disabled={busy}
                      className="rounded-lg bg-[var(--color-danger)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
                    >
                      {t("Teruskan", "Continue")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void confirmBulk()}
                      disabled={busy}
                      className="rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
                    >
                      {busy ? t("Memproses…", "Processing…") : t("Sahkan", "Confirm")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirm dialog before hard-deleting a single lead (two steps). */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          onClick={(e) => { if (e.target === e.currentTarget) closeDelete(); }}
        >
          <div className="w-full max-w-[440px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            {deleteStep === 1 ? (
              <>
                <h2 id="delete-confirm-title" className="m-0 font-display text-[17px] font-bold">
                  {t("Padam lead ini?", "Delete this lead?")}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {t(
                    `"${pendingDelete.name}" (${pendingDelete.phone}) akan dipadam KEKAL bersama semua aktiviti dan susulan WhatsApp.`,
                    `"${pendingDelete.name}" (${pendingDelete.phone}) will be PERMANENTLY deleted along with all activities and WhatsApp follow-ups.`,
                  )}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDelete}
                    disabled={busy}
                    autoFocus
                    className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                  >
                    {t("Batal", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    disabled={busy}
                    className="rounded-lg bg-[var(--color-danger)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-60"
                  >
                    {t("Teruskan", "Continue")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 id="delete-confirm-title" className="m-0 font-display text-[17px] font-bold text-[var(--color-danger)]">
                  {t("Pengesahan terakhir", "Final confirmation")}
                </h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {t(
                    "Tindakan ini TIDAK BOLEH diundur. Taip PADAM untuk sahkan.",
                    "This action CANNOT be undone. Type DELETE to confirm.",
                  )}
                </p>
                <input
                  value={deletePhrase}
                  onChange={(e) => setDeletePhrase(e.target.value)}
                  placeholder={lang === "ms" ? "PADAM" : "DELETE"}
                  autoComplete="off"
                  autoFocus
                  className="mt-3 w-full rounded-lg border border-[var(--color-danger)]/50 bg-[var(--color-surface)] px-3 py-2 text-[14px] font-bold tracking-widest uppercase placeholder:font-normal placeholder:tracking-normal placeholder:normal-case"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeDelete}
                    disabled={busy}
                    className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
                  >
                    {t("Batal", "Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmDeleteOne()}
                    disabled={busy || deletePhrase.trim().toUpperCase() !== (lang === "ms" ? "PADAM" : "DELETE")}
                    className="rounded-lg bg-[var(--color-danger)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {busy ? t("Memproses…", "Processing…") : t("Padam kekal", "Delete forever")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Result summary after a bulk action is applied. */}
      {bulkResult && (
        <div
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-success)]/40 bg-[var(--color-success-soft)] px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="h-4.5 w-4.5 flex-none text-[var(--color-success)]" />
          <p className="m-0 flex-1 text-[13px] font-semibold text-[var(--color-success)]">
            {bulkResult.skipped > 0
              ? t(
                  `${bulkResult.updated} lead dikemas kini (${bulkResult.skipped} dilangkau) — ${bulkResult.label}.`,
                  `${bulkResult.updated} leads updated (${bulkResult.skipped} skipped) — ${bulkResult.label}.`,
                )
              : t(
                  `${bulkResult.updated} lead berjaya ditandakan ${bulkResult.label}.`,
                  `${bulkResult.updated} leads successfully marked as ${bulkResult.label}.`,
                )}
          </p>
          <button
            type="button"
            onClick={() => setBulkResult(null)}
            aria-label={t("Tutup ringkasan", "Dismiss summary")}
            className="grid place-items-center text-[var(--color-success)] hover:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Export dialog — CSV or XLSX, generated server-side from the current filters. */}
      {exportOpen && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="export-dialog-title"
          onClick={(e) => { if (e.target === e.currentTarget) setExportOpen(false); }}
        >
          <div className="w-full max-w-[440px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <h2 id="export-dialog-title" className="m-0 font-display text-[17px] font-bold">
              {t("Eksport Lead", "Export Leads")}
            </h2>
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">
              {t(
                "Fail akan dieksport berdasarkan penapis semasa.",
                "The file will be exported based on your current filters.",
              )}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={t("Format fail", "File format")}>
              <button
                type="button"
                role="radio"
                aria-checked={exportFormat === "csv"}
                onClick={() => setExportFormat("csv")}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
                  exportFormat === "csv"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]",
                )}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-bold">
                  <FileText className="h-4 w-4" /> CSV
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  {t("Boleh guna di mana-mana, fail kecil", "Works everywhere, small file")}
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={exportFormat === "xlsx"}
                onClick={() => setExportFormat("xlsx")}
                className={cn(
                  "flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors",
                  exportFormat === "xlsx"
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]",
                )}
              >
                <span className="flex items-center gap-1.5 text-[13px] font-bold">
                  <FileSpreadsheet className="h-4 w-4" /> XLSX
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  {t("Format Excel", "Excel format")}
                </span>
              </button>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
              {t(
                "Sel yang bermula dengan = + - @ dilindungi daripada formula berbahaya.",
                "Cells starting with = + - @ are protected from harmful formulas.",
              )}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExportOpen(false)}
                className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)]"
              >
                {t("Batal", "Cancel")}
              </button>
              <button
                type="button"
                onClick={doExport}
                autoFocus
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90"
              >
                <Download className="h-3.5 w-3.5" />
                {t("Muat turun", "Download")}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <div className="flex min-w-0 max-w-[300px] flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={t("Cari nama, telefon, destinasi…", "Search name, phone, destination…")}
              aria-label={t("Cari lead", "Search leads")}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none"
            />
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {t("Status", "Status")}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-[13px]"
            >
              <option value="all">{t("Semua status", "All statuses")}</option>
              {facets?.byStage && Object.keys(facets.byStage).length > 0
                ? Object.keys(facets.byStage).map((s) => (
                    <option key={s} value={s}>{t(...stageLabel(s))}</option>
                  ))
                : (Object.keys(STATUS_LABELS) as LeadStatus[]).map((s) => (
                    <option key={s} value={s}>{t(...STATUS_LABELS[s])}</option>
                  ))}
            </select>
          </label>
          {isAdmin && owners.length > 0 && (
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              {t("Pemilik", "Owner")}
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                aria-label={t("Tapis mengikut pemilik", "Filter by owner")}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-[13px]"
              >
                <option value="all">{t("Semua pemilik", "All owners")}</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Active filter chips — one per active filter, individually clearable. */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-4 py-2.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Penapis aktif", "Active filters")}
            </span>
            {query !== "" && (
              <FilterChip
                label={`${t("Carian", "Search")}: ${query}`}
                onClear={() => setQueryInput("")}
                clearLabel={t("Buang carian", "Clear search")}
              />
            )}
            {stageFilter !== "all" && (
              <FilterChip
                label={`${t("Status", "Status")}: ${t(...stageLabel(stageFilter))}`}
                onClear={() => setStageFilter("all")}
                clearLabel={t("Buang status", "Clear status")}
              />
            )}
            {isAdmin && ownerFilter !== "all" && (
              <FilterChip
                label={`${t("Pemilik", "Owner")}: ${ownerNames.get(ownerFilter) ?? ownerFilter}`}
                onClear={() => setOwnerFilter("all")}
                clearLabel={t("Buang pemilik", "Clear owner")}
              />
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-1 text-[11.5px] font-semibold text-[var(--color-primary)] hover:underline"
            >
              {t("Kosongkan semua", "Clear all")}
            </button>
          </div>
        )}

        {leadsQuery.loading ? (
          <FollowupLoading />
        ) : leadsQuery.status === "error" ? (
          <FollowupErrorState message={leadsQuery.error ?? ""} onRetry={() => void leadsQuery.refetch()} />
        ) : visible.length === 0 ? (
          hasActiveFilters ? (
            <FollowupEmptyState
              compact
              icon={Search}
              title={t("Tiada padanan", "No matches")}
              description={t("Cuba kata kunci lain atau tukar penapis.", "Try a different keyword or change the filters.")}
              action={
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-raised)]"
                >
                  {t("Kosongkan semua", "Clear all")}
                </button>
              }
            />
          ) : (
            <FollowupEmptyState
              icon={UsersRound}
              title={t("Tiada lead lagi", "No leads yet")}
              description={t("Lead akan muncul di sini selepas anda import.", "Leads will show here after you import them.")}
            />
          )
        ) : (
          <div data-tour="lead-table" className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                  <th scope="col" className="w-10 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={t("Pilih semua lead", "Select all leads")}
                      className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                    />
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">{t("Lead", "Lead")}</th>
                  <th scope="col" className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">{t("Destinasi", "Destination")}</th>
                  <th scope="col" className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">{t("Status", "Status")}</th>
                  <th scope="col" className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">{t("Susulan", "Follow-up")}</th>
                  <th scope="col" className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">{t("Pemilik", "Owner")}</th>
                  <th scope="col" className="px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground max-md:hidden">{t("Dicipta", "Created")}</th>
                  <th scope="col" className="px-4 py-2.5 text-right text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">{t("Tindakan", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lead) => {
                  const tone = stageTone(lead.stage);
                  const stage = lead.stage;
                  return (
                    <tr key={lead.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-raised)]">
                      <td className="px-4 py-3">
                        {canActOn(lead, accessRole, session?.userId) ? (
                          <input
                            type="checkbox"
                            checked={selected.has(lead.id)}
                            onChange={() => toggleRow(lead.id)}
                            aria-label={t(`Pilih ${lead.name}`, `Select ${lead.name}`)}
                            className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                          />
                        ) : (
                          <span className="block w-3.5" aria-hidden="true" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--color-neutral-soft)] text-[11px] font-bold text-[var(--color-text-secondary)]">
                            {initialsOf(lead.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 truncate font-semibold">
                              <Link
                                to={`/lead-management/${lead.id}`}
                                className="hover:text-[var(--color-primary)] hover:underline"
                              >
                                {lead.name}
                              </Link>
                            </p>
                            <p className="m-0 text-[11.5px] text-muted-foreground [font-variant-numeric:tabular-nums]">{lead.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                        {lead.destination ?? (
                          <span className="text-muted-foreground">{t("—", "—")}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: tone.bg, color: tone.fg }}>
                          {t(...stageLabel(stage))}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">
                        {lead.followupStage ?? "—"}
                        {lead.followupState === "paused" && (
                          <span className="ml-1.5 rounded-full bg-[var(--color-neutral-soft)] px-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                            {t(...STATE_LABELS.paused)}
                          </span>
                        )}
                        {lead.followupState === "escalated" && (
                          <span className="ml-1.5 rounded-full bg-[var(--color-danger-soft)] px-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-danger)]">
                            {t(...STATE_LABELS.escalated)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[var(--color-text-secondary)]">
                          {ownerNameOf(lead)}
                          {accessRole === "SALES" && session?.userId === lead.ownerUserId && (
                            <span className="ml-1.5 rounded-full bg-[var(--color-info-soft)] px-1.5 text-[10.5px] font-bold text-[var(--color-info)]">{t("Anda", "You")}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground max-md:hidden">
                        {lead.createdAt ? formatKlDate(lead.createdAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {canActOn(lead, accessRole, session?.userId) ? (
                          <div className="flex justify-end gap-1.5">
                            <Link
                              to={`/lead-management/${lead.id}`}
                              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-raised)]"
                            >
                              {t("Lihat", "View")}
                            </Link>
                            <button
                              type="button"
                              onClick={() => askDelete(lead)}
                              aria-label={t(`Padam ${lead.name}`, `Delete ${lead.name}`)}
                              className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-surface)] px-2 py-1.5 text-[12px] font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                            >
                              {t("Padam", "Delete")}
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right text-[11.5px] text-muted-foreground">
                            {t("Tiada akses", "No access")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-4 py-2.5">
              <span className="text-[12px] text-muted-foreground [font-variant-numeric:tabular-nums]">
                {t(
                  `Memaparkan ${visible.length} lead`,
                  `Showing ${visible.length} leads`,
                )}
              </span>
              {offset > 0 && (
                <button
                  type="button"
                  onClick={() => { setOffset(0); setExtraRows([]); setSelected(new Set()); }}
                  className="text-[12px] font-semibold text-[var(--color-primary)] hover:underline"
                >
                  {t("Kembali ke awal", "Back to start")}
                </button>
              )}
              {visible.length >= PAGE_SIZE && (
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMore ? t("Memuat…", "Loading…") : t("Muat lagi", "Load more")}
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {notice && (
        <div className="fixed bottom-6 right-6 z-[60] flex max-w-[340px] items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-text)] px-3.5 py-3 text-[13px] text-[var(--color-surface)] shadow-2xl" role="status" aria-live="polite">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label={t("Tutup", "Dismiss")} onClick={() => setNotice("")} className="grid place-items-center">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, icon: Icon, value, note }: { label: string; icon: typeof UsersRound; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-display text-[24px] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]">{value}</span>
      <span className="text-[12px] text-muted-foreground">{note}</span>
    </div>
  );
}

/** One active-filter chip with an inline clear button. */
function FilterChip({ label, onClear, clearLabel }: { label: string; onClear: () => void; clearLabel: string }) {
  return (
    <span className="inline-flex max-w-[260px] items-center gap-1 rounded-full bg-[var(--color-primary-soft)] py-1 pl-2.5 pr-1 text-[11.5px] font-semibold text-[var(--color-primary)]">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={clearLabel}
        className="grid h-4.5 w-4.5 flex-none place-items-center rounded-full hover:bg-[var(--color-primary)]/15"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}


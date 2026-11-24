import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn, parseDbDate } from "@/lib/utils";
import type { ImportBatch, ImportErrorItem } from "@/pages/LeadImport";

/** Formats a KL-time ISO string for display (date + time, 12h). D1 bare-UTC aware. */
function formatKl(iso: string): string {
  const date = parseDbDate(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** Bilingual display for stored failure reasons (server codes + legacy labels). */
export function translateReason(
  reason: string,
  t: (ms: string, en: string) => string,
): string {
  switch (reason) {
    case "Phone is empty":
    case "empty_phone":
      return t("Nombor telefon kosong", "Phone is empty");
    case "Phone number is invalid":
    case "invalid_phone":
      return t("Nombor telefon tidak sah", "Phone number is invalid");
    case "Name is required":
    case "empty_name":
    case "missing_name":
      return t("Nama diperlukan", "Name is required");
    case "Phone already exists in CRM":
    case "duplicate_db":
      return t("Nombor sudah wujud dalam CRM", "Phone already exists in CRM");
    case "Duplicate within this file":
    case "duplicate_in_file":
      return t("Duplikat dalam fail ini", "Duplicate within this file");
    default:
      return reason;
  }
}

/** Editable failed-row list with inline fixes and a re-import button. */
function FailedRowsEditor({
  batch,
  onRetry,
}: {
  batch: ImportBatch;
  onRetry: (batchId: string, fixed: ImportErrorItem[]) => void;
}) {
  const { t } = useLang();
  const [drafts, setDrafts] = useState<ImportErrorItem[]>(
    batch.errors ?? [],
  );

  function update(idx: number, patch: Partial<ImportErrorItem>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    );
  }

  /** A row is fixable when it has a name and a normalizable MY phone. */
  const fixable = drafts.map(
    (d) => d.name.trim().length > 0 && d.phone.replace(/\D/g, "").length >= 9,
  );
  const anyFixable = fixable.some(Boolean);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-danger)]">
        {t(
          "Baris gagal — betulkan & import semula",
          "Failed rows — fix & re-import",
        )}
      </p>
      <div className="overflow-hidden rounded-lg border border-[var(--color-danger-soft)] bg-[var(--color-surface)]">
        <table className="w-full text-xs">
          <thead className="bg-[var(--color-danger-soft)] text-left text-[11px] uppercase tracking-wide text-[var(--color-danger)]">
            <tr>
              <th className="px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">{t("Nama", "Name")}</th>
              <th className="px-3 py-2 font-semibold">{t("Telepon", "Phone")}</th>
              <th className="px-3 py-2 font-semibold">{t("Sebab asal", "Original reason")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {drafts.map((e, i) => (
              <tr key={e.rowNumber}>
                <td className="px-3 py-2 text-muted-foreground">{e.rowNumber}</td>
                <td className="px-3 py-2">
                  <input
                    value={e.name}
                    onChange={(ev) => update(i, { name: ev.target.value })}
                    placeholder={t("Nama", "Name")}
                    className={cn(
                      "w-36 rounded border px-2 py-1 text-[var(--color-text)] focus:outline-none focus:ring-1",
                      fixable[i]
                        ? "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                        : "border-[var(--color-danger)]/40 focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]",
                    )}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={e.phone}
                    onChange={(ev) => update(i, { phone: ev.target.value })}
                    placeholder="012-345 6789"
                    className={cn(
                      "w-36 rounded border px-2 py-1 font-mono text-[var(--color-text)] focus:outline-none focus:ring-1",
                      fixable[i]
                        ? "border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                        : "border-[var(--color-danger)]/40 focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]",
                    )}
                  />
                </td>
                <td className="px-3 py-2 font-semibold text-[var(--color-danger)]">
                  {translateReason(e.reason, t)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => onRetry(batch.id, drafts.filter((_, i) => fixable[i]))}
        disabled={!anyFixable}
        className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--color-on-primary)] shadow-sm transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {t("Import semula baris diperbaiki", "Re-import fixed rows")}
      </button>
    </div>
  );
}

/**
 * Import history panel — past batches with inserted/duplicate/failed counts
 * and an expandable failed-row editor per batch. Data comes from
 * GET /api/followup/import/batches; the retry calls POST /import/batches/:id/retry.
 */
export default function ImportHistoryPanel({
  batches,
  onRetryFixed,
  onDeleteBatch,
}: {
  batches: ImportBatch[];
  /** Called with the corrected rows when the user re-imports a batch. */
  onRetryFixed?: (batchId: string, fixed: ImportErrorItem[]) => void;
  /** Called with the batch id when the user deletes a batch. */
  onDeleteBatch?: (batchId: string) => void;
}) {
  const { t } = useLang();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (batches.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-8 text-center">
        <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">
          {t(
            "Belum ada import. Muat naik Excel/CSV pertama anda.",
            "No imports yet. Upload your first Excel/CSV.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--color-surface-raised)] text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="w-8 px-2 py-3" aria-hidden />
            <th className="px-4 py-3 font-semibold">
              {t("Fail / File", "File")}
            </th>
            <th className="px-4 py-3 font-semibold">{t("Tarikh (KL)", "Date (KL)")}</th>
            <th className="px-4 py-3 text-right font-semibold">{t("Baris", "Rows")}</th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--color-success)]">
              {t("Berjaya", "Inserted")}
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--color-warning)]">
              {t("Duplikat", "Duplicates")}
            </th>
            <th className="px-4 py-3 text-right font-semibold text-[var(--color-danger)]">
              {t("Gagal", "Failed")}
            </th>
            <th className="px-4 py-3 text-right font-semibold">
              {t("Tindakan", "Actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {batches.map((b) => {
            const hasErrors = (b.errors?.length ?? 0) > 0;
            const expanded = expandedId === b.id;
            return (
              <>
                <tr
                  key={b.id}
                  className={cn(
                    "hover:bg-[var(--color-surface-raised)]",
                    hasErrors && "cursor-pointer",
                  )}
                  onClick={() =>
                    hasErrors && setExpandedId(expanded ? null : b.id)
                  }
                >
                  <td className="px-2 py-3">
                    {hasErrors && (
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                      <span className="font-medium text-[var(--color-text)]">
                        {b.fileName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatKl(b.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                    {b.totalRows}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {b.insertedRows}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        b.duplicateRows > 0 ? "text-[var(--color-warning)]" : "text-muted-foreground",
                      )}
                    >
                      {b.duplicateRows > 0 && <XCircle className="h-3.5 w-3.5" />}
                      {b.duplicateRows}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        b.failedRows > 0 ? "text-[var(--color-danger)]" : "text-muted-foreground",
                      )}
                    >
                      {b.failedRows > 0 && <XCircle className="h-3.5 w-3.5" />}
                      {b.failedRows}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBatch?.(b.id);
                      }}
                      aria-label={t("Padam batch", "Delete batch")}
                      className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] px-2 py-1 text-[11.5px] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                      <Trash2 className="h-3 w-3" />
                      {t("Padam", "Delete")}
                    </button>
                  </td>
                </tr>
                {expanded && hasErrors && (
                  <tr key={`${b.id}-errors`} className="bg-[var(--color-danger-soft)]/40">
                    <td />
                    <td colSpan={7} className="px-4 pb-4 pt-1">
                      <FailedRowsEditor
                        key={expandedId}
                        batch={b}
                        onRetry={(batchId, fixed) => {
                          onRetryFixed?.(batchId, fixed);
                          setExpandedId(null);
                        }}
                      />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

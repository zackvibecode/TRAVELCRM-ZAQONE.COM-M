import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  RotateCcw,
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
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
        {t(
          "Baris gagal — betulkan & import semula",
          "Failed rows — fix & re-import",
        )}
      </p>
      <div className="overflow-hidden rounded-lg border border-rose-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-rose-50 text-left text-[11px] uppercase tracking-wide text-rose-600">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">{t("Nama", "Name")}</th>
              <th className="px-3 py-2">{t("Telepon", "Phone")}</th>
              <th className="px-3 py-2">{t("Sebab asal", "Original reason")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rose-100">
            {drafts.map((e, i) => (
              <tr key={e.rowNumber}>
                <td className="px-3 py-2 text-slate-400">{e.rowNumber}</td>
                <td className="px-3 py-2">
                  <input
                    value={e.name}
                    onChange={(ev) => update(i, { name: ev.target.value })}
                    placeholder={t("Nama", "Name")}
                    className={cn(
                      "w-36 rounded border px-2 py-1 text-slate-800 focus:outline-none focus:ring-1",
                      fixable[i]
                        ? "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
                        : "border-rose-300 focus:border-rose-500 focus:ring-rose-500",
                    )}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    value={e.phone}
                    onChange={(ev) => update(i, { phone: ev.target.value })}
                    placeholder="012-345 6789"
                    className={cn(
                      "w-36 rounded border px-2 py-1 font-mono text-slate-800 focus:outline-none focus:ring-1",
                      fixable[i]
                        ? "border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
                        : "border-rose-300 focus:border-rose-500 focus:ring-rose-500",
                    )}
                  />
                </td>
                <td className="px-3 py-2 font-semibold text-rose-600">
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
        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
}: {
  batches: ImportBatch[];
  /** Called with the corrected rows when the user re-imports a batch. */
  onRetryFixed?: (batchId: string, fixed: ImportErrorItem[]) => void;
}) {
  const { t } = useLang();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
        <FileSpreadsheet className="mx-auto mb-2 h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-500">
          {t(
            "Belum ada import. Muat naik Excel/CSV pertama anda.",
            "No imports yet. Upload your first Excel/CSV.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="w-8 px-2 py-3" aria-hidden />
            <th className="px-4 py-3">
              {t("Fail / File", "File")}
            </th>
            <th className="px-4 py-3">{t("Tarikh (KL)", "Date (KL)")}</th>
            <th className="px-4 py-3 text-right">{t("Baris", "Rows")}</th>
            <th className="px-4 py-3 text-right text-emerald-600">
              {t("Berjaya", "Inserted")}
            </th>
            <th className="px-4 py-3 text-right text-amber-600">
              {t("Duplikat", "Duplicates")}
            </th>
            <th className="px-4 py-3 text-right text-rose-600">
              {t("Gagal", "Failed")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {batches.map((b) => {
            const hasErrors = (b.errors?.length ?? 0) > 0;
            const expanded = expandedId === b.id;
            return (
              <>
                <tr
                  key={b.id}
                  className={cn(
                    "hover:bg-slate-50",
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
                          "h-4 w-4 text-slate-400 transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span className="font-medium text-slate-800">
                        {b.fileName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatKl(b.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">
                    {b.totalRows}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {b.insertedRows}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-semibold",
                        b.duplicateRows > 0 ? "text-amber-600" : "text-slate-400",
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
                        b.failedRows > 0 ? "text-rose-600" : "text-slate-400",
                      )}
                    >
                      {b.failedRows > 0 && <XCircle className="h-3.5 w-3.5" />}
                      {b.failedRows}
                    </span>
                  </td>
                </tr>
                {expanded && hasErrors && (
                  <tr key={`${b.id}-errors`} className="bg-rose-50/40">
                    <td />
                    <td colSpan={6} className="px-4 pb-4 pt-1">
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

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { followupApi, type AdminImportBatch } from "@/lib/followup-api";
import { FollowupErrorState, FollowupLoading } from "@/components/FollowupStates";
import ImportHistoryPanel from "@/components/ImportHistoryPanel";

/**
 * Import Leads — upload a CSV, map columns, preview the server-validated
 * rows, then commit. Every step hits the real follow-up import API
 * (/import/parse → /import/commit), and the history panel reads
 * /import/batches with a retry endpoint for failed rows.
 */

/** One parsed row as returned by POST /import/parse. */
export interface ImportRow {
  rowNo: number;
  name: string;
  phoneRaw: string;
  /** Phone after Malaysia normalization (01x → +60 1x …). */
  phoneNormalized: string;
  destination: string;
  pax: number;
  status: "ready" | "duplicate" | "invalid";
  reason?: string;
  /** Empty vs invalid phone distinction for targeted highlighting. */
  phoneProblem?: "empty" | "invalid";
}

/** A failed row from an import batch, kept for correction. */
export interface ImportErrorItem {
  rowNumber: number;
  reason: string;
  /** Raw row snapshot (name | phone) so the user can fix and retry. */
  name: string;
  phone: string;
}

/** A completed import batch (mirrors import_batches + its error rows). */
export interface ImportBatch {
  id: string;
  fileName: string;
  totalRows: number;
  insertedRows: number;
  duplicateRows: number;
  failedRows: number;
  createdAt: string;
  /** Failed rows for the batch detail view. */
  errors?: ImportErrorItem[];
}

/** Lead fields available for column mapping. */
export type LeadField = "name" | "phone" | "destination" | "pax";
export const LEAD_FIELDS: LeadField[] = ["name", "phone", "destination", "pax"];

/** Column mapping: lead field → index of the file column (or unmapped). */
export type ColumnMapping = Partial<Record<LeadField, number>>;

/** A parsed spreadsheet: header names (the rows live on the server). */
export interface ParsedFile {
  headers: string[];
}

const MAX_FILE_MB = 5;

/** Converts a server parse response into the preview rows the UI renders. */
function toPreviewRows(
  rows: { rowNo: number; name: string; phoneRaw: string; phoneNormalized: string; destination: string; pax: number; problems: string[]; duplicate: boolean }[],
): ImportRow[] {
  return rows.map((r) => {
    const problems = r.problems ?? [];
    let status: ImportRow["status"] = "ready";
    let reason: string | undefined;
    let phoneProblem: ImportRow["phoneProblem"];
    if (problems.includes("empty_name")) {
      status = "invalid";
      reason = "Name is required";
    } else if (problems.includes("empty_phone")) {
      status = "invalid";
      reason = "Phone is empty";
      phoneProblem = "empty";
    } else if (problems.includes("invalid_phone")) {
      status = "invalid";
      reason = "Phone number is invalid";
      phoneProblem = "invalid";
    } else if (r.duplicate) {
      status = "duplicate";
      reason = "Phone already exists in CRM";
    } else if (problems.includes("duplicate_in_file")) {
      status = "duplicate";
      reason = "Duplicate within this file";
    }
    return {
      rowNo: r.rowNo,
      name: r.name,
      phoneRaw: r.phoneRaw,
      phoneNormalized: r.phoneNormalized,
      destination: r.destination,
      pax: r.pax,
      status,
      reason,
      phoneProblem,
    };
  });
}

/** Converts a backend batch + its error rows into the history panel shape. */
function toHistoryBatch(b: AdminImportBatch): ImportBatch {
  return {
    id: b.id,
    fileName: b.fileName,
    totalRows: b.totalRows,
    insertedRows: b.insertedRows,
    duplicateRows: b.duplicateRows,
    failedRows: b.failedRows,
    createdAt: b.createdAt,
    errors: b.errors.map((e) => ({
      rowNumber: e.rowNumber,
      reason: e.reason,
      name: typeof e.raw?.name === "string" ? e.raw.name : "",
      phone: typeof e.raw?.phone === "string" ? e.raw.phone : "",
    })),
  };
}

/** Bilingual display for row-status reasons (stored in English). */
function translateReason(
  reason: string | undefined,
  t: (ms: string, en: string) => string,
): string {
  switch (reason) {
    case "Phone already exists in CRM":
    case "duplicate_db":
      return t("Nombor sudah wujud dalam CRM", "Phone already exists in CRM");
    case "Duplicate within this file":
    case "duplicate_in_file":
      return t("Duplikat dalam fail ini", "Duplicate within this file");
    case "Name is required":
    case "empty_name":
    case "missing_name":
      return t("Nama diperlukan", "Name is required");
    case "Phone is empty":
    case "empty_phone":
      return t("Nombor telefon kosong", "Phone is empty");
    case "Phone number is invalid":
    case "invalid_phone":
      return t("Nombor telefon tidak sah", "Phone number is invalid");
    default:
      return reason ?? "";
  }
}

export default function LeadImport() {
  const { t } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [doneNotice, setDoneNotice] = useState<string>("");
  const [batches, setBatches] = useState<ImportBatch[] | null>(null);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  async function loadBatches() {
    setBatchesError(null);
    try {
      const list = await followupApi.importBatches();
      setBatches(list.map(toHistoryBatch));
    } catch (err) {
      setBatchesError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void loadBatches();
  }, []);

  const stats = {
    ready: rows.filter((r) => r.status === "ready").length,
    dup: rows.filter((r) => r.status === "duplicate").length,
    bad: rows.filter((r) => r.status === "invalid").length,
  };

  const mappingReady = mapping.name !== undefined && mapping.phone !== undefined;

  /** Sends the file (and the current mapping) to the server and renders the validated preview. */
  async function parse(fileToParse: File, nextMapping?: ColumnMapping) {
    setParsing(true);
    setParseError(null);
    setDoneNotice("");
    try {
      const res = await followupApi.importParse(fileToParse, nextMapping);
      setHeaders(res.headers);
      setMapping(res.mapping as ColumnMapping);
      setRows(toPreviewRows(res.rows));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      setHeaders(null);
      setRows([]);
    } finally {
      setParsing(false);
    }
  }

  function handleFile(selected: File | undefined) {
    setDoneNotice("");
    setParseError(null);
    if (!selected) return;
    const okType = /\.(csv|tsv|txt)$/i.test(selected.name);
    const okSize = selected.size <= MAX_FILE_MB * 1024 * 1024;
    if (!okType || !okSize) {
      setRows([]);
      setHeaders(null);
      setFile(null);
      setFileName("");
      alert(
        !okType
          ? t(
              "Fail mesti .csv, .tsv atau .txt. Fail Excel perlu disimpan sebagai CSV dahulu.",
              "File must be .csv, .tsv or .txt. Excel files must be saved as CSV first.",
            )
          : t(
              `Saiz fail melebihi ${MAX_FILE_MB}MB`,
              `File exceeds ${MAX_FILE_MB}MB`,
            ),
      );
      return;
    }
    setFileName(selected.name);
    setFile(selected);
    void parse(selected);
  }

  /** Re-runs the server preview whenever the user changes a column mapping. */
  function remap(next: ColumnMapping) {
    setMapping(next);
    if (file) void parse(file, next);
  }

  async function runImport() {
    if (stats.ready === 0 || !file) return;
    // Hard guard: never import until the required columns are mapped,
    // even if the button state somehow goes stale.
    if (!mappingReady) {
      alert(
        t(
          "Petakan lajur 'Nama' dan 'Telepon' dahulu.",
          "Map the 'Name' and 'Phone' columns first.",
        ),
      );
      return;
    }
    setImporting(true);
    setParseError(null);
    try {
      const res = await followupApi.importCommit(file, mapping);
      setDoneNotice(
        t(
          `Import selesai: ${res.insertedRows} lead ditambah, ${res.duplicateRows} pendua, ${res.failedRows} gagal.`,
          `Import finished: ${res.insertedRows} leads added, ${res.duplicateRows} duplicates, ${res.failedRows} failed.`,
        ),
      );
      setRows([]);
      setHeaders(null);
      setFile(null);
      setFileName("");
      setMapping({});
      await loadBatches();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  /** Re-import handler for corrected failed rows — posts to the batch retry endpoint. */
  async function retryFixed(batchId: string, fixed: ImportErrorItem[]) {
    if (fixed.length === 0) return;
    try {
      const res = await followupApi.importRetry(
        batchId,
        fixed.map((f) => ({ rowNumber: f.rowNumber, name: f.name, phone: f.phone })),
      );
      setDoneNotice(
        res.stillFailing.length === 0
          ? t(`Import semula selesai: ${res.inserted} lead diperbaiki ditambah.`, `Re-import finished: ${res.inserted} fixed leads added.`)
          : t(
              `Import semula: ${res.inserted} ditambah, ${res.stillFailing.length} masih gagal.`,
              `Re-import: ${res.inserted} added, ${res.stillFailing.length} still failing.`,
            ),
      );
      await loadBatches();
    } catch (err) {
      setDoneNotice("");
      setBatchesError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("Import Lead", "Import Leads")}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t(
            "Muat naik CSV — nombor telefon Malaysia dinormalisasi automatik dan duplikat dikesan.",
            "Upload a CSV — Malaysian phone numbers are normalized automatically and duplicates detected.",
          )}
        </p>
      </header>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition",
          fileName
            ? "border-emerald-400 bg-emerald-50"
            : "border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
        />
        {parsing ? (
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        ) : (
          <Upload className="h-8 w-8 text-emerald-600" />
        )}
        {fileName ? (
          <>
            <p className="font-semibold text-slate-800">{fileName}</p>
            <p className="text-xs text-slate-500">
              {parsing
                ? t("Mengenal pasti lajur & menyemak baris…", "Detecting columns & validating rows…")
                : t("Klik untuk pilih fail lain", "Click to choose a different file")}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-slate-700">
              {t("Tarik & lepas fail di sini, atau klik untuk pilih", "Drag & drop a file here, or click to browse")}
            </p>
            <p className="text-xs text-slate-500">
              {t(".csv, .tsv, .txt — maks 5MB (Excel: simpan sebagai CSV)", ".csv, .tsv, .txt — max 5MB (Excel: save as CSV)")}
            </p>
          </>
        )}
      </div>

      {parseError && (
        <FollowupErrorState message={parseError} onRetry={file ? () => void parse(file, mapping) : undefined} />
      )}

      {/* Column mapping */}
      {headers && (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              {t("Pemetaan lajur", "Column mapping")}
            </h2>
            <p className="text-xs text-slate-500">
              {t("Padankan lajur fail anda kepada medan lead", "Match your file columns to lead fields")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {LEAD_FIELDS.map((field) => {
              const required = field === "name" || field === "phone";
              const fieldLabel: Record<LeadField, string> = {
                name: t("Nama", "Name"),
                phone: t("Telepon", "Phone"),
                destination: t("Destinasi", "Destination"),
                pax: "Pax",
              };
              return (
                <label key={field} className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    {fieldLabel[field]}
                    {required && <span className="text-rose-500"> *</span>}
                  </span>
                  <select
                    value={mapping[field] ?? ""}
                    disabled={parsing || importing}
                    onChange={(e) =>
                      remap({
                        ...mapping,
                        [field]: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">{t("— Tiada —", "— None —")}</option>
                    {headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          {!mappingReady && (
            <p className="text-xs font-medium text-rose-600">
              {t("Lajur 'Nama' dan 'Telepon' mesti dipetakan sebelum import.", "'Name' and 'Phone' columns must be mapped before importing.")}
            </p>
          )}
        </section>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-800">
              {t("Pratonton baris", "Row preview")} <span className="text-slate-400">({rows.length})</span>
            </h2>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="text-emerald-600">{t("Sedia", "Ready")}: {stats.ready}</span>
              <span className="text-amber-600">{t("Duplikat", "Duplicates")}: {stats.dup}</span>
              <span className="text-rose-600">{t("Gagal", "Failed")}: {stats.bad}</span>
              <button
                onClick={runImport}
                disabled={importing || parsing || stats.ready === 0 || !mappingReady}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {importing
                  ? t("Mengimport…", "Importing…")
                  : t(`Import ${stats.ready} lead`, `Import ${stats.ready} leads`)}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5">{t("Nama", "Name")}</th>
                  <th className="px-3 py-2.5">{t("Telepon (asal)", "Phone (raw)")}</th>
                  <th className="px-3 py-2.5">{t("Telepon (normal)", "Phone (normalized)")}</th>
                  <th className="px-3 py-2.5">{t("Destinasi", "Destination")}</th>
                  <th className="px-3 py-2.5 text-right">Pax</th>
                  <th className="px-3 py-2.5">{t("Status", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((r) => (
                  <tr
                    key={r.rowNo}
                    className={cn(
                      r.status === "invalid" && "bg-rose-50/50",
                      r.status === "duplicate" && "bg-amber-50/50",
                    )}
                  >
                    <td className="px-3 py-2.5 text-slate-400">{r.rowNo}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{r.name || <span className="text-rose-500">—</span>}</td>
                    <td className={cn("px-3 py-2.5", r.phoneProblem ? "font-semibold text-rose-600" : "text-slate-500")}>
                      {r.phoneRaw || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-700">
                        {r.phoneRaw.replace(/\D/g, "") !== r.phoneNormalized.replace(/\D/g, "") && (
                          <span
                            title={t("Dinormalisasi ke format Malaysia", "Normalized to Malaysian format")}
                            className="rounded bg-emerald-100 px-1 py-0.5 font-sans text-[10px] font-bold text-emerald-700"
                          >
                            MY
                          </span>
                        )}
                        {r.phoneNormalized}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{r.destination || "—"}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{r.pax}</td>
                    <td className="px-3 py-2.5">
                      {r.status === "ready" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("Sedia", "Ready")}
                        </span>
                      )}
                      {r.status === "duplicate" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {translateReason(r.reason, t)}
                        </span>
                      )}
                      {r.status === "invalid" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                          <XCircle className="h-3.5 w-3.5" />
                          {translateReason(r.reason, t)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {rows.length === 0 && headers && !parsing && !parseError && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          {t("Fail ini tidak mengandungi baris data.", "This file has no data rows.")}
        </p>
      )}

      {doneNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {doneNotice}
        </div>
      )}

      {/* History */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileSpreadsheet className="h-4 w-4 text-slate-500" />
          {t("Sejarah import", "Import history")}
        </h2>
        {batchesError ? (
          <FollowupErrorState message={batchesError} onRetry={() => void loadBatches()} />
        ) : batches === null ? (
          <FollowupLoading />
        ) : (
          <ImportHistoryPanel batches={batches} onRetryFixed={retryFixed} />
        )}
      </section>
    </div>
  );
}

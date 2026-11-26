import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
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

/** Sample rows for the downloadable template: Name → Phone → Package → Pax. */
const TEMPLATE_HEADERS = ["name", "phone", "package", "pax"];
const TEMPLATE_ROWS = [
  ["Ahmad Salleh", "0123456789", "Pakej Umrah Disember", "2"],
  ["Siti Aminah", "0129876543", "Pakej Bali 4H3M", "4"],
  ["Tan Wei Ming", "01123456789", "Pakej Bali 4H3M", "1"],
];

/** Triggers a download of the sample .csv (UTF-8 BOM so Excel opens it cleanly). */
function downloadTemplate(): void {
  const csv = [TEMPLATE_HEADERS.join(","), ...TEMPLATE_ROWS.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lead-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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
  /** Overlay animation phases: null = hidden, "processing", "success". */
  const [overlay, setOverlay] = useState<null | "processing" | "success">(null);
  const [doneStats, setDoneStats] = useState<{ added: number; dup: number; bad: number } | null>(null);

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
    setOverlay("processing");
    try {
      const res = await followupApi.importCommit(file, mapping);
      setDoneStats({ added: res.insertedRows, dup: res.duplicateRows, bad: res.failedRows });
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
      setOverlay("success");
      // Auto-dismiss the success animation after ~2.6s — no button needed.
      window.setTimeout(() => setOverlay(null), 2600);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
      setOverlay(null);
    } finally {
      setImporting(false);
    }
  }

  // Auto-import: as soon as the server preview is ready, start the import
  // without waiting for a button press. Requires a valid mapping (name +
  // phone) and at least one ready row.
  useEffect(() => {
    if (importing || parsing || !file) return;
    if (!headers || rows.length === 0) return;
    if (!mappingReady) return;
    if (stats.ready === 0) return;
    void runImport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers, rows, parsing, importing]);

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

  /** Delete an import batch (and its error rows) after confirmation. */
  async function deleteBatch(batchId: string) {
    if (!window.confirm(t("Padam batch import ini? Tindakan ini tidak boleh diundur.", "Delete this import batch? This cannot be undone."))) return;
    try {
      await followupApi.deleteImportBatch(batchId);
      setDoneNotice(t("Batch import dipadam.", "Import batch deleted."));
      await loadBatches();
    } catch (err) {
      setBatchesError(err instanceof Error ? err.message : String(err));
    }
  }

  const step: 1 | 2 | 3 = headers ? (rows.length > 0 ? 3 : 2) : 1;
  const mappedCount = Object.values(mapping).filter((v) => v !== undefined).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight text-[var(--color-text)]">
            {t("Import Lead", "Import Leads")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t(
              "Muat naik Excel atau CSV, petakan lajur, kemudian import. Nombor telefon dinormalisasi ke format Malaysia sebelum duplikat disemak.",
              "Upload Excel or CSV, map the columns, then import. Numbers are cleaned to Malaysian format before duplicates are checked.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label={t("Progres import", "Import progress")}>
          <StepPill state={step > 1 ? "done" : "active"} num={step > 1 ? "✓" : "1"} label={t("Muat naik", "Upload")} />
          <StepPill state={step === 2 ? "active" : step > 2 ? "done" : "todo"} num={step > 2 ? "✓" : "2"} label={t("Petakan lajur", "Map columns")} />
          <StepPill state={step === 3 ? "active" : "todo"} num="3" label={t("Semak batch", "Review batch")} />
        </div>
      </header>

      {doneNotice && (
        <div role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-success-soft)] px-4 py-2.5 text-[13px] text-[var(--color-success)]">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span className="min-w-0 flex-1">{doneNotice}</span>
        </div>
      )}

      {/* 1. Upload file */}
      <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">
            {t("1. Muat naik fail", "1. Upload file")}
          </h2>
          {fileName ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success)]">
              {t("Dipilih", "Selected")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 p-5">
          {/* Format note — shown BEFORE the user uploads so the column order is clear */}
          <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-info)]/30 bg-[var(--color-info-soft)] px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 flex-none text-[var(--color-info)]" />
            <div className="min-w-0 flex-1">
              <strong className="block text-[13px] font-semibold text-[var(--color-text)]">
                {t("Format lajur Excel/CSV", "Excel/CSV column format")}
              </strong>
              <ol className="m-0 mt-1 flex list-none flex-wrap items-center gap-1.5 p-0 text-[12.5px] text-[var(--color-text-secondary)]">
                {[
                  [t("Name", "Name"), t("nama pelanggan", "customer name")],
                  [t("Phone", "Phone"), t("nombor WhatsApp", "WhatsApp number")],
                  [t("Package", "Package"), t("nama pakej", "package name")],
                  ["Pax", t("bilangan orang", "number of people")],
                ].map(([col, sub], i, arr) => (
                  <li key={col} className="inline-flex items-center gap-1.5">
                    <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[12px] font-semibold text-[var(--color-primary)]">
                      {col}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">{sub}</span>
                    {i < arr.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </li>
                ))}
              </ol>
              <p className="m-0 mt-1.5 text-[12px] text-muted-foreground">
                {t(
                  "Susunan lajur: Name → Phone → Package → Pax. Jangan tukar susunan. Tambah 1 baris untuk 1 pelanggan.",
                  "Column order: Name → Phone → Package → Pax. Keep this order. One row per customer.",
                )}
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="mt-2 inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-primary)]/40 bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-soft)]"
              >
                <Download className="h-3.5 w-3.5" />
                {t("Muat turun templat (.csv)", "Download template (.csv)")}
              </button>
            </div>
          </div>
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
              "flex cursor-pointer flex-col items-center gap-2 rounded-[var(--radius-card)] border-[1.5px] border-dashed p-10 text-center transition-colors",
              fileName
                ? "border-[var(--color-primary)]/40 bg-[var(--color-primary-soft)]/40"
                : "border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-primary-soft)]/40",
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
              <Loader2 className="h-7 w-7 animate-spin text-[var(--color-primary)]" />
            ) : (
              <Upload className="h-7 w-7 text-muted-foreground" />
            )}
            {fileName ? (
              <>
                <p className="m-0 text-[14px] font-semibold text-[var(--color-text)]">{fileName}</p>
                <p className="m-0 text-[12.5px] text-muted-foreground">
                  {parsing
                    ? t("Mengenal pasti lajur & menyemak baris…", "Detecting columns & validating rows…")
                    : t("Klik untuk pilih fail lain", "Click to choose a different file")}
                </p>
              </>
            ) : (
              <>
                <p className="m-0 text-[14px] font-semibold text-[var(--color-text)]">
                  {t("Lepaskan fail Excel atau CSV di sini", "Drop an Excel or CSV file here")}
                </p>
                <p className="m-0 text-[12.5px] text-muted-foreground">
                  {t(".csv, .tsv, .txt — maks 5MB (Excel: simpan sebagai CSV)", ".csv, .tsv, .txt — max 5MB (Excel: save as CSV)")}
                </p>
              </>
            )}
          </div>
          <p className="m-0 text-[12px] leading-relaxed text-muted-foreground">
            {t(
              "Tiada apa-apa ditulis ke pangkalan data sehingga anda tekan Import lead pada langkah semakan.",
              "Nothing is written to the database until you press Import leads on the review step.",
            )}
          </p>
        </div>
      </section>

      {parseError && (
        <FollowupErrorState message={parseError} onRetry={file ? () => void parse(file, mapping) : undefined} />
      )}

      {/* 2. Map columns */}
      {headers && (
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
            <h2 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">
              {t("2. Petakan lajur", "2. Map columns")}
            </h2>
            <span className="text-[12.5px] text-muted-foreground">
              {t(`${mappedCount} daripada ${LEAD_FIELDS.length} lajur dipetakan`, `${mappedCount} of ${LEAD_FIELDS.length} columns mapped`)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-4">
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
                  <span className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">
                    {fieldLabel[field]}
                    {required && <span className="text-[var(--color-danger)]"> *</span>}
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
                    className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-[13px] text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none disabled:opacity-50"
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
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
            {!mappingReady && (
              <span className="mr-auto text-[12.5px] text-[var(--color-danger)]">
                {t("Petakan lajur 'Nama' dan 'Telefon' dulu sebelum import.", "Map the 'Name' and 'Phone' columns first before importing.")}
              </span>
            )}
          </div>
        </section>
      )}

      {/* 3. Review & preview */}
      {rows.length > 0 && (
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
            <h2 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">
              {t("3. Semak sebelum import", "3. Review before import")}
            </h2>
            <span className="text-[12.5px] text-muted-foreground">
              {t(`Menunjukkan ${rows.length} baris`, `Showing ${rows.length} rows`)}
            </span>
          </div>
          <div className="flex flex-col gap-3 p-5">
            <div className="grid grid-cols-3 gap-3">
              <SummaryTile tone="success" value={stats.ready} label={t("Sedia untuk import", "Ready to import")} />
              <SummaryTile tone="warning" value={stats.dup} label={t("Nombor duplikat", "Duplicate numbers")} />
              <SummaryTile tone="danger" value={stats.bad} label={t("Baris dengan ralat", "Rows with errors")} />
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]" aria-hidden="true">
              {stats.ready > 0 && <span className="bg-[var(--color-success)]" style={{ width: `${(stats.ready / rows.length) * 100}%` }} />}
              {stats.dup > 0 && <span className="bg-[var(--color-warning)]" style={{ width: `${(stats.dup / rows.length) * 100}%` }} />}
              {stats.bad > 0 && <span className="bg-[var(--color-danger)]" style={{ width: `${(stats.bad / rows.length) * 100}%` }} />}
            </div>
          </div>
          <div className="overflow-x-auto border-t border-[var(--color-border)]">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[var(--color-surface-raised)] text-left text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">{t("Nama", "Name")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("Telepon (asal)", "Phone (raw)")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("Telepon (normal)", "Phone (normalized)")}</th>
                  <th className="px-3 py-2.5 font-semibold">{t("Destinasi", "Destination")}</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Pax</th>
                  <th className="px-3 py-2.5 font-semibold">{t("Status", "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {rows.map((r) => (
                  <tr
                    key={r.rowNo}
                    className={cn(
                      r.status === "invalid" && "bg-[var(--color-danger-soft)]/40",
                      r.status === "duplicate" && "bg-[var(--color-warning-soft)]/40",
                    )}
                  >
                    <td className="px-3 py-2.5 text-muted-foreground">{r.rowNo}</td>
                    <td className="px-3 py-2.5 font-medium text-[var(--color-text)]">{r.name || <span className="text-[var(--color-danger)]">—</span>}</td>
                    <td className={cn("px-3 py-2.5", r.phoneProblem ? "font-semibold text-[var(--color-danger)]" : "text-[var(--color-text-secondary)]")}>
                      {r.phoneRaw || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--color-text-secondary)]">
                        {r.phoneRaw.replace(/\D/g, "") !== r.phoneNormalized.replace(/\D/g, "") && (
                          <span
                            title={t("Dinormalisasi ke format Malaysia", "Normalized to Malaysian format")}
                            className="rounded bg-[var(--color-info-soft)] px-1 py-0.5 font-sans text-[10px] font-bold text-[var(--color-info)]"
                          >
                            MY
                          </span>
                        )}
                        {r.phoneNormalized}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{r.destination || "—"}</td>
                    <td className="px-3 py-2.5 text-right text-[var(--color-text-secondary)]">{r.pax}</td>
                    <td className="px-3 py-2.5">
                      {r.status === "ready" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-success)]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {t("Sedia", "Ready")}
                        </span>
                      )}
                      {r.status === "duplicate" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-warning)]">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {translateReason(r.reason, t)}
                        </span>
                      )}
                      {r.status === "invalid" && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-danger)]">
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
        <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] p-6 text-center text-[13px] text-muted-foreground">
          {t("Fail ini tidak mengandungi baris data.", "This file has no data rows.")}
        </p>
      )}

      {/* History */}
      <section className="flex flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 text-[15px] font-semibold text-[var(--color-text)]">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          {t("Sejarah import", "Import history")}
        </h2>
        {batchesError ? (
          <FollowupErrorState message={batchesError} onRetry={() => void loadBatches()} />
        ) : batches === null ? (
          <FollowupLoading />
        ) : (
          <ImportHistoryPanel
            batches={batches}
            onRetryFixed={retryFixed}
            onDeleteBatch={(id) => void deleteBatch(id)}
          />
        )}
      </section>

      {/* Full-screen overlay: processing → success. Fixed positioning means the
          user never has to scroll down to see it. Auto-dismisses, no button. */}
      {overlay && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 grid place-items-center bg-[color-mix(in_srgb,var(--color-text)_45%,transparent)] backdrop-blur-[3px]"
        >
          {overlay === "processing" ? (
            <div className="flex flex-col items-center gap-5 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] px-12 py-10 shadow-2xl [animation:li-pop-in_var(--duration-base)_var(--ease-out)_both]">
              {/* Animated spreadsheet icon with orbiting status dots */}
              <div className="relative grid h-24 w-24 place-items-center">
                <span className="absolute inset-0 rounded-full bg-[var(--color-primary-soft)] [animation:li-pulse-ring_1.6s_ease-out_infinite]" />
                <span className="absolute inset-3 rounded-full bg-[var(--color-primary-soft)]/70 [animation:li-pulse-ring_1.6s_ease-out_0.4s_infinite]" />
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg [animation:li-float_1.8s_ease-in-out_infinite]">
                  <FileSpreadsheet className="h-7 w-7" />
                </span>
                <span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 [animation:li-spin_2.4s_linear_infinite]">
                  <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[var(--color-primary)]" />
                  <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[var(--color-primary)]/50" />
                </span>
              </div>
              <div className="flex flex-col items-center gap-1.5 text-center">
                <strong className="text-[16px] font-semibold text-[var(--color-text)]">
                  {t("Sedang mengimport lead anda…", "Importing your leads…")}
                </strong>
                <span className="text-[13px] text-muted-foreground">
                  {t("Menyemak pendua & menormalkan nombor telefon", "Checking duplicates & normalizing phone numbers")}
                </span>
              </div>
              {/* Progress bar — indeterminate shimmer */}
              <div className="h-1.5 w-56 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <span className="block h-full w-1/3 rounded-full bg-[var(--color-primary)] [animation:li-slide_1.2s_ease-in-out_infinite]" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-[var(--radius-panel)] border border-[var(--color-success)]/30 bg-[var(--color-surface)] px-12 py-9 text-center shadow-2xl [animation:li-pop-in_var(--duration-base)_var(--ease-out)_both]">
              {/* Success check with confetti-like rays */}
              <div className="relative grid h-24 w-24 place-items-center">
                <span className="absolute inset-0 rounded-full bg-[var(--color-success-soft)] [animation:li-pop-in_0.5s_var(--ease-out)_both]" />
                {Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-[var(--color-success)] [animation:li-burst_0.9s_ease-out_both]"
                    style={{ "--li-angle": `${i * 45}deg`, animationDelay: `${0.05 * i}s` } as React.CSSProperties}
                  />
                ))}
                <span className="relative grid h-16 w-16 place-items-center rounded-full bg-[var(--color-success)] text-white shadow-lg [animation:li-pop-in_0.45s_var(--ease-spring)_both]">
                  <CheckCircle2 className="h-9 w-9" strokeWidth={2.5} />
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <strong className="text-[20px] font-bold text-[var(--color-text)]">
                  {t("Lead berjaya diimport!", "Leads imported successfully!")}
                </strong>
                <span className="text-[13.5px] text-muted-foreground">
                  {doneStats
                    ? t(
                        `${doneStats.added} lead ditambah · ${doneStats.dup} pendua · ${doneStats.bad} gagal`,
                        `${doneStats.added} leads added · ${doneStats.dup} duplicates · ${doneStats.bad} failed`,
                      )
                    : doneNotice}
                </span>
              </div>
              {/* Auto-dismiss progress line (visual only — there is no button) */}
              <div className="h-1 w-40 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <span className="block h-full rounded-full bg-[var(--color-success)] [animation:li-shrink_2.6s_linear_both]" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepPill({ state, num, label }: { state: "active" | "done" | "todo"; num: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 pr-3 text-[12.5px] font-medium",
        state === "active"
          ? "border-[var(--color-primary)]/35 text-[var(--color-text)] font-semibold"
          : state === "done"
            ? "border-[var(--color-border)] text-[var(--color-text-secondary)]"
            : "border-[var(--color-border)] text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold",
          state === "active"
            ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
            : state === "done"
              ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
              : "bg-[var(--color-surface-muted)] text-muted-foreground",
        )}
      >
        {num}
      </span>
      {label}
    </span>
  );
}

function SummaryTile({ tone, value, label }: { tone: "success" | "warning" | "danger"; value: number; label: string }) {
  const toneClass =
    tone === "success"
      ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
      : tone === "warning"
        ? "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
        : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]";
  return (
    <div className={cn("rounded-[var(--radius-control)] px-3 py-2.5", toneClass)}>
      <strong className="block text-[20px] font-bold leading-tight [font-variant-numeric:tabular-nums]">{value}</strong>
      <span className="text-[12px] font-semibold">{label}</span>
    </div>
  );
}

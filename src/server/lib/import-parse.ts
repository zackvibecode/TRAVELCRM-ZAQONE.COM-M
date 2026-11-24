/**
 * Server-side Excel/CSV import parsing + column mapping validation for the
 * WhatsApp Follow-Up CRM (Phase 6).
 *
 * The frontend already parses CSV client-side for preview; this module gives
 * the backend the same quote-aware parser so `/api/followup/import/parse`
 * can validate a mapping (and later commit rows) from raw file text.
 */

/** A single parsed data row (raw cells, before mapping). */
export interface ParsedRow {
  rowNo: number;
  cells: string[];
}

/** Result of parsing a delimited text file. */
export interface ParsedFile {
  headers: string[];
  rows: ParsedRow[];
}

/** Split a single CSV line honoring double-quoted cells. */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === "," || ch === "\t") && !inQuotes) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** Splits text into logical lines (CRLF/LF/CR), preserving quoted newlines. */
function splitLinesKeepQuotes(text: string): string[] {
  const lines: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      lines.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

/**
 * Parse CSV (or TSV) text into headers + rows. Returns null when the file
 * has a header row but no data rows.
 */
export function parseCsvText(text: string): ParsedFile | null {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = splitLinesKeepQuotes(clean).filter((l) => l.trim() !== "");
  if (lines.length < 2) return null;
  const headers = splitCsvLine(lines[0]);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.some((cell) => cell !== "")) {
      rows.push({ rowNo: i + 1, cells });
    }
  }
  if (rows.length === 0) return null;
  return { headers, rows };
}

/** Column roles the import flow can map. */
export type ImportColumnRole = "name" | "phone" | "destination" | "pax";

/** Header aliases per role, bilingual (Malay/English). */
export const HEADER_ALIASES: Record<ImportColumnRole, string[]> = {
  name: ["name", "nama", "customer name", "nama pelanggan", "full name", "nama penuh"],
  phone: ["phone", "telefon", "tel", "mobile", "whatsapp", "no phone", "no tel", "nombor telefon", "contact"],
  destination: ["destination", "destinasi", "package", "pakej", "trip", "perjalanan"],
  pax: ["pax", "pax count", "bilangan", "人数", "quantity", "qty"],
};

/**
 * Auto-detect the column mapping from headers using the bilingual aliases.
 * Returns the best-guess mapping (unmapped roles are undefined).
 */
export function autoMapColumns(headers: string[]): Partial<Record<ImportColumnRole, number>> {
  const mapping: Partial<Record<ImportColumnRole, number>> = {};
  const used = new Set<number>();
  for (const role of Object.keys(HEADER_ALIASES) as ImportColumnRole[]) {
    const aliases = HEADER_ALIASES[role];
    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue;
      const h = headers[i].trim().toLowerCase();
      if (aliases.includes(h)) {
        mapping[role] = i;
        used.add(i);
        break;
      }
    }
  }
  return mapping;
}

/** Normalizes a raw phone string to the +60 Malaysian format when possible. */
export function normalizeMyPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("60")) return `+${digits}`;
  if (digits.startsWith("0")) return `+60${digits.slice(1)}`;
  return `+${digits}`;
}

/** Why a mapped row is rejected. */
export type RowProblem = "empty_phone" | "invalid_phone" | "empty_name" | "duplicate_in_file";

export interface ValidatedRow {
  rowNo: number;
  name: string;
  phoneRaw: string;
  phoneNormalized: string;
  destination: string;
  pax: number;
  problems: RowProblem[];
}

/**
 * Apply a column mapping to parsed rows and validate every row:
 * name + phone required, phone must contain 7–15 digits, and rows whose
 * normalized phone already appeared earlier in the same file are flagged
 * `duplicate_in_file` (only the first occurrence is kept clean).
 */
export function applyMappingValidate(
  parsed: ParsedFile,
  mapping: Partial<Record<ImportColumnRole, number>>,
): ValidatedRow[] {
  const nameIdx = mapping.name;
  const phoneIdx = mapping.phone;
  const destIdx = mapping.destination;
  const paxIdx = mapping.pax;
  const seenPhones = new Set<string>();
  const out: ValidatedRow[] = [];
  for (const row of parsed.rows) {
    const name = nameIdx !== undefined ? (row.cells[nameIdx] ?? "") : "";
    const phoneRaw = phoneIdx !== undefined ? (row.cells[phoneIdx] ?? "") : "";
    const destination = destIdx !== undefined ? (row.cells[destIdx] ?? "") : "";
    const paxCell = paxIdx !== undefined ? (row.cells[paxIdx] ?? "") : "";
    const pax = Number.parseInt(paxCell.replace(/\D/g, ""), 10);
    const problems: RowProblem[] = [];
    if (name.trim() === "") problems.push("empty_name");
    const digits = phoneRaw.replace(/\D/g, "");
    if (digits === "") problems.push("empty_phone");
    else if (digits.length < 7 || digits.length > 15) problems.push("invalid_phone");
    const phoneNormalized = normalizeMyPhone(phoneRaw);
    // In-file duplicate detection: same normalized phone as an earlier row.
    if (phoneNormalized !== "" && seenPhones.has(phoneNormalized)) {
      problems.push("duplicate_in_file");
    } else if (phoneNormalized !== "") {
      seenPhones.add(phoneNormalized);
    }
    out.push({
      rowNo: row.rowNo,
      name: name.trim(),
      phoneRaw: phoneRaw.trim(),
      phoneNormalized,
      destination: destination.trim(),
      pax: Number.isNaN(pax) ? 1 : pax,
      problems,
    });
  }
  return out;
}

/** Validates a mapping request: name + phone columns must be mapped. */
export function validateMapping(
  mapping: Partial<Record<ImportColumnRole, number>>,
): { ok: true } | { ok: false; missing: ImportColumnRole[] } {
  const missing: ImportColumnRole[] = [];
  if (mapping.name === undefined) missing.push("name");
  if (mapping.phone === undefined) missing.push("phone");
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}

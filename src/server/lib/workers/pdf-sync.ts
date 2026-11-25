import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
  parseLooseJson,
  workersAiChat,
  WORKERS_AI_DEFAULT_MODEL,
} from "../ai-client";
import { extractPdfText } from "../pdf-extract";

/**
 * Supplier PDF Sync worker — reads a supplier brochure PDF, extracts the
 * structured package data (name, prices, day-by-day itinerary), matches it
 * against an existing package, and produces a DIFF proposal stored as a
 * `pending_review` run. Nothing is written to the package until an admin
 * clicks Apply on the AI Workers page.
 */

export interface PdfPackageDraft {
  name: string;
  destination: string;
  durationDays: number;
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: Array<{
    dayNumber: number;
    title: string;
    description: string;
    mealIncluded?: string[];
  }>;
}

export interface PackageDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface PdfSyncResult {
  draft: PdfPackageDraft;
  matchedPackageId: string | null;
  matchedPackageName: string | null;
  diff: PackageDiff[];
}

const MAX_PDF_TEXT = 24000;

/** Ask Workers AI to structure the raw PDF text. */
export async function extractDraftFromPdf(ai: Ai, pdfText: string): Promise<PdfPackageDraft> {
  const clipped =
    pdfText.length > MAX_PDF_TEXT
      ? `${pdfText.slice(0, MAX_PDF_TEXT)}\n[...text truncated]`
      : pdfText;

  const raw = await workersAiChat(ai, {
    system: [
      "You extract structured travel-package data from supplier brochures (often Malaysian umrah/holiday packages).",
      "Reply with ONLY a JSON object matching exactly:",
      '{"name": string, "destination": string, "durationDays": number, "adultPrice": number, "childPrice": number, "infantPrice": number, "highlights": string[], "inclusions": string[], "exclusions": string[], "itinerary": [{"dayNumber": number, "title": string, "description": string, "mealIncluded": string[]}]}',
      "Rules:",
      "- Prices are integers in MYR — use 0 when the brochure does not state one.",
      "- mealIncluded uses codes: B, L, D, MOB. Empty array when not stated.",
      "- itinerary: one entry per day found in the brochure. Keep titles short, descriptions 1-3 sentences in the brochure's language.",
      "- Never invent content that is not in the document.",
    ].join("\n"),
    user: `Brochure text:\n${clipped}`,
    model: WORKERS_AI_DEFAULT_MODEL,
    temperature: 0.1,
    maxTokens: 4000,
  });

  return sanitiseDraft(parseLooseJson<PdfPackageDraft>(raw));
}

function sanitiseDraft(draft: PdfPackageDraft): PdfPackageDraft {
  const str = (v: unknown, fallback = "") =>
    typeof v === "string" ? v.trim() : fallback;
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };
  const list = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
      : [];

  return {
    name: str(draft.name) || "Pakej dari PDF",
    destination: str(draft.destination) || "-",
    durationDays: num(draft.durationDays),
    adultPrice: num(draft.adultPrice),
    childPrice: num(draft.childPrice),
    infantPrice: num(draft.infantPrice),
    highlights: list(draft.highlights),
    inclusions: list(draft.inclusions),
    exclusions: list(draft.exclusions),
    itinerary: Array.isArray(draft.itinerary)
      ? draft.itinerary
          .filter((d) => d && typeof d === "object")
          .map((d, i) => ({
            dayNumber: Number(d.dayNumber) || i + 1,
            title: str(d.title) || `Hari ${i + 1}`,
            description: str(d.description),
            mealIncluded: Array.isArray(d.mealIncluded)
              ? d.mealIncluded.filter(
                  (m): m is string => typeof m === "string",
                )
              : [],
          }))
      : [],
  };
}

/** Best-effort match: exact/substring name match, else destination match. */
async function matchPackage(
  db: DrizzleD1Database<typeof schema>,
  draft: PdfPackageDraft,
): Promise<{ id: string; name: string } | null> {
  const name = draft.name.toLowerCase().replace(/\s+/g, " ").trim();
  const dest = draft.destination.toLowerCase().replace(/\s+/g, " ").trim();

  const byName = await db
    .select({ id: schema.packages.id, name: schema.packages.name })
    .from(schema.packages)
    .where(
      and(
        eq(schema.packages.publishStatus, "published"),
        sql`lower(${schema.packages.name}) LIKE ${`%${name.slice(0, 40)}%`}`,
      ),
    )
    .limit(1);
  if (byName.length) return byName[0];

  if (dest && dest !== "-") {
    const byDest = await db
      .select({ id: schema.packages.id, name: schema.packages.name })
      .from(schema.packages)
      .where(
        and(
          eq(schema.packages.publishStatus, "published"),
          sql`lower(${schema.packages.destination}) LIKE ${`%${dest.slice(0, 40)}%`}`,
        ),
      )
      .limit(1);
    if (byDest.length) return byDest[0];
  }
  return null;
}

function diffPrimitive(field: string, oldValue: unknown, newValue: unknown): PackageDiff | null {
  if (oldValue === newValue) return null;
  if (
    typeof oldValue === "number" &&
    typeof newValue === "number" &&
    oldValue === newValue
  ) {
    return null;
  }
  // Zero on the PDF side means "not stated" — do not propose wiping real data.
  if (newValue === 0 || newValue === "" || newValue === "-") return null;
  return { field, oldValue, newValue };
}

function diffList(field: string, oldValue: string[], newValue: string[]): PackageDiff | null {
  if (!newValue.length) return null;
  if (
    oldValue.length === newValue.length &&
    oldValue.every((v, i) => v === newValue[i])
  ) {
    return null;
  }
  return { field, oldValue, newValue };
}

/** Build the change proposal between the stored package and the PDF draft. */
export function buildDiff(
  existing: {
    name: string;
    destination: string;
    durationDays: number;
    adultPrice: number;
    childPrice: number;
    infantPrice: number;
    highlights: string[];
    inclusions: string[];
    exclusions: string[];
    itinerary: Array<Record<string, unknown>> | string[];
  },
  draft: PdfPackageDraft,
): PackageDiff[] {
  const diffs: PackageDiff[] = [];
  const push = (d: PackageDiff | null) => {
    if (d) diffs.push(d);
  };

  push(diffPrimitive("name", existing.name, draft.name));
  push(diffPrimitive("destination", existing.destination, draft.destination));
  push(diffPrimitive("durationDays", existing.durationDays, draft.durationDays));
  push(diffPrimitive("adultPrice", existing.adultPrice, draft.adultPrice));
  push(diffPrimitive("childPrice", existing.childPrice, draft.childPrice));
  push(diffPrimitive("infantPrice", existing.infantPrice, draft.infantPrice));
  push(diffList("highlights", existing.highlights, draft.highlights));
  push(diffList("inclusions", existing.inclusions, draft.inclusions));
  push(diffList("exclusions", existing.exclusions, draft.exclusions));

  if (
    draft.itinerary.length &&
    (existing.itinerary as Array<unknown>).length !== draft.itinerary.length
  ) {
    push({
      field: "itinerary",
      oldValue: `${(existing.itinerary as Array<unknown>).length} hari`,
      newValue: `${draft.itinerary.length} hari`,
    });
  } else if (
    draft.itinerary.length &&
    !(existing.itinerary as Array<unknown>).length
  ) {
    push({ field: "itinerary", oldValue: "(kosong)", newValue: `${draft.itinerary.length} hari` });
  }
  return diffs;
}

/**
 * Full pipeline: PDF bytes → structured draft → package match → diff.
 * The caller persists the result as a `pending_review` run.
 */
export async function runPdfSync(
  db: DrizzleD1Database<typeof schema>,
  ai: Ai,
  bytes: ArrayBuffer,
): Promise<PdfSyncResult> {
  const extraction = await extractPdfText(bytes);
  if (!extraction.text || extraction.text.trim().length < 40) {
    throw new Error(
      "PDF tidak mengandungi teks yang boleh dibaca. Sila tampal itinerary sebagai teks.",
    );
  }

  const draft = await extractDraftFromPdf(ai, extraction.text);
  const match = await matchPackage(db, draft);

  let diff: PackageDiff[] = [];
  if (match) {
    const rows = await db
      .select({
        name: schema.packages.name,
        destination: schema.packages.destination,
        durationDays: schema.packages.durationDays,
        adultPrice: schema.packages.adultPrice,
        childPrice: schema.packages.childPrice,
        infantPrice: schema.packages.infantPrice,
        highlights: schema.packages.highlights,
        inclusions: schema.packages.inclusions,
        exclusions: schema.packages.exclusions,
        itinerary: schema.packages.itinerary,
      })
      .from(schema.packages)
      .where(eq(schema.packages.id, match.id))
      .limit(1);
    if (rows.length) {
      diff = buildDiff(rows[0], draft);
    }
  }

  return {
    draft,
    matchedPackageId: match?.id ?? null,
    matchedPackageName: match?.name ?? null,
    diff,
  };
}

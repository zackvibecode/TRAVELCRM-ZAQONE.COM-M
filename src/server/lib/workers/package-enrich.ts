import { and, eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
  parseLooseJson,
  workersAiChat,
  WORKERS_AI_DEFAULT_MODEL,
} from "../ai-client";

/**
 * Package Enrichment worker — finds published packages with empty marketing
 * fields (description, highlights, inclusions) and fills them from the
 * existing itinerary using Workers AI. It only fills BLANK fields: it never
 * overwrites content an admin already wrote, and never touches prices.
 */

const MAX_PACKAGES_PER_RUN = 10;

export interface EnrichedPackage {
  packageId: string;
  name: string;
  filled: string[];
}

export interface EnrichRunResult {
  scanned: number;
  enriched: EnrichedPackage[];
  failed: number;
}

/** LLM output shape for one package. */
interface EnrichDraft {
  description: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
}

function enrichSystemPrompt(): string {
  return [
    "You are a senior travel copywriter for a Malaysian travel agency.",
    "Given a package itinerary (day-by-day plan) and destination, write concise marketing copy.",
    "Reply with ONLY a JSON object, no markdown, matching exactly:",
    '{"description": string, "highlights": string[], "inclusions": string[], "exclusions": string[]}',
    "Rules:",
    '- "description": 2-3 engaging sentences in MALAY (Bahasa Melayu) about the trip experience.',
    '- "highlights": 4-6 short punchy bullets in Malay (max 12 words each).',
    '- "inclusions": realistic standard items (transport, hotel, meals, guide, tickets) in Malay.',
    '- "exclusions": realistic items NOT included (flight tix unless stated, personal expenses, tips, travel insurance) in Malay.',
    "- Base everything on the itinerary given. Never invent places not in the plan.",
    "- No prices in any field.",
  ].join("\n");
}

function enrichUserPrompt(pkg: {
  name: string;
  destination: string;
  durationDays: number;
  itinerary: string[];
}): string {
  const itineraryText = pkg.itinerary.length
    ? pkg.itinerary
        .map((d, i) => `Day ${i + 1}: ${d}`)
        .join("\n")
    : `${pkg.durationDays}-day trip to ${pkg.destination} (no detailed itinerary provided).`;
  return [
    `Package: ${pkg.name}`,
    `Destination: ${pkg.destination}`,
    `Duration: ${pkg.durationDays} days`,
    "Itinerary:",
    itineraryText,
  ].join("\n");
}

/** Parse a possibly-non-array day field into a string list. */
function itineraryToList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((d) => {
        if (typeof d === "string") return d;
        if (d && typeof d === "object") {
          const obj = d as Record<string, unknown>;
          return [obj.title, obj.description].filter(Boolean).join(" — ");
        }
        return "";
      })
      .filter((s) => s.trim().length > 0);
  }
  return [];
}

/** True when the package is missing at least one fillable marketing field. */
function isIncomplete(pkg: {
  description: string | null;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
}): boolean {
  return (
    !pkg.description?.trim() ||
    pkg.highlights.length === 0 ||
    pkg.inclusions.length === 0 ||
    pkg.exclusions.length === 0
  );
}

/** Validate + sanitise the LLM draft; returns null when unusable. */
function sanitiseDraft(draft: unknown): EnrichDraft | null {
  if (!draft || typeof draft !== "object") return null;
  const d = draft as Partial<EnrichDraft>;
  const description = typeof d.description === "string" ? d.description.trim() : "";
  const toList = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
      : [];
  const highlights = toList(d.highlights);
  const inclusions = toList(d.inclusions);
  const exclusions = toList(d.exclusions);
  if (!description && highlights.length === 0 && inclusions.length === 0) return null;
  return { description, highlights, inclusions, exclusions };
}

/**
 * Run one enrichment cycle. Returns what was scanned/enriched so the caller
 * can persist an `ai_worker_runs` record.
 */
export async function runPackageEnrichment(
  db: DrizzleD1Database<typeof schema>,
  ai: Ai,
): Promise<EnrichRunResult> {
  // Published packages (visible to customers) with at least one blank field.
  const rows = await db
    .select({
      id: schema.packages.id,
      name: schema.packages.name,
      destination: schema.packages.destination,
      durationDays: schema.packages.durationDays,
      description: schema.packages.description,
      highlights: schema.packages.highlights,
      itinerary: schema.packages.itinerary,
      inclusions: schema.packages.inclusions,
      exclusions: schema.packages.exclusions,
    })
    .from(schema.packages)
    .where(eq(schema.packages.publishStatus, "published"))
    .limit(60);

  const candidates = rows.filter(isIncomplete).slice(0, MAX_PACKAGES_PER_RUN);
  const enriched: EnrichedPackage[] = [];
  let failed = 0;

  for (const pkg of candidates) {
    try {
      const raw = await workersAiChat(ai, {
        system: enrichSystemPrompt(),
        user: enrichUserPrompt({
          name: pkg.name,
          destination: pkg.destination,
          durationDays: pkg.durationDays,
          itinerary: itineraryToList(pkg.itinerary),
        }),
        model: WORKERS_AI_DEFAULT_MODEL,
        temperature: 0.4,
        maxTokens: 1500,
      });
      const draft = sanitiseDraft(parseLooseJson<EnrichDraft>(raw));
      if (!draft) {
        failed += 1;
        continue;
      }

      // Only fill BLANK fields — never overwrite admin-written content.
      const filled: string[] = [];
      const updates: Record<string, unknown> = {};
      if (!pkg.description?.trim() && draft.description) {
        updates.description = draft.description;
        filled.push("description");
      }
      if (pkg.highlights.length === 0 && draft.highlights.length) {
        updates.highlights = draft.highlights;
        filled.push("highlights");
      }
      if (pkg.inclusions.length === 0 && draft.inclusions.length) {
        updates.inclusions = draft.inclusions;
        filled.push("inclusions");
      }
      if (pkg.exclusions.length === 0 && draft.exclusions.length) {
        updates.exclusions = draft.exclusions;
        filled.push("exclusions");
      }

      if (!filled.length) continue;

      await db
        .update(schema.packages)
        .set({ ...updates, updatedAt: sql`datetime('now')` })
        .where(and(eq(schema.packages.id, pkg.id)));
      enriched.push({ packageId: pkg.id, name: pkg.name, filled });
    } catch (err) {
      console.error(`[ai-worker:enrich] package ${pkg.id} failed`, err);
      failed += 1;
    }
  }

  return { scanned: candidates.length, enriched, failed };
}

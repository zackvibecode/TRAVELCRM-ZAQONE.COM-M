import { eq, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import {
  parseLooseJson,
  workersAiChat,
  WORKERS_AI_DEFAULT_MODEL,
} from "../ai-client";

/**
 * Price & Margin Checker worker — compares the selling price of each package
 * with the supplier costs recorded against its departures and asks the LLM
 * to flag low-margin packages with concrete suggestions. The report is
 * advisory only: prices are never changed automatically.
 */

const MAX_PACKAGES = 20;

export interface PackageMargin {
  packageId: string;
  name: string;
  sellPrice: number;
  costPerPax: number;
  marginPerPax: number;
  marginPct: number | null;
}

export interface PriceCheckRunResult {
  analysed: number;
  lowMargin: PackageMargin[];
  report: string;
  recommendations: Array<{ packageId: string; note: string }>;
}

interface PackageMarginDraft {
  summary: string;
  recommendations: Array<{ packageId: string; note: string }>;
}

/**
 * Run one margin-analysis cycle. Costs are read from `departure_costs`
 * (estimated preferred, otherwise actual) for open departures of each
 * package, averaged per package.
 */
export async function runPriceCheck(
  db: DrizzleD1Database<typeof schema>,
  ai: Ai,
): Promise<PriceCheckRunResult> {
  // Selling price: latest departure price if set, otherwise the package base price.
  const rows = await db.all<{
    package_id: string;
    name: string;
    destination: string;
    package_price: number;
    departure_price: number | null;
    cost_per_pax: number | null;
  }>(sql`
    SELECT p.id AS package_id, p.name, p.destination, p.adult_price AS package_price,
           d.departure_price, c.cost_per_pax
    FROM packages p
    LEFT JOIN (
      SELECT package_id, adult_price AS departure_price
      FROM departures
      WHERE id IN (
        SELECT MIN(id) FROM departures WHERE status = 'open' GROUP BY package_id
      )
    ) d ON d.package_id = p.id
    LEFT JOIN (
      SELECT dep.package_id,
             ROUND(AVG(
               CASE
                 WHEN dc.estimated_amount > 0 THEN dc.estimated_amount
                 ELSE dc.actual_amount
               END
             )) AS cost_per_pax
      FROM departure_costs dc
      JOIN departures dep ON dep.id = dc.departure_id
      GROUP BY dep.package_id
    ) c ON c.package_id = p.id
    WHERE p.publish_status = 'published'
    LIMIT ${MAX_PACKAGES}
  `);

  const margins: PackageMargin[] = rows.map((r) => {
    const sell = Number(r.departure_price ?? r.package_price ?? 0);
    const cost = Number(r.cost_per_pax ?? 0);
    const marginPerPax = sell - cost;
    const marginPct = sell > 0 ? Math.round((marginPerPax / sell) * 1000) / 10 : null;
    return {
      packageId: r.package_id,
      name: r.name,
      sellPrice: sell,
      costPerPax: cost,
      marginPerPax,
      marginPct,
    };
  });

  if (!margins.length) {
    return {
      analysed: 0,
      lowMargin: [],
      report: "Tiada pakej published untuk dianalisis.",
      recommendations: [],
    };
  }

  const dataText = margins
    .map(
      (m) =>
        `- ${m.name} (id=${m.packageId}, ${m.sellPrice} MYR jual, kos ${m.costPerPax} MYR/pax, margin ${m.marginPerPax} MYR (${m.marginPct ?? "?"}%))`,
    )
    .join("\n");

  let summary = "";
  let recommendations: PackageMarginDraft["recommendations"] = [];
  try {
    const raw = await workersAiChat(ai, {
      system: [
        "You are a travel-business pricing analyst for a Malaysian agency.",
        "Given per-package selling prices and supplier costs, identify packages with unhealthy margins (below ~15%).",
        "Reply with ONLY a JSON object: {\"summary\": string, \"recommendations\": [{\"packageId\": string, \"note\": string}]}",
        '- "summary": 2-3 sentences in MALAY about the overall pricing health.',
        '- "note": one concrete suggestion in MALAY (e.g. suggested new price or what cost to renegotiate).',
        "- Only recommend for packages whose margin is genuinely low. If all are healthy, return an empty recommendations list and say so in the summary.",
        "- Prices in MYR. Never invent costs that are not in the data.",
      ].join("\n"),
      user: `Package margins:\n${dataText}`,
      model: WORKERS_AI_DEFAULT_MODEL,
      temperature: 0.3,
      maxTokens: 1500,
    });
    const draft = parseLooseJson<PackageMarginDraft>(raw);
    summary = typeof draft.summary === "string" ? draft.summary : "";
    recommendations = Array.isArray(draft.recommendations)
      ? draft.recommendations
          .filter(
            (r): r is { packageId: string; note: string } =>
              r &&
              typeof r.packageId === "string" &&
              typeof r.note === "string",
          )
          .slice(0, 10)
      : [];
  } catch (err) {
    console.error("[ai-worker:price-check] LLM analysis failed", err);
    summary =
      "Analisis AI gagal — berikut margin mentah setiap pakej untuk semakan manual.";
  }

  const lowMargin = margins
    .filter((m) => m.marginPct !== null && m.marginPct < 15)
    .slice(0, 10);

  return {
    analysed: margins.length,
    lowMargin,
    report: summary,
    recommendations,
  };
}

/** Helper kept for the router: mark a run as done with the report payload. */
export async function finishPriceCheckRun(
  db: DrizzleD1Database<typeof schema>,
  runId: string,
  result: PriceCheckRunResult,
  summary: string,
): Promise<void> {
  await db
    .update(schema.aiWorkerRuns)
    .set({ status: "done", result: result as unknown as Record<string, unknown>, summary })
    .where(eq(schema.aiWorkerRuns.id, runId));
}

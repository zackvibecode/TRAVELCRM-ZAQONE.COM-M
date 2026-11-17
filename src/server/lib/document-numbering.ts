import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../db/schema";

/** Format a document number from a numbering_rules row. */
export function formatNumber(
  rule: typeof schema.numberingRules.$inferSelect,
  no: number,
  when = new Date(),
): string {
  const seq = String(no).padStart(rule.digits, "0");
  const year = when.getUTCFullYear();
  const month = String(when.getUTCMonth() + 1).padStart(2, "0");
  switch (rule.resetOn) {
    case "month":
      return `${rule.prefix}-${year}-${month}-${seq}`;
    case "year":
      return `${rule.prefix}-${year}-${seq}`;
    case "never":
    default:
      return `${rule.prefix}-${seq}`;
  }
}

/**
 * Atomically consume the next number for a document type from app_settings
 * numbering_rules. Falls back to a legacy prefix when no rule is configured.
 */
export async function nextDocumentNumber(
  db: DrizzleD1Database<typeof schema>,
  doc: "booking" | "invoice" | "receipt" | "quote" | "credit_note",
): Promise<string> {
  const rows = await db
    .select()
    .from(schema.numberingRules)
    .where(eq(schema.numberingRules.doc, doc))
    .limit(1);
  const rule = rows[0];
  if (!rule) {
    const year = new Date().getFullYear();
    const fallback: typeof schema.numberingRules.$inferSelect = {
      id: "fallback",
      doc,
      prefix: doc === "invoice" ? "INV" : doc.toUpperCase().slice(0, 3),
      digits: 6,
      nextNo: 1,
      resetOn: "year",
      lastResetAt: null,
      updatedAt: new Date(),
    };
    return formatNumber(fallback, 1).replace(String(year), String(year));
  }

  // Period reset check (year/month).
  const now = new Date();
  let nextNo = rule.nextNo;
  const last = rule.lastResetAt;
  if (rule.resetOn !== "never" && last) {
    const same =
      rule.resetOn === "year"
        ? last.getUTCFullYear() === now.getUTCFullYear()
        : last.getUTCFullYear() === now.getUTCFullYear() &&
          last.getUTCMonth() === now.getUTCMonth();
    if (!same) nextNo = 1;
  }

  await db
    .update(schema.numberingRules)
    .set({ nextNo: nextNo + 1, lastResetAt: now, updatedAt: now })
    .where(eq(schema.numberingRules.id, rule.id));

  return formatNumber(rule, nextNo, now);
}

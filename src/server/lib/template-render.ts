/**
 * WhatsApp template rendering on the server.
 *
 * A template body carries {{placeholders}}. Rendering replaces each token
 * with a real value; tokens with no value (unknown or empty) are left
 * visible so the sales rep sees exactly what is missing before sending.
 * Mirrors `fillTemplate` in src/components/TemplatePickerDialog.tsx so the
 * server preview and the client preview never disagree.
 */
import { KL_OFFSET_MINUTES } from "./kl-time";

/** Placeholders every template may use. */
export const TEMPLATE_PLACEHOLDERS = ["leadName", "packageName", "date", "salesName"] as const;

export type TemplatePlaceholder = (typeof TEMPLATE_PLACEHOLDERS)[number];

/** Values a template is rendered with. `date` is a KL-local date string. */
export interface TemplateRenderValues {
  leadName: string;
  packageName: string;
  /** KL-formatted date string, see `formatKlDate`. */
  date: string;
  salesName: string;
}

/** A template row as stored, reduced to what rendering needs. */
export interface TemplateLike {
  code: string;
  name: string;
  locale: "en" | "ms";
  body: string;
  stage: string | null;
  active: boolean;
}

/** Rendered template ready for a wa.me link. */
export interface RenderedTemplate {
  code: string;
  name: string;
  locale: "en" | "ms";
  stage: string | null;
  body: string;
  /** Placeholders that had no value and are still visible in `body`. */
  missing: TemplatePlaceholder[];
  /** Character count of the rendered body (WhatsApp limit is 4096). */
  length: number;
}

export const WA_MESSAGE_LIMIT = 4096;

const TOKEN_RE = /\{\{(\w+)\}\}/g;

/** Every distinct {{token}} in the body, in order of first appearance. */
export function tokensIn(body: string): string[] {
  const found: string[] = [];
  for (const m of body.matchAll(TOKEN_RE)) {
    if (!found.includes(m[0])) found.push(m[0]);
  }
  return found;
}

/** {{tokens}} in the body that are not in TEMPLATE_PLACEHOLDERS. */
export function unknownTokensIn(body: string): string[] {
  const known = new Set<string>(TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`));
  return tokensIn(body).filter((token) => !known.has(token));
}

/**
 * Formats a UTC instant as a KL calendar date, in the template's language.
 * Malaysia is UTC+8 with no DST, so the offset is exact.
 *   en → "Tuesday, 24 Nov 2026"
 *   ms → "Selasa, 24 Nov 2026"
 */
export function formatKlDate(ms: number, lang: "en" | "ms" = "en"): string {
  const kl = new Date(ms + KL_OFFSET_MINUTES * 60_000);
  return new Intl.DateTimeFormat(lang === "ms" ? "ms-MY" : "en-MY", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(kl);
}

/**
 * Fills `body` with `values`. Tokens with no value are left visible.
 * `{{date}}` is filled from `values.date`; pass a `formatKlDate` result.
 */
export function renderTemplate(body: string, values: TemplateRenderValues): string {
  const map: Record<string, string> = {
    "{{leadName}}": values.leadName,
    "{{packageName}}": values.packageName,
    "{{date}}": values.date,
    "{{salesName}}": values.salesName,
  };
  return body.replace(TOKEN_RE, (whole) => {
    const v = map[whole];
    return v && v.trim() ? v : whole;
  });
}

/**
 * Renders a template fully and reports which placeholders are still
 * unfilled. Used by the preview endpoint so the UI can warn before sending.
 */
export function renderTemplateWithMeta(
  template: TemplateLike,
  values: TemplateRenderValues,
): RenderedTemplate {
  const body = renderTemplate(template.body, values);
  const known = new Set<string>(TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`));
  const missing = tokensIn(body)
    .filter((token) => known.has(token))
    .map((token) => token.slice(2, -2) as TemplatePlaceholder);
  return {
    code: template.code,
    name: template.name,
    locale: template.locale,
    stage: template.stage,
    body,
    missing,
    length: [...body].length,
  };
}

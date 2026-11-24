/**
 * Verifies the WhatsApp template rendering contract from
 * src/server/lib/template-render.ts.
 * Run: npx tsx scripts/test-template-render.ts
 *
 * Contract under test:
 *   - every known placeholder is replaced with its value
 *   - a token with an empty/whitespace value is left visible
 *   - unknown tokens are detected and never stripped
 *   - {{date}} is a KL calendar date, in the template's language
 *   - length counts code points (emoji-safe) and missing lists unfilled tokens
 */
import {
  renderTemplate,
  renderTemplateWithMeta,
  formatKlDate,
  tokensIn,
  unknownTokensIn,
  type TemplateLike,
} from "../src/server/lib/template-render";

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}

const full = { leadName: "Priya Raman", packageName: "Korea Winter 6D5N", date: "Tuesday, 24 Nov 2026", salesName: "Ayu Rahma" };

// --- 1. all placeholders replaced -----------------------------------------
const r1 = renderTemplate(
  "Hi {{leadName}}, {{salesName}} here about {{packageName}} on {{date}}.",
  full,
);
assert("all placeholders replaced", r1 === "Hi Priya Raman, Ayu Rahma here about Korea Winter 6D5N on Tuesday, 24 Nov 2026.", r1);

// --- 2. empty value leaves token visible -----------------------------------
const r2 = renderTemplate("Hi {{leadName}}, call me.", { ...full, leadName: "" });
assert("empty value leaves token visible", r2 === "Hi {{leadName}}, call me.", r2);
const r2b = renderTemplate("Hi {{leadName}}.", { ...full, leadName: "   " });
assert("whitespace-only value leaves token visible", r2b === "Hi {{leadName}}.", r2b);

// --- 3. token scanning -----------------------------------------------------
assert("tokensIn finds distinct tokens in order", JSON.stringify(tokensIn("{{a}} {{b}} {{a}}")) === JSON.stringify(["{{a}}", "{{b}}"]));
assert("unknownTokensIn flags non-chema tokens", JSON.stringify(unknownTokensIn("{{leadName}} {{foo}} {{bar}}")) === JSON.stringify(["{{foo}}", "{{bar}}"]));
assert("unknownTokensIn is empty for valid body", unknownTokensIn("{{leadName}} {{packageName}} {{date}} {{salesName}}").length === 0);
assert("unknown token is NOT stripped by render", renderTemplate("Hi {{foo}}", full) === "Hi {{foo}}");

// --- 4. KL date formatting -------------------------------------------------
// 2026-11-23T16:30:00Z == 2026-11-24 00:30 KL (Tuesday).
const t = Date.parse("2026-11-23T16:30:00Z");
assert("formatKlDate en uses KL calendar day", formatKlDate(t, "en") === "Tuesday, 24 Nov 2026", formatKlDate(t, "en"));
assert("formatKlDate ms uses KL calendar day + Malay weekday", formatKlDate(t, "ms") === "Selasa, 24 Nov 2026", formatKlDate(t, "ms"));
// 2026-11-23T15:59:59Z is still 23 Nov 23:59 KL (Monday).
const t2 = Date.parse("2026-11-23T15:59:59Z");
assert("formatKlDate does not roll over before KL midnight", formatKlDate(t2, "en") === "Monday, 23 Nov 2026", formatKlDate(t2, "en"));

// --- 5. renderTemplateWithMeta ---------------------------------------------
const tpl: TemplateLike = { code: "fu1-intro", name: "FU1", locale: "en", body: "Hi {{leadName}}, {{packageName}} on {{date}}. {{custom}}", stage: "FU1", active: true };
const meta = renderTemplateWithMeta(tpl, { ...full, date: "" });
assert("meta.body rendered with empty date left visible", meta.body === "Hi Priya Raman, Korea Winter 6D5N on {{date}}. {{custom}}", meta.body);
assert("meta.missing lists only unfilled KNOWN placeholders", JSON.stringify(meta.missing) === JSON.stringify(["date"]), JSON.stringify(meta.missing));
assert("meta.length counts code points", meta.length === [...meta.body].length);
assert("meta echoes code/locale/stage", meta.code === "fu1-intro" && meta.locale === "en" && meta.stage === "FU1");

// "👍" is a single code point but 2 UTF-16 units, so a naive .length
// would report 14 here. Code-point counting must report 13.
const emoji = renderTemplateWithMeta(
  { ...tpl, body: "👍 {{leadName}}" },
  full,
);
assert("length is emoji-safe (code points, not UTF-16 units)", emoji.length === 13 && emoji.body.length === 14, `codepoints=${emoji.length} utf16=${emoji.body.length}`);

console.log(failed === 0 ? "\nAll template-render checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);

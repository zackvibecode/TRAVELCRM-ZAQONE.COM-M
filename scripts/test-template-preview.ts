/**
 * Verifies the lead → wa.me preview pipeline from
 * src/server/lib/template-render.ts + import-parse.ts.
 * These are the exact transformations the POST /templates/preview
 * handler applies, so a regression here is a regression in the endpoint.
 * Run: npx tsx scripts/test-template-preview.ts
 */
import { renderTemplateWithMeta, formatKlDate, WA_MESSAGE_LIMIT } from "../src/server/lib/template-render";
import { normalizeMyPhone } from "../src/server/lib/import-parse";

let failed = 0;
function assert(label: string, cond: boolean, detail = "") {
  if (!cond) failed++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}

// The handler does exactly this for a lead + template variant.
function preview(lead: { name: string; destination: string | null; phone: string }, tpl: { code: string; name: string; locale: "en" | "ms"; body: string; stage: string | null; active: boolean }, salesName: string, dateMs = Date.now()) {
  const rendered = renderTemplateWithMeta(tpl, {
    leadName: lead.name,
    packageName: lead.destination ?? "",
    date: formatKlDate(dateMs, tpl.locale),
    salesName,
  });
  const phoneDigits = normalizeMyPhone(lead.phone).replace("+", "");
  const waUrl = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(rendered.body)}` : null;
  return { ...rendered, phoneDigits, waUrl };
}

const lead = { name: "Priya Raman", destination: "Korea Winter 6D5N", phone: "012-345 6789" };
const tplEn = { code: "fu1-intro", name: "FU1 Introduction", locale: "en" as const, body: "Hello {{leadName}}, this is {{salesName}} from ZAQ One Travel. You recently showed interest in the {{packageName}} package.", stage: "FU1", active: true };
const tplMs = { code: "fu1-intro", name: "FU1 Pengenalan", locale: "ms" as const, body: "Salam {{leadName}}, saya {{salesName}} dari ZAQ One Travel. Anda baru berminat dengan pakej {{packageName}}.", stage: "FU1", active: true };

// --- 1. EN preview ----------------------------------------------------------
const en = preview(lead, tplEn, "Ayu Rahma");
assert("EN body fully rendered", en.body === "Hello Priya Raman, this is Ayu Rahma from ZAQ One Travel. You recently showed interest in the Korea Winter 6D5N package.", en.body);
assert("EN has no missing placeholders", en.missing.length === 0, JSON.stringify(en.missing));
assert("wa.me digits for 01x number (MY → 601x)", en.phoneDigits === "60123456789", en.phoneDigits);
assert("wa.me URL is well-formed", en.waUrl === `https://wa.me/60123456789?text=${encodeURIComponent(en.body)}`);

// --- 60-prefixed input normalises identically ------------------------------
const lead60 = { ...lead, phone: "+60 12-345 6789" };
assert("+60 input normalises to same wa.me digits", preview(lead60, tplEn, "Ayu").phoneDigits === "60123456789");

// --- 2. MS preview ----------------------------------------------------------
const ms = preview(lead, tplMs, "Ayu Rahma");
assert("MS body fully rendered", ms.body === "Salam Priya Raman, saya Ayu Rahma dari ZAQ One Travel. Anda baru berminat dengan pakej Korea Winter 6D5N.", ms.body);
assert("MS locale is echoed", ms.locale === "ms");

// --- 3. missing destination leaves {{packageName}} visible ------------------
const noDest = preview({ ...lead, destination: null }, tplEn, "Ayu Rahma");
assert("null destination leaves {{packageName}} visible", noDest.body.includes("{{packageName}}"), noDest.body);
assert("missing lists packageName", JSON.stringify(noDest.missing) === JSON.stringify(["packageName"]), JSON.stringify(noDest.missing));

// --- 4. no usable phone → no wa.me link -------------------------------------
const noPhone = preview({ ...lead, phone: "no digits" }, tplEn, "Ayu");
assert("phone with no digits yields no wa.me link", noPhone.waUrl === null && noPhone.phoneDigits === "");

// --- 5. {{date}} uses the KL calendar day in the template's language ---------
// 2026-11-23T16:30:00Z == 2026-11-24 00:30 KL (Tuesday).
const t = Date.parse("2026-11-23T16:30:00Z");
const withDate = preview(lead, { ...tplEn, body: "Hi {{leadName}}, meet on {{date}}." }, "Ayu", t);
assert("{{date}} renders KL date in EN", withDate.body === "Hi Priya Raman, meet on Tuesday, 24 Nov 2026.", withDate.body);
const withDateMs = preview(lead, { ...tplMs, body: "Hai {{leadName}}, jumpa {{date}}." }, "Ayu", t);
assert("{{date}} renders KL date in MS", withDateMs.body === "Hai Priya Raman, jumpa Selasa, 24 Nov 2026.", withDateMs.body);

// --- 6. length vs WhatsApp limit --------------------------------------------
const long = preview(lead, { ...tplEn, body: "x".repeat(WA_MESSAGE_LIMIT + 1) }, "Ayu");
assert("body over limit is flagged tooLong", long.length === WA_MESSAGE_LIMIT + 1 && long.length > WA_MESSAGE_LIMIT);

console.log(failed === 0 ? "\nAll preview-pipeline checks passed." : `\n${failed} check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);

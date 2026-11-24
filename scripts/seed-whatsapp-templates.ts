/**
 * Seeds the default bilingual WhatsApp templates (EN + MS) for the three
 * follow-up stages. Idempotent: existing rows with the same (code, locale)
 * are left untouched, so re-running never overwrites admin edits.
 *
 * Run (local D1):   npx tsx scripts/seed-whatsapp-templates.ts
 * Run (remote D1):  npx tsx scripts/seed-whatsapp-templates.ts --remote
 */
import { execSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync, rmSync } from "node:fs";

type Seed = {
  id: string;
  code: string;
  name: string;
  locale: "en" | "ms";
  body: string;
  stage: "FU1" | "FU2" | "FU3";
};

/**
 * The default templates. Kept in sync with the UI preview copy in
 * src/pages/WhatsAppTemplates.tsx (MOCK_TEMPLATES) so what the admin sees
 * on first load matches what the picker sends.
 */
export const DEFAULT_TEMPLATES: Seed[] = [
  {
    id: "wt_fu1_en",
    code: "fu1-intro",
    name: "FU1 Introduction",
    locale: "en",
    body: "Hello {{leadName}}, this is {{salesName}} from ZAQ One Travel. You recently showed interest in the {{packageName}} package. May I share more details?",
    stage: "FU1",
  },
  {
    id: "wt_fu1_ms",
    code: "fu1-intro",
    name: "FU1 Pengenalan",
    locale: "ms",
    body: "Salam {{leadName}}, saya {{salesName}} dari ZAQ One Travel. Anda baru berminat dengan pakej {{packageName}}. Boleh saya kongsikan butiran lanjut?",
    stage: "FU1",
  },
  {
    id: "wt_fu2_en",
    code: "fu2-reminder",
    name: "FU2 Gentle Reminder",
    locale: "en",
    body: "Hi {{leadName}}, just a gentle reminder from {{salesName}} about the {{packageName}} package. Do you have any questions before deciding?",
    stage: "FU2",
  },
  {
    id: "wt_fu2_ms",
    code: "fu2-reminder",
    name: "FU2 Peringatan Lembut",
    locale: "ms",
    body: "Hai {{leadName}}, ini peringatan mesra daripada {{salesName}} mengenai pakej {{packageName}}. Adakah anda ada sebarang soalan sebelum membuat keputusan?",
    stage: "FU2",
  },
  {
    id: "wt_fu3_en",
    code: "fu3-final",
    name: "FU3 Final Follow-Up",
    locale: "en",
    body: "Hello {{leadName}}, this is my last follow-up regarding the {{packageName}} package. Let me know if you would still like to proceed.",
    stage: "FU3",
  },
  {
    id: "wt_fu3_ms",
    code: "fu3-final",
    name: "FU3 Susulan Akhir",
    locale: "ms",
    body: "Helo {{leadName}}, ini susulan terakhir saya mengenai pakej {{packageName}}. Beritahu saya jika anda masih ingin meneruskan.",
    stage: "FU3",
  },
];

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function main() {
  const remote = process.argv.includes("--remote");
  const values = DEFAULT_TEMPLATES.map(
    (t) =>
      `(${sqlString(t.id)}, ${sqlString(t.code)}, ${sqlString(t.name)}, ${sqlString(t.locale)}, ${sqlString(t.body)}, ${sqlString(t.stage)}, 1)`,
  ).join(",\n  ");

  // INSERT OR IGNORE keyed on the UNIQUE(code, locale) index: a re-run adds
  // nothing and never clobbers a template the admin has already edited.
  const sql = `INSERT OR IGNORE INTO whatsapp_templates (id, code, name, locale, body, stage, active) VALUES\n  ${values};`;

  const tmp = join(tmpdir(), `seed-wa-templates-${Date.now()}.sql`);
  writeFileSync(tmp, sql, "utf8");
  try {
    execSync(`npx wrangler d1 execute travelos-suite ${remote ? "--remote" : "--local"} --file "${tmp}"`, { stdio: "inherit" });
  } finally {
    rmSync(tmp, { force: true });
  }
  console.log(`\nSeeded ${DEFAULT_TEMPLATES.length} default templates (${remote ? "remote" : "local"}).`);
}

main();

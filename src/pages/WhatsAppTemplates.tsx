import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  Languages,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { followupApi, type TemplateGroup } from "@/lib/followup-api";
import { useTemplates } from "@/lib/useFollowup";
import {
  FollowupEmptyState,
  FollowupErrorState,
  FollowupLoading,
} from "@/components/FollowupStates";

/**
 * WhatsApp message templates — one logical template, two locales (en / ms).
 * The body supports {{placeholders}} that are filled per lead before the
 * message is opened in WhatsApp through a wa.me link (click-to-chat only).
 */
export type TemplateLocale = "en" | "ms";
export type TemplateStage = "FU1" | "FU2" | "FU3" | null;

/** Placeholders the follow-up engine knows how to fill. */
export const TEMPLATE_PLACEHOLDERS = [
  { token: "{{leadName}}", ms: "Nama lead", en: "Lead name", sample: "Nurul Aisyah" },
  { token: "{{packageName}}", ms: "Nama pakej", en: "Package name", sample: "Langkawi 4D3N" },
  { token: "{{date}}", ms: "Tarikh susulan", en: "Follow-up date", sample: "28 Nov 2026" },
  { token: "{{salesName}}", ms: "Nama sales", en: "Sales name", sample: "Ayu Rahma" },
] as const;

/** One WhatsApp template row (mirrors the whatsapp_templates table). */
export interface WaTemplate {
  id: string;
  /** Stable code shared by the en + ms rows of one logical template. */
  code: string;
  name: string;
  locale: TemplateLocale;
  /** Message body with {{placeholders}}. */
  body: string;
  /** Stage this template serves (FU1/FU2/FU3) or null for general use. */
  stage: TemplateStage;
  active: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export function flattenTemplateGroups(groups: TemplateGroup[]): WaTemplate[] {
  const out: WaTemplate[] = [];
  for (const g of groups) {
    const base = {
      code: g.code,
      name: g.name,
      stage: (g.stage as TemplateStage) ?? null,
      active: g.active,
      createdBy: null,
      createdAt: g.updatedAt,
      updatedAt: g.updatedAt,
    };
    if (g.variants.en) out.push({ ...base, id: g.variants.en.id, locale: "en", body: g.variants.en.body });
    if (g.variants.ms) out.push({ ...base, id: g.variants.ms.id, locale: "ms", body: g.variants.ms.body });
  }
  return out;
}

/** Fills {{placeholders}} with sample values for the live preview. */
export function fillSample(body: string): string {
  return TEMPLATE_PLACEHOLDERS.reduce(
    (text, p) => text.split(p.token).join(p.sample),
    body,
  );
}

/** Editor dialog state — both locale bodies edited together. */
export interface TemplateEditorState {
  /** Null when creating; otherwise the code being edited. */
  code: string | null;
  name: string;
  stage: TemplateStage;
  enBody: string;
  msBody: string;
}

/** Validation errors keyed by field. */
export function validateTemplate(
  name: string,
  enBody: string,
  msBody: string,
): { name?: string; enBody?: string; msBody?: string } {
  const errors: { name?: string; enBody?: string; msBody?: string } = {};
  if (!name.trim()) errors.name = "required";
  if (!enBody.trim()) errors.enBody = "required";
  if (!msBody.trim()) errors.msBody = "required";
  return errors;
}

/** Turns a template name into a URL-safe code (fallback: tpl-<n>). */
export function templateCodeFrom(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `tpl-${Date.now().toString(36)}`;
}

/** WhatsApp splits a single message above this many characters. */
export const WA_MESSAGE_LIMIT = 4096;
/** Warn once the filled message is within this margin of the limit. */
export const WA_WARN_MARGIN = 400;

/** "ok" | "warn" | "over" for a message body length. */
export function lengthStatus(len: number): "ok" | "warn" | "over" {
  if (len > WA_MESSAGE_LIMIT) return "over";
  if (len >= WA_MESSAGE_LIMIT - WA_WARN_MARGIN) return "warn";
  return "ok";
}

/** Tokens actually used in a body, in order of first appearance. */
export function placeholdersIn(body: string): string[] {
  const found: string[] = [];
  for (const p of TEMPLATE_PLACEHOLDERS) {
    if (body.includes(p.token) && !found.includes(p.token)) found.push(p.token);
  }
  return found;
}

/** Every {{token}} in a body, including unknown ones. */
export function allTokensIn(body: string): string[] {
  const found: string[] = [];
  for (const m of body.matchAll(/\{\{(\w+)\}\}/g)) {
    const token = m[0];
    if (!found.includes(token)) found.push(token);
  }
  return found;
}

/** Tokens that look like placeholders but have no value source. */
export function unknownTokensIn(body: string): string[] {
  const known = new Set<string>(TEMPLATE_PLACEHOLDERS.map((p) => p.token));
  return allTokensIn(body).filter((token) => !known.has(token));
}

const STAGE_LABELS: Record<Exclude<TemplateStage, null>, [string, string]> = {
  FU1: ["Susulan 1", "Follow-up 1"],
  FU2: ["Susulan 2", "Follow-up 2"],
  FU3: ["Susulan 3", "Follow-up 3"],
};

export default function WhatsAppTemplates() {
  const { t, lang } = useLang();
  const query = useTemplates();
  const templates = useMemo(() => flattenTemplateGroups(query.data ?? []), [query.data]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | "FU1" | "FU2" | "FU3" | "general">("all");
  /** The locale whose card is shown first / expanded by default. */
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  /** Bilingual create/edit dialog — null when closed. */
  const [editor, setEditor] = useState<TemplateEditorState | null>(null);
  /** Template code pending deactivation — confirm dialog shown while set. */
  const [pendingDeactivate, setPendingDeactivate] = useState<string | null>(null);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  /** Toggles active for BOTH locale rows of one logical template. */
  async function applyActive(code: string, next: boolean) {
    const group = templates.filter((x) => x.code === code);
    try {
      await followupApi.toggleTemplate(code, next);
      await query.refetch();
      showNotice(
        next
          ? t(`${group[0]?.name ?? ""} diaktifkan.`, `${group[0]?.name ?? ""} activated.`)
          : t(`${group[0]?.name ?? ""} dinyahaktifkan.`, `${group[0]?.name ?? ""} deactivated.`),
      );
    } catch (err) {
      showNotice(err instanceof Error ? err.message : String(err));
    }
  }

  /** Deactivate goes through a confirm dialog; activate is immediate. */
  function toggleActive(code: string) {
    const group = templates.filter((x) => x.code === code);
    const next = !group.every((x) => x.active);
    if (next) {
      void applyActive(code, true);
    } else {
      setPendingDeactivate(code);
    }
  }

  function confirmDeactivate() {
    if (pendingDeactivate) void applyActive(pendingDeactivate, false);
    setPendingDeactivate(null);
  }

  /** Copies the filled sample body to the clipboard. */
  async function copyBody(tpl: WaTemplate) {
    try {
      await navigator.clipboard.writeText(fillSample(tpl.body));
      showNotice(t("Mesej disalin ke papan klip.", "Message copied to clipboard."));
    } catch {
      showNotice(t("Papan klip tidak tersedia.", "Clipboard unavailable."));
    }
  }

  /** Persists the bilingual form through the templates API. */
  async function saveTemplate(draft: TemplateEditorState): Promise<boolean> {
    const errors = validateTemplate(draft.name, draft.enBody, draft.msBody);
    if (Object.keys(errors).length > 0) return false;
    // Unknown placeholders are a hard block — the message would ship with raw {{tokens}}.
    if (unknownTokensIn(draft.enBody).length > 0 || unknownTokensIn(draft.msBody).length > 0) {
      showNotice(t("Placeholder tidak dikenali — periksa mesej.", "Unknown placeholders — check the message."));
      return false;
    }
    const payload = {
      name: draft.name,
      stage: draft.stage,
      enBody: draft.enBody,
      msBody: draft.msBody,
    };
    try {
      if (draft.code) {
        await followupApi.updateTemplate(draft.code, payload);
      } else {
        await followupApi.createTemplate({ ...payload, code: templateCodeFrom(draft.name) });
      }
      setEditor(null);
      await query.refetch();
      showNotice(
        draft.code
          ? t("Templat dikemas kini.", "Template updated.")
          : t("Templat baharu disimpan.", "New template saved."),
      );
      return true;
    } catch (err) {
      showNotice(err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  /** Groups locale rows into logical templates: one card per `code`. */
  const groups = useMemo(() => {
    const map = new Map<string, { code: string; name: string; stage: TemplateStage; rows: WaTemplate[] }>();
    for (const tpl of templates) {
      const g = map.get(tpl.code);
      if (g) g.rows.push(tpl);
      else map.set(tpl.code, { code: tpl.code, name: tpl.name, stage: tpl.stage, rows: [tpl] });
    }
    return [...map.values()];
  }, [templates]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      const matchQuery =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q) ||
        g.rows.some((r) => r.body.toLowerCase().includes(q));
      const matchStage =
        stageFilter === "all" ||
        (stageFilter === "general" ? g.stage === null : g.stage === stageFilter);
      return matchQuery && matchStage;
    });
  }, [groups, search, stageFilter]);

  const stageOptions: { value: "all" | "FU1" | "FU2" | "FU3" | "general"; label: string }[] = [
    { value: "all", label: t("Semua peringkat", "All stages") },
    { value: "FU1", label: t("Susulan 1", "Follow-up 1") },
    { value: "FU2", label: t("Susulan 2", "Follow-up 2") },
    { value: "FU3", label: t("Susulan 3", "Follow-up 3") },
    { value: "general", label: t("Umum", "General") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-[22px] font-bold tracking-tight">
            {t("Templat WhatsApp", "WhatsApp Templates")}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {t(
              "Templat mesej dwibahasa dengan placeholder — pratonton sebelum dibuka di WhatsApp.",
              "Bilingual message templates with placeholders — preview before opening in WhatsApp.",
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-soft)] px-3 py-1.5 text-[12px] font-bold text-[var(--color-success)]">
            <MessageCircle className="h-3.5 w-3.5" />
            {t("Klik untuk sembang", "Click-to-chat")}
          </span>
          <button
            type="button"
            onClick={() => setEditor({ code: null, name: "", stage: "FU1", enBody: "", msBody: "" })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-[12.5px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("Templat baharu", "New template")}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("Ringkasan templat", "Template summary")}>
        <MetricCard label={t("Jumlah templat", "Total templates")} icon={Languages} value={String(groups.length)} note={t("Setiap satu dalam EN & BM", "Each in EN & BM")} />
        <MetricCard label={t("Aktif", "Active")} icon={CheckCircle2} value={String(groups.filter((g) => g.rows.every((r) => r.active)).length)} note={t("Sedia digunakan", "Ready to use")} />
        <MetricCard label={t("Peringkat", "Stages")} icon={Sparkles} value={String(groups.filter((g) => g.stage !== null).length)} note={t("FU1 · FU2 · FU3", "FU1 · FU2 · FU3")} />
        <MetricCard label={t("Placeholder", "Placeholders")} icon={Copy} value={String(TEMPLATE_PLACEHOLDERS.length)} note={t("Diisi automatik", "Filled automatically")} />
      </section>

      <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <div className="flex min-w-0 max-w-[300px] flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Cari nama, kod, isi mesej…", "Search name, code, message body…")}
              aria-label={t("Cari templat", "Search templates")}
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none"
            />
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {t("Peringkat", "Stage")}
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2 text-[13px]"
            >
              {stageOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        {query.loading ? (
          <FollowupLoading label={t("Memuatkan templat...", "Loading templates...")} />
        ) : query.status === "error" ? (
          <div className="px-4 py-4">
            <FollowupErrorState message={query.error ?? ""} onRetry={() => void query.refetch()} />
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-4">
            <FollowupEmptyState
              icon={MessageCircle}
              title={
                groups.length === 0
                  ? t("Tiada templat lagi", "No templates yet")
                  : t("Tiada templat sepadan", "No templates match")
              }
              description={
                groups.length === 0
                  ? t(
                      "Cipta templat dwibahasa pertama anda untuk memulakan susulan WhatsApp.",
                      "Create your first bilingual template to start WhatsApp follow-ups.",
                    )
                  : t("Tukar kata kunci atau tapis peringkat.", "Change the keyword or stage filter.")
              }
              action={
                groups.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setEditor({ code: null, name: "", stage: "FU1", enBody: "", msBody: "" })}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-[12.5px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("Templat baharu", "New template")}
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="m-0 flex flex-col gap-3 list-none px-4 pb-4">
            {visible.map((g) => (
              <TemplateCard
                key={g.code}
                code={g.code}
                name={g.name}
                stage={g.stage}
                rows={g.rows}
                preferredLocale={lang}
                expanded={previewId === g.code}
                onTogglePreview={() => setPreviewId((cur) => (cur === g.code ? null : g.code))}
                onToggleActive={toggleActive}
                onCopy={copyBody}
                onEdit={() => {
                  const en = g.rows.find((r) => r.locale === "en");
                  const ms = g.rows.find((r) => r.locale === "ms");
                  setEditor({ code: g.code, name: g.name, stage: g.stage, enBody: en?.body ?? "", msBody: ms?.body ?? "" });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      {editor && (
        <TemplateEditorDialog
          draft={editor}
          onChange={setEditor}
          onClose={() => setEditor(null)}
          onSave={() => saveTemplate(editor)}
        />
      )}

      {pendingDeactivate && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-deactivate-title"
          onClick={(e) => { if (e.target === e.currentTarget) setPendingDeactivate(null); }}
        >
          <div className="w-full max-w-[420px] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <h2 id="tpl-deactivate-title" className="m-0 font-display text-[17px] font-bold">
              {t("Nyahaktifkan templat?", "Deactivate template?")}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {t(
                `${templates.find((x) => x.code === pendingDeactivate)?.name ?? ""} tidak akan muncul dalam pilihan sales sehingga diaktifkan semula.`,
                `${templates.find((x) => x.code === pendingDeactivate)?.name ?? ""} will not appear in the sales picker until reactivated.`,
              )}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeactivate(null)}
                className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)]"
              >
                {t("Batal", "Cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDeactivate}
                autoFocus
                className="rounded-lg bg-[var(--color-danger)] px-3.5 py-2 text-[13px] font-bold text-white hover:opacity-90"
              >
                {t("Nyahaktifkan", "Deactivate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-6 right-6 z-[60] flex max-w-[340px] items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-text)] px-3.5 py-3 text-[13px] text-[var(--color-surface)] shadow-2xl" role="status" aria-live="polite">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label={t("Tutup", "Dismiss")} onClick={() => setNotice("")} className="grid place-items-center">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, icon: Icon, value, note }: { label: string; icon: typeof Languages; value: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-display text-[24px] font-bold leading-tight tracking-tight [font-variant-numeric:tabular-nums]">{value}</span>
      <span className="text-[12px] text-muted-foreground">{note}</span>
    </div>
  );
}

/** One logical template: header + one message bubble per locale. */
function TemplateCard({
  code,
  name,
  stage,
  rows,
  preferredLocale,
  expanded,
  onTogglePreview,
  onToggleActive,
  onCopy,
  onEdit,
}: {
  code: string;
  name: string;
  stage: TemplateStage;
  rows: WaTemplate[];
  preferredLocale: TemplateLocale;
  expanded: boolean;
  onTogglePreview: () => void;
  onToggleActive: (code: string) => void;
  onCopy: (tpl: WaTemplate) => void;
  onEdit: () => void;
}) {
  const { t } = useLang();
  const ordered = [...rows].sort((a, b) => (a.locale === preferredLocale ? -1 : b.locale === preferredLocale ? 1 : 0));
  const allActive = rows.every((r) => r.active);
  return (
    <li className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="m-0 font-display text-[15px] font-bold">{name}</h2>
            <span className="rounded-full bg-[var(--color-neutral-soft)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">{code}</span>
            {stage ? (
              <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-primary)]">{t(...STAGE_LABELS[stage])}</span>
            ) : (
              <span className="rounded-full bg-[var(--color-neutral-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">{t("Umum", "General")}</span>
            )}
            <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", allActive ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-neutral-soft)] text-[var(--color-text-secondary)]")}>
              {allActive ? t("Aktif", "Active") : t("Tidak aktif", "Inactive")}
            </span>
          </div>
          <p className="m-0 mt-1 text-[12px] text-muted-foreground">
            {t(
              `${ordered.length} bahasa · ${placeholdersIn(ordered[0]?.body ?? "").length} placeholder`,
              `${ordered.length} languages · ${placeholdersIn(ordered[0]?.body ?? "").length} placeholders`,
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-raised)]"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t("Edit", "Edit")}
          </button>
          <button
            type="button"
            onClick={onTogglePreview}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-raised)]"
          >
            <Eye className="h-3.5 w-3.5" />
            {expanded ? t("Tutup pratonton", "Hide preview") : t("Pratonton", "Preview")}
          </button>
          <button
            type="button"
            onClick={() => onToggleActive(code)}
            disabled={rows.length === 0}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[12px] font-semibold hover:bg-[var(--color-surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allActive ? t("Nyahaktif", "Deactivate") : t("Aktifkan", "Activate")}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {ordered.map((row) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">
                <Languages className="h-3.5 w-3.5" />
                {row.locale === "ms" ? "Bahasa Malaysia" : "English"}
              </span>
              <button
                type="button"
                onClick={() => onCopy(row)}
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--color-primary)] hover:underline"
              >
                <Copy className="h-3 w-3" />
                {t("Salin", "Copy")}
              </button>
            </div>
            <p className="m-0 whitespace-pre-wrap rounded-[14px] rounded-tl-[4px] bg-[#d9fdd3] px-3 py-2 text-[13px] leading-relaxed text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
              {expanded ? fillSample(row.body) : row.body}
            </p>
            {expanded && placeholdersIn(row.body).length > 0 && (
              <p className="m-0 text-[11.5px] text-muted-foreground">
                {t("Diisi dengan: ", "Filled with: ")}
                {placeholdersIn(row.body).map((token) => (t(TEMPLATE_PLACEHOLDERS.find((p) => p.token === token)?.ms ?? token, TEMPLATE_PLACEHOLDERS.find((p) => p.token === token)?.en ?? token))).join(" · ")}
              </p>
            )}
          </div>
        ))}
      </div>
    </li>
  );
}

/** Create/edit dialog — both locale bodies in one form, live preview, placeholder chips. */
function TemplateEditorDialog({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: TemplateEditorState;
  onChange: (next: TemplateEditorState) => void;
  onClose: () => void;
  onSave: () => Promise<boolean> | boolean;
}) {
  const { t } = useLang();
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const errors = validateTemplate(draft.name, draft.enBody, draft.msBody);
  const showErrors = touched || false;
  const isEdit = draft.code !== null;

  async function submit() {
    setTouched(true);
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  function patch(partial: Partial<TemplateEditorState>) {
    onChange({ ...draft, ...partial });
  }

  /** Inserts a placeholder token at the caret of the given textarea. */
  function insertPlaceholder(token: string, which: "en" | "ms") {
    const key = which === "en" ? "enBody" : "msBody";
    const el = document.getElementById(`tpl-body-${which}`) as HTMLTextAreaElement | null;
    const body = draft[key];
    if (!el) {
      patch({ [key]: `${body}${body ? " " : ""}${token}` } as Partial<TemplateEditorState>);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    patch({ [key]: next } as Partial<TemplateEditorState>);
    // Restore the caret after React re-renders.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tpl-editor-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="tpl-editor-title" className="m-0 font-display text-[17px] font-bold">
              {isEdit ? t("Edit templat", "Edit template") : t("Templat baharu", "New template")}
            </h2>
            <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
              {t("Satu templat, dua bahasa — EN & BM.", "One template, two languages — EN & BM.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Tutup", "Close")}
            className="grid h-8 w-8 flex-none place-items-center rounded-lg hover:bg-[var(--color-surface-raised)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted-foreground">
              {t("Nama templat", "Template name")}
              <input
                type="text"
                value={draft.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={t("cth. FU1 Perkenalan", "e.g. FU1 Introduction")}
                aria-invalid={showErrors && !!errors.name}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] text-foreground aria-[invalid=true]:border-[var(--color-danger)]"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[12px] font-semibold text-muted-foreground">
              {t("Peringkat", "Stage")}
              <select
                value={draft.stage ?? "general"}
                onChange={(e) => patch({ stage: e.target.value === "general" ? null : (e.target.value as TemplateStage) })}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px]"
              >
                <option value="FU1">{t("Susulan 1", "Follow-up 1")}</option>
                <option value="FU2">{t("Susulan 2", "Follow-up 2")}</option>
                <option value="FU3">{t("Susulan 3", "Follow-up 3")}</option>
                <option value="general">{t("Umum", "General")}</option>
              </select>
            </label>
          </div>

          {/* Placeholder chips — click to insert into the active locale. */}
          <div>
            <p className="m-0 mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Placeholder — klik untuk masukkan", "Placeholders — click to insert")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_PLACEHOLDERS.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  // Inserts into the last-focused locale; default to the UI language.
                  onClick={() => insertPlaceholder(p.token, (document.activeElement?.id ?? "").endsWith("-ms") ? "ms" : "en")}
                  title={t(p.ms, p.en)}
                  className="rounded-full border border-dashed border-[var(--color-primary)]/50 bg-[var(--color-primary-soft)] px-2.5 py-1 font-mono text-[11.5px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/15"
                >
                  {p.token}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <LocaleBodyField
              id="tpl-body-en"
              locale="en"
              label="English"
              value={draft.enBody}
              error={showErrors && !!errors.enBody}
              onChange={(v) => patch({ enBody: v })}
              onInsert={(token) => insertPlaceholder(token, "en")}
            />
            <LocaleBodyField
              id="tpl-body-ms"
              locale="ms"
              label="Bahasa Malaysia"
              value={draft.msBody}
              error={showErrors && !!errors.msBody}
              onChange={(v) => patch({ msBody: v })}
              onInsert={(token) => insertPlaceholder(token, "ms")}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-3">
          <p className="m-0 text-[11.5px] text-muted-foreground">
            {t("Placeholder diisi automatik sebelum dihantar.", "Placeholders are filled automatically before sending.")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)]"
            >
              {t("Batal", "Cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[13px] font-bold text-[var(--color-primary-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? t("Menyimpan...", "Saving...")
                : isEdit
                  ? t("Simpan perubahan", "Save changes")
                  : t("Simpan templat", "Save template")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One locale's body textarea + live filled preview. */
function LocaleBodyField({
  id,
  locale,
  label,
  value,
  error,
  onChange,
  onInsert,
}: {
  id: string;
  locale: TemplateLocale;
  label: string;
  value: string;
  error: boolean;
  onChange: (v: string) => void;
  onInsert: (token: string) => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
          <Languages className="h-3.5 w-3.5" />
          {label}
        </label>
        <span
          className={cn(
            "font-mono text-[11px]",
            lengthStatus(value.length) === "over"
              ? "font-bold text-[var(--color-danger)]"
              : lengthStatus(value.length) === "warn"
                ? "font-bold text-[var(--color-warning)]"
                : "text-muted-foreground",
          )}
        >
          {value.length}/{WA_MESSAGE_LIMIT}
        </span>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, WA_MESSAGE_LIMIT + 500))}
        maxLength={WA_MESSAGE_LIMIT + 500}
        rows={5}
        aria-invalid={error}
        placeholder={
          locale === "ms"
            ? "Tulis mesej di sini…"
            : "Write the message here…"
        }
        className="resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:border-[var(--color-primary)] aria-[invalid=true]:border-[var(--color-danger)]"
      />
      {error && (
        <p className="m-0 text-[11.5px] font-semibold text-[var(--color-danger)]" role="alert">
          {t("Mesej diperlukan.", "Message is required.")}
        </p>
      )}
      {unknownTokensIn(value).length > 0 && (
        <p className="m-0 rounded-md bg-[var(--color-warning-soft)] px-2 py-1.5 text-[11.5px] font-semibold text-[var(--color-warning)]" role="alert">
          {t("Placeholder tidak dikenali (tidak akan diisi): ", "Unknown placeholders (will not be filled): ")}
          {unknownTokensIn(value).join(", ")}
        </p>
      )}
      {lengthStatus(value.length) === "warn" && (
        <p className="m-0 rounded-md bg-[var(--color-warning-soft)] px-2 py-1.5 text-[11.5px] font-semibold text-[var(--color-warning)]" role="alert">
          {t(
            `Hampir had WhatsApp (${WA_MESSAGE_LIMIT} aksara) — mesej mungkin dipecahkan.`,
            `Approaching WhatsApp's limit (${WA_MESSAGE_LIMIT} chars) — the message may be split.`,
          )}
        </p>
      )}
      {lengthStatus(value.length) === "over" && (
        <p className="m-0 rounded-md bg-[var(--color-danger-soft)] px-2 py-1.5 text-[11.5px] font-semibold text-[var(--color-danger)]" role="alert">
          {t(
            `Terlalu panjang — WhatsApp akan memecahkannya kepada beberapa mesej.`,
            `Too long — WhatsApp will split it into multiple messages.`,
          )}
        </p>
      )}
      {/* Live preview with sample values. */}
      <p className="m-0 whitespace-pre-wrap rounded-[14px] rounded-tl-[4px] bg-[#d9fdd3] px-3 py-2 text-[12.5px] leading-relaxed text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
        {value.trim() ? fillSample(value) : t("Pratonton mesej…", "Message preview…")}
      </p>
      <div className="flex flex-wrap gap-1">
        {TEMPLATE_PLACEHOLDERS.map((p) => (
          <button
            key={p.token}
            type="button"
            onClick={() => onInsert(p.token)}
            className="rounded bg-[var(--color-neutral-soft)] px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
          >
            +{p.token}
          </button>
        ))}
      </div>
    </div>
  );
}


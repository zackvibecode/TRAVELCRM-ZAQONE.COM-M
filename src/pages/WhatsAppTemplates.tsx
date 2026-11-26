import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Languages,
  Loader2,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Save,
  Send,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { followupApi, type TemplateGroup } from "@/lib/followup-api";
import { useLeadList, useTemplates } from "@/lib/useFollowup";
import {
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
  { token: "{{date}}", ms: "Tarikh susulan", en: "Follow-up date", sample: "Khamis, 26 Nov 2026" },
  { token: "{{salesName}}", ms: "Nama sales", en: "Sales name", sample: "" },
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

/** Fills {{placeholders}} for the live preview. `salesName` overrides the sample. */
export function fillSample(body: string, salesName?: string): string {
  return TEMPLATE_PLACEHOLDERS.reduce(
    (text, p) => {
      const value = p.token === "{{salesName}}" && salesName ? salesName : p.sample;
      return text.split(p.token).join(value);
    },
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

export default function WhatsAppTemplates() {
  const { t, lang } = useLang();
  const query = useTemplates();
  const templates = useMemo(() => flattenTemplateGroups(query.data ?? []), [query.data]);
  /** Logical groups: one per code, with its en/ms rows. */
  const groups = useMemo(() => {
    const map = new Map<string, { code: string; name: string; stage: TemplateStage; rows: WaTemplate[] }>();
    for (const tpl of templates) {
      const g = map.get(tpl.code);
      if (g) g.rows.push(tpl);
      else map.set(tpl.code, { code: tpl.code, name: tpl.name, stage: tpl.stage, rows: [tpl] });
    }
    return [...map.values()];
  }, [templates]);

  const [langFilter, setLangFilter] = useState<"all" | "en" | "ms">("all");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  /** Signed-in rep's real name — the same value the engine fills {{salesName}} with. */
  const salesName = getSession()?.name ?? "";
  /** Today's KL date for {{date}} — what the engine uses by default. */
  const departDate = useMemo(() => {
    const kl = new Date(Date.now() + 8 * 3600 * 1000);
    return kl.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }, []);
  const [notice, setNotice] = useState("");
  /** Bilingual create/edit dialog — null when closed. */
  const [editor, setEditor] = useState<TemplateEditorState | null>(null);
  /** Template code pending deactivation — confirm dialog shown while set. */
  const [pendingDeactivate, setPendingDeactivate] = useState<string | null>(null);

  /**
   * Compose-panel draft. Edits are held locally until the user presses Save,
   * instead of firing an API call on every keystroke (which raced with
   * refetch and wiped what the user typed).
   */
  const [draftName, setDraftName] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);

  /** Real leads for the "Preview for" selector. */
  const leadList = useLeadList({}, 200);
  const leads = useMemo(() => leadList.data?.data ?? [], [leadList.data]);
  const [leadId, setLeadId] = useState<string>("");

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  }

  const visibleGroups = useMemo(
    () => groups.filter((g) => langFilter === "all" || g.rows.some((r) => r.locale === langFilter)),
    [groups, langFilter],
  );

  const selectedGroup = useMemo(
    () => groups.find((g) => g.code === selectedCode) ?? visibleGroups[0] ?? null,
    [groups, selectedCode, visibleGroups],
  );

  const selectedRow = useMemo(() => {
    if (!selectedGroup) return null;
    return (
      selectedGroup.rows.find((r) => r.locale === lang) ??
      selectedGroup.rows.find((r) => r.locale === "en") ??
      selectedGroup.rows[0] ??
      null
    );
  }, [selectedGroup, lang]);

  // Reset the draft whenever the selected template or UI language changes,
  // or when a refetch brings back fresh server values.
  const draftKey = selectedRow ? `${selectedRow.id}:${selectedRow.updatedAt}` : "";
  useEffect(() => {
    setDraftName(selectedGroup?.name ?? "");
    setDraftBody(selectedRow?.body ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  /** True when the compose panel has edits that are not saved yet. */
  const dirty =
    !!selectedGroup &&
    !!selectedRow &&
    (draftName !== selectedGroup.name || draftBody !== selectedRow.body);

  /** Persists the compose-panel draft with a single API call. */
  async function saveDraft() {
    if (!selectedGroup || !selectedRow) return;
    if (!draftName.trim() || !draftBody.trim()) {
      showNotice(t("Nama dan mesej templat diperlukan.", "Template name and message are required."));
      return;
    }
    if (unknownTokensIn(draftBody).length > 0) {
      showNotice(t("Placeholder tidak dikenali — periksa mesej.", "Unknown placeholders — check the message."));
      return;
    }
    const locale = selectedRow.locale;
    const payload = {
      name: draftName,
      stage: selectedGroup.stage,
      enBody: locale === "en" ? draftBody : selectedGroup.rows.find((r) => r.locale === "en")?.body ?? "",
      msBody: locale === "ms" ? draftBody : selectedGroup.rows.find((r) => r.locale === "ms")?.body ?? "",
    };
    setSaving(true);
    try {
      await followupApi.updateTemplate(selectedGroup.code, payload);
      await query.refetch();
      showNotice(t("Templat disimpan.", "Template saved."));
    } catch (err) {
      showNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  /** Opens the full bilingual editor for the selected template. */
  function openEditor(code: string | null) {
    if (code) {
      const g = groups.find((x) => x.code === code);
      if (!g) return;
      setEditor({
        code: g.code,
        name: g.name,
        stage: g.stage,
        enBody: g.rows.find((r) => r.locale === "en")?.body ?? "",
        msBody: g.rows.find((r) => r.locale === "ms")?.body ?? "",
      });
    } else {
      setEditor({ code: null, name: "", stage: "FU1", enBody: "", msBody: "" });
    }
  }

  const lead = useMemo(() => leads.find((l) => l.id === leadId) ?? leads[0] ?? null, [leads, leadId]);

  /** Fills the selected body with real lead values for the chat preview. */
  const rendered = useMemo(() => {
    if (!selectedRow) return "";
    const values: Record<string, string> = {
      "{{leadName}}": lead?.name ?? "",
      "{{packageName}}": lead?.destination ?? lead?.name ?? "",
      "{{date}}": departDate,
      "{{salesName}}": salesName,
    };
    return draftBody.replace(/\{\{(\w+)\}\}/g, (whole) => {
      const v = values[whole];
      return v && v.trim() ? v : whole;
    });
  }, [selectedRow, draftBody, lead, departDate, salesName]);

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

  function toggleActive(code: string) {
    const group = templates.filter((x) => x.code === code);
    const next = !group.every((x) => x.active);
    if (next) void applyActive(code, true);
    else setPendingDeactivate(code);
  }

  function confirmDeactivate() {
    if (pendingDeactivate) void applyActive(pendingDeactivate, false);
    setPendingDeactivate(null);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(rendered);
      showNotice(t("Pratonton disalin dengan placeholder terisi.", "Preview copied to the clipboard with placeholders filled in."));
    } catch {
      showNotice(t("Papan klip tidak tersedia.", "Clipboard unavailable."));
    }
  }

  function openWhatsApp() {
    if (!lead) return;
    const digits = lead.phone?.replace(/\D/g, "") ?? "";
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(rendered)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    showNotice(
      t(
        `WhatsApp dibuka untuk ${lead.name} dengan mesej pra-isi. Tiada mesej dihantar automatik.`,
        `WhatsApp opened for ${lead.name} with the message pre-filled. No message is sent automatically.`,
      ),
    );
  }

  /** Appends a placeholder token to the draft (no API call — press Save). */
  function insertPlaceholder(token: string) {
    setDraftBody((body) => (body ? `${body} ${token}` : token));
  }

  /** Persists the bilingual form through the templates API. */
  async function saveTemplate(draft: TemplateEditorState): Promise<boolean> {
    const errors = validateTemplate(draft.name, draft.enBody, draft.msBody);
    if (Object.keys(errors).length > 0) return false;
    if (unknownTokensIn(draft.enBody).length > 0 || unknownTokensIn(draft.msBody).length > 0) {
      showNotice(t("Placeholder tidak dikenali — periksa mesej.", "Unknown placeholders — check the message."));
      return false;
    }
    const payload = { name: draft.name, stage: draft.stage, enBody: draft.enBody, msBody: draft.msBody };
    try {
      if (draft.code) await followupApi.updateTemplate(draft.code, payload);
      else await followupApi.createTemplate({ ...payload, code: templateCodeFrom(draft.name) });
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

  const langLabel = selectedRow?.locale === "ms" ? "Bahasa Malaysia" : "English";
  const allActive = selectedGroup ? selectedGroup.rows.every((r) => r.active) : false;

  return (
    <div className="flex flex-col gap-5">
      {/* Hero — prototype twt-hero */}
      <section className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border-strong)] bg-[linear-gradient(132deg,var(--color-primary-soft)_0%,var(--color-surface)_58%,var(--color-surface-muted)_100%)] p-5 md:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-[120px] -right-[60px] h-[280px] w-[280px] rounded-full" style={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)" }} />
        <div className="relative z-[1] flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.06em] text-[var(--color-primary)]">
              <MessageCircle className="h-3.5 w-3.5" />
              {t("Pemesejan susulan", "Follow-up messaging")}
            </span>
            <h1 className="mt-2 m-0 font-display text-[22px] font-bold tracking-tight text-[var(--color-text)]">
              {t("Templat WhatsApp", "WhatsApp Templates")}
            </h1>
            <p className="m-0 mt-1.5 max-w-[60ch] text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
              {t(
                "Templat English & Bahasa Malaysia dengan placeholder dinamik — dihantar hanya via wa.me, tidak automatik.",
                "English & Bahasa Malaysia templates with dynamic placeholders — sent only via wa.me, never automatically.",
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openEditor(null)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              {t("Templat baharu", "New template")}
            </button>
            <button
              type="button"
              onClick={openWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              <Send className="h-4 w-4" />
              {t("Buka di WhatsApp", "Open in WhatsApp")}
            </button>
          </div>
        </div>

        <div className="relative z-[1] mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <HeroStat label={t("Templat", "Templates")} value={String(groups.length)} />
          <HeroStat label={t("Bahasa", "Languages")} value="2" />
          <HeroStat label={t("Placeholder", "Placeholders")} value={String(TEMPLATE_PLACEHOLDERS.length)} />
          <HeroStat label={t("Pratonton", "Previewing")} value={lead?.name ?? "—"} small />
        </div>
      </section>

      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] px-4 py-2.5 text-[13px] text-[var(--color-primary)]">
          <CheckCircle2 className="h-4 w-4 flex-none" />
          <span className="min-w-0 flex-1">{notice}</span>
          <button type="button" aria-label={t("Tutup", "Dismiss")} onClick={() => setNotice("")} className="grid place-items-center border-0 bg-transparent text-inherit">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Two-column list + compose */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left: template list */}
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
            <h2 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">{t("Templat", "Templates")}</h2>
            <span className="text-[12px] text-muted-foreground">{visibleGroups.length}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 py-3" role="group" aria-label={t("Tapis templat mengikut bahasa", "Filter templates by language")}>
            {([["all", t("Semua", "All")], ["en", "English"], ["ms", "Bahasa Malaysia"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={langFilter === value}
                onClick={() => setLangFilter(value)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  langFilter === value
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {query.loading ? (
            <FollowupLoading label={t("Memuatkan templat...", "Loading templates...")} />
          ) : query.status === "error" ? (
            <div className="px-4 py-4">
              <FollowupErrorState message={query.error ?? ""} onRetry={() => void query.refetch()} />
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="px-4 py-5 text-center text-[13px] text-muted-foreground">
              {t("Tiada templat dalam bahasa ini.", "No templates in this language yet.")}
            </div>
          ) : (
            <div className="flex flex-col">
              {visibleGroups.map((g) => {
                const sel = selectedGroup?.code === g.code;
                const row = g.rows[0];
                return (
                  <div
                    key={g.code}
                    className={cn(
                      "group relative flex items-start border-0 border-t border-l-[3px] border-l-transparent first:border-t-0",
                      sel ? "border-l-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "bg-transparent hover:bg-[var(--color-surface-raised)]",
                    )}
                  >
                    <button
                      type="button"
                      aria-selected={sel}
                      onClick={() => setSelectedCode(g.code)}
                      className="flex min-w-0 flex-1 items-start gap-2.5 border-0 bg-transparent px-4 py-3 text-left"
                    >
                      <span className={cn("grid h-7 w-7 flex-none place-items-center rounded-[9px]", sel ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]")}>
                        <MessageCircle className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <strong className="truncate text-[13.5px] font-semibold text-[var(--color-text)]">{g.name}</strong>
                        <span className="truncate text-[12px] text-muted-foreground">
                          {row?.body.length ?? 0} {t("aksara", "chars")} · {placeholdersIn(row?.body ?? "").length} {t("placeholder", "placeholders")}
                        </span>
                      </span>
                      <span className={cn("flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold", sel ? "bg-[var(--color-surface)] text-[var(--color-primary)]" : "bg-[var(--color-surface-muted)] text-muted-foreground")}>
                        {g.rows.some((r) => r.locale === "ms") ? "BM" : "EN"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(g.code)}
                      aria-label={t(`Edit ${g.name}`, `Edit ${g.name}`)}
                      title={t("Edit templat", "Edit template")}
                      className="mr-2 mt-3 grid h-7 w-7 flex-none place-items-center rounded-[6px] border border-transparent text-muted-foreground transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right: compose */}
        <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
          {selectedRow ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <h2 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">{t("Karang", "Compose")}</h2>
                  <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--color-primary)]">{langLabel}</span>
                  {dirty && (
                    <span className="rounded-full bg-[var(--color-warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-warning)]">
                      {t("Belum disimpan", "Unsaved")}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={!dirty || saving}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {saving ? t("Menyimpan…", "Saving…") : t("Simpan", "Save")}
                </button>
              </div>
              <div className="flex flex-col gap-4 p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <label className="flex min-w-0 flex-col gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {t("Nama templat", "Template name")}
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2 text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {t("Isi mesej", "Message body")}
                  </span>
                  <div className="flex flex-wrap gap-1.5" aria-label={t("Sisip placeholder", "Insert placeholder")}>
                    {TEMPLATE_PLACEHOLDERS.map((p) => (
                      <button key={p.token} type="button" onClick={() => insertPlaceholder(p.token)} title={t(p.ms, p.en)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 font-mono text-[11.5px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]">
                        {p.token}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="m-0 -mt-2 text-[11.5px] text-muted-foreground">
                  {t(
                    "Placeholder diisi automatik: nama lead & pakej daripada lead yang dipilih, tarikh & nama sales daripada akaun anda.",
                    "Placeholders fill automatically: lead name & package from the selected lead, date & sales name from your account.",
                  )}
                </p>
                <textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value.slice(0, WA_MESSAGE_LIMIT + 500))}
                  maxLength={WA_MESSAGE_LIMIT + 500}
                  aria-label={t("Isi mesej templat", "Template message body")}
                  className="min-h-[120px] w-full resize-y rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {draftBody.length}/{WA_MESSAGE_LIMIT}
                  </span>
                  {unknownTokensIn(draftBody).length > 0 && (
                    <span className="rounded-md bg-[var(--color-warning-soft)] px-2 py-1 text-[11.5px] font-semibold text-[var(--color-warning)]" role="alert">
                      {t("Placeholder tidak dikenali: ", "Unknown placeholders: ")}
                      {unknownTokensIn(draftBody).join(", ")}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="px-5 py-8 text-center text-[13.5px] text-muted-foreground">
              {t("Pilih templat di kiri atau cipta yang baharu.", "Pick a template on the left, or create a new one.")}
            </div>
          )}
        </section>
      </div>

      {/* Preview */}
      <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="m-0 text-[15px] font-semibold text-[var(--color-text)]">{t("Pratonton mesej", "Message preview")}</h2>
          <span className="text-[12px] text-muted-foreground">{rendered.length} {t("aksara", "characters")}</span>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="twt-lead" className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                {t("Pratonton untuk", "Preview for")}
              </label>
              <select id="twt-lead" value={leadId} onChange={(e) => setLeadId(e.target.value)} className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-[13px] text-[var(--color-text)]">
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
                {leads.length === 0 && <option value="">{t("Tiada lead", "No leads")}</option>}
              </select>
            </div>
            {lead && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--color-text-secondary)]">
                <Phone className="h-3.5 w-3.5" />
                {lead.phone ?? "—"}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              {lead?.destination ?? lead?.name ?? "—"}
            </span>
            <div className="max-w-[92%] self-start whitespace-pre-wrap rounded-[4px_var(--radius-card)_var(--radius-card)_var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-[13.5px] leading-relaxed text-[var(--color-text)] shadow-sm">
              {rendered || t("Tulis mesej untuk melihat pratonton.", "Write a message to see the preview.")}
            </div>
            <span className="inline-flex items-center gap-1.5 self-end text-[11.5px] text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {t("Akan membuka WhatsApp anda — tiada mesej dihantar automatik", "Will open your WhatsApp app — nothing is sent automatically")}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void copyMessage()}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-foreground"
            >
              <Copy className="h-4 w-4" />
              {t("Salin mesej", "Copy message")}
            </button>
            {selectedGroup && (
              <button
                type="button"
                onClick={() => toggleActive(selectedGroup.code)}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-danger-soft)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger-soft)]"
              >
                {allActive ? t("Nyahaktif", "Deactivate") : t("Aktifkan", "Activate")}
              </button>
            )}
            <button
              type="button"
              onClick={openWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
            >
              <Send className="h-4 w-4" />
              {t("Buka di WhatsApp", "Open in WhatsApp")}
            </button>
          </div>
        </div>
      </section>

      {editor && (
        <TemplateEditorDialog
          draft={editor}
          salesName={salesName}
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
    </div>
  );
}

function HeroStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <span className="text-[11.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</span>
      <strong className={cn("font-display leading-tight tracking-tight text-[var(--color-text)]", small ? "text-[15px] font-semibold" : "text-[22px] font-bold")} style={small ? { overflowWrap: "anywhere" } : undefined}>
        {value}
      </strong>
    </div>
  );
}

/** Create/edit dialog — both locale bodies in one form, live preview, placeholder chips. */
function TemplateEditorDialog({
  draft,
  salesName,
  onChange,
  onClose,
  onSave,
}: {
  draft: TemplateEditorState;
  /** Signed-in rep's name for the live preview. */
  salesName?: string;
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
              salesName={salesName}
              onChange={(v) => patch({ enBody: v })}
              onInsert={(token) => insertPlaceholder(token, "en")}
            />
            <LocaleBodyField
              id="tpl-body-ms"
              locale="ms"
              label="Bahasa Malaysia"
              value={draft.msBody}
              error={showErrors && !!errors.msBody}
              salesName={salesName}
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
  salesName,
  onChange,
  onInsert,
}: {
  id: string;
  locale: TemplateLocale;
  label: string;
  value: string;
  error: boolean;
  /** Signed-in rep's name for the live preview. */
  salesName?: string;
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
      {/* Live preview with real / sample values. */}
      <p className="m-0 whitespace-pre-wrap rounded-[14px] rounded-tl-[4px] bg-[#d9fdd3] px-3 py-2 text-[12.5px] leading-relaxed text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]">
        {value.trim() ? fillSample(value, salesName) : t("Pratonton mesej…", "Message preview…")}
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


import { useMemo, useState } from "react";
import { ExternalLink, MessageCircle, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  allTokensIn,
  lengthStatus,
  WA_MESSAGE_LIMIT,
  type TemplateLocale,
  type WaTemplate,
} from "@/pages/WhatsAppTemplates";

/**
 * Template picker + filled preview — the "send WhatsApp" dialog used from a
 * lead context. Sales picks a template, toggles EN/BM, sees the final
 * message with real lead values, then opens wa.me (click-to-chat only).
 */

/** Values that replace {{placeholders}} for a specific lead. */
export interface TemplateFillValues {
  leadName: string;
  packageName: string;
  date: string;
  salesName: string;
}

/** Fills a template body with real values. Tokens with no value (unknown or empty) are left visible. */
export function fillTemplate(body: string, values: TemplateFillValues): string {
  const map: Record<string, string> = {
    "{{leadName}}": values.leadName,
    "{{packageName}}": values.packageName,
    "{{date}}": values.date,
    "{{salesName}}": values.salesName,
  };
  return body.replace(/\{\{(\w+)\}\}/g, (whole) => {
    const v = map[whole];
    return v && v.trim() ? v : whole;
  });
}

/**
 * Normalises a Malaysian phone string to E.164 digits without "+".
 * Returns null when the number is not a plausible Malaysian mobile/landline.
 * Accepts 01x-xxx xxxx, +60 1x-xxx xxxx, 60 1x-xxx xxxx, 0x-xxx xxxx.
 */
export function normaliseMyPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Strip a leading 0 (local format) then ensure the 60 country code.
  let national = digits.replace(/^0/, "");
  if (national.startsWith("60")) national = national.slice(2);
  // Malaysian numbers: mobile 1x (9-10 digits after 60), landline x (9-10 digits).
  if (national.length < 9 || national.length > 10) return null;
  if (!/^[1-9]/.test(national)) return null;
  return `60${national}`;
}

/** wa.me click-to-chat URL with the message pre-filled. */
export function waMeUrl(phone: string, message: string): string {
  const e164 = normaliseMyPhone(phone);
  if (!e164) return "";
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

/** One logical template: a code with its locale rows. */
interface TemplateGroup {
  code: string;
  name: string;
  stage: string | null;
  rows: WaTemplate[];
}

function groupTemplates(rows: WaTemplate[]): TemplateGroup[] {
  const map = new Map<string, TemplateGroup>();
  for (const row of rows) {
    const g = map.get(row.code);
    if (g) g.rows.push(row);
    else map.set(row.code, { code: row.code, name: row.name, stage: row.stage, rows: [row] });
  }
  return [...map.values()];
}

export default function TemplatePickerDialog({
  open,
  onClose,
  templates,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  /** All template rows (both locales). Inactive rows are filtered out. */
  templates: WaTemplate[];
  /** The lead the message is for — fill values plus the phone number. */
  lead: TemplateFillValues & { phone: string };
}) {
  const { t, lang } = useLang();
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [locale, setLocale] = useState<TemplateLocale>(lang);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupTemplates(templates.filter((x) => x.active)).filter(
      (g) => !q || g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q),
    );
  }, [templates, query]);

  const selectedGroup = groups.find((g) => g.code === selectedCode) ?? null;
  const selectedRow =
    selectedGroup?.rows.find((r) => r.locale === locale) ??
    selectedGroup?.rows[0] ??
    null;

  const filled = selectedRow ? fillTemplate(selectedRow.body, lead) : "";
  const phoneValid = normaliseMyPhone(lead.phone) !== null;
  /** Tokens in the ORIGINAL body that will not render: unknown, or whose lead value is empty. */
  const missing = useMemo(() => {
    if (!selectedRow) return [];
    const valueOf: Record<string, string> = {
      "{{leadName}}": lead.leadName,
      "{{packageName}}": lead.packageName,
      "{{date}}": lead.date,
      "{{salesName}}": lead.salesName,
    };
    return allTokensIn(selectedRow.body).filter((token) => !(valueOf[token] ?? "").trim());
  }, [selectedRow, lead]);
  const canSend = Boolean(filled.trim()) && phoneValid && missing.length === 0;
  const sentAt = new Date().toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tpl-pick-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="tpl-pick-title" className="m-0 font-display text-[17px] font-bold">
              {t("Hantar WhatsApp", "Send WhatsApp")}
            </h2>
            <p className="m-0 mt-0.5 text-[12px] text-muted-foreground">
              {t(`Kepada ${lead.leadName}`, `To ${lead.leadName}`)}
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

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-[260px_1fr]">
          {/* Left: searchable template list */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-2">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Cari templat…", "Search templates…")}
                aria-label={t("Cari templat", "Search templates")}
                className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none"
              />
            </div>
            <ul className="m-0 flex flex-1 flex-col gap-1.5 list-none overflow-y-auto">
              {groups.length === 0 ? (
                <li className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">
                  {t("Tiada templat aktif", "No active templates")}
                </li>
              ) : (
                groups.map((g) => {
                  const isSel = g.code === selectedCode;
                  return (
                    <li key={g.code}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCode(g.code);
                          if (g.rows.some((r) => r.locale === lang)) setLocale(lang);
                        }}
                        aria-pressed={isSel}
                        className={cn(
                          "flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                          isSel
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                            : "border-transparent hover:bg-[var(--color-surface-raised)]",
                        )}
                      >
                        <span className="text-[13px] font-semibold text-foreground">{g.name}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {g.stage ?? t("Umum", "General")} ·{" "}
                          {g.rows.length === 2 ? "EN & BM" : (g.rows[0]?.locale ?? "").toUpperCase()}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          {/* Right: filled preview + open WhatsApp */}
          <div className="flex min-h-0 flex-col gap-3">
            {!selectedRow ? (
              <div className="grid flex-1 place-items-center px-4 py-10 text-center text-muted-foreground">
                <div>
                  <MessageCircle className="mx-auto h-7 w-7" />
                  <p className="m-0 mt-2 font-semibold text-foreground">{t("Pilih templat", "Pick a template")}</p>
                  <p className="m-0 mt-1 text-[12.5px]">
                    {t("Mesej akan diisi dengan data lead ini.", "The message will be filled with this lead's data.")}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-[13px] font-semibold text-foreground">{selectedGroup?.name}</p>
                    <p className="m-0 font-mono text-[11px] text-muted-foreground">{selectedCode}</p>
                  </div>
                  <div
                    className="flex items-center gap-1 rounded-full bg-[var(--color-neutral-soft)] p-0.5"
                    role="group"
                    aria-label={t("Bahasa mesej", "Message language")}
                  >
                    {(["ms", "en"] as TemplateLocale[]).map((l) => {
                      const available = selectedGroup?.rows.some((r) => r.locale === l) ?? false;
                      return (
                        <button
                          key={l}
                          type="button"
                          aria-pressed={locale === l}
                          disabled={!available}
                          onClick={() => setLocale(l)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                            locale === l
                              ? "bg-[var(--color-surface)] text-foreground shadow-sm"
                              : "text-muted-foreground",
                          )}
                        >
                          {l === "ms" ? "BM" : "EN"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[#efeae2] p-3 dark:bg-[#0b141a]">
                  <div className="flex max-w-[92%] flex-col gap-1 rounded-[14px] rounded-bl-[4px] bg-[var(--color-surface)] px-3 py-2 text-[13px] leading-relaxed text-foreground shadow-sm dark:bg-[#202c33]">
                    <p className="m-0 whitespace-pre-wrap">{filled}</p>
                    <span className="self-end text-[10.5px] text-muted-foreground">{sentAt}</span>
                  </div>
                </div>

                {missing.length > 0 && (
                  <p className="m-0 text-[11.5px] font-semibold text-[var(--color-warning)]" role="alert">
                    {t("Placeholder tidak diisi: ", "Unfilled placeholders: ")}
                    {missing.join(", ")}
                  </p>
                )}
                {lengthStatus(filled.length) === "warn" && (
                  <p className="m-0 rounded-md bg-[var(--color-warning-soft)] px-2 py-1.5 text-[11.5px] font-semibold text-[var(--color-warning)]" role="alert">
                    {t(
                      `Hampir had WhatsApp (${WA_MESSAGE_LIMIT} aksara) — mesej mungkin dipecahkan.`,
                      `Approaching WhatsApp's limit (${WA_MESSAGE_LIMIT} chars) — the message may be split.`,
                    )}
                  </p>
                )}
                {lengthStatus(filled.length) === "over" && (
                  <p className="m-0 rounded-md bg-[var(--color-danger-soft)] px-2 py-1.5 text-[11.5px] font-semibold text-[var(--color-danger)]" role="alert">
                    {t(
                      "Terlalu panjang — WhatsApp akan memecahkannya kepada beberapa mesej.",
                      "Too long — WhatsApp will split it into multiple messages.",
                    )}
                  </p>
                )}

                {!phoneValid && (
                  <p className="m-0 rounded-md bg-[var(--color-danger-soft)] px-2 py-1.5 text-[11.5px] font-semibold text-[var(--color-danger)]" role="alert">
                    {t(
                      `Nombor telefon tidak sah ("${lead.phone}") — perbetulkan nombor lead sebelum menghantar.`,
                      `Invalid phone number ("${lead.phone}") — fix the lead's number before sending.`,
                    )}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-[13px] font-semibold hover:bg-[var(--color-surface-raised)]"
                  >
                    {t("Batal", "Cancel")}
                  </button>
                  {canSend ? (
                    <a
                      href={waMeUrl(lead.phone, filled)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 py-2 text-[13px] font-bold text-white hover:opacity-90"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("Buka WhatsApp", "Open WhatsApp")}
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title={
                        !phoneValid
                          ? t("Nombor telefon tidak sah", "Invalid phone number")
                          : missing.length > 0
                            ? t("Placeholder belum diisi", "Placeholders not filled")
                            : t("Mesej kosong", "Message is empty")
                      }
                      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-[#25D366]/40 px-3.5 py-2 text-[13px] font-bold text-white"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("Buka WhatsApp", "Open WhatsApp")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Check, Code2, Eye, Mail, MessageSquare, Save } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { EmptyState } from "@/components/Ui";

interface Template {
  id: string;
  name: { ms: string; en: string };
  channel: "email" | "whatsapp";
  subject: string;
  body: string;
  enabled: boolean;
}

const SAMPLE_DATA: Record<string, string> = {
  customer_name: "Ahmad Zulkifli",
  booking_ref: "ZQK-2026-000118",
  package_name: "Umrah Ramadan 2027",
  departure_date: "15 Mac 2027",
  amount: "RM 3,850.00",
  due_date: "1 Mac 2027",
};

// Empty until the backend template API is wired up.
const INITIAL_TEMPLATES: Template[] = [];

const PLACEHOLDERS = Object.keys(SAMPLE_DATA);

function channelTone(channel: "email" | "whatsapp") {
  return channel === "email"
    ? "bg-[var(--color-info-soft)] text-[var(--color-info)]"
    : "bg-[var(--color-success-soft)] text-[var(--color-success)]";
}

export default function NotificationTemplates() {
  const { t } = useLang();
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const [activeId, setActiveId] = useState("");
  const [saved, setSaved] = useState(false);

  const active = templates.find((x) => x.id === activeId);

  const update = (patch: Partial<Template>) =>
    setTemplates((prev) =>
      prev.map((x) => (x.id === activeId ? { ...x, ...patch } : x)),
    );

  const renderPreview = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE_DATA[k] ?? `{{${k}}}`);

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Templat Pemberitahuan", "Notification Templates")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Edit mesej emel dan WhatsApp dengan placeholder dinamik.",
              "Edit email and WhatsApp messages with dynamic placeholders.",
            )}
          </p>
        </div>
        {templates.length > 0 ? (
          <button type="button" onClick={handleSave} className="tv-btn tv-btn--primary" aria-live="polite">
            {saved ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {saved ? t("Disimpan!", "Saved!") : t("Simpan", "Save")}
          </button>
        ) : null}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title={t("Belum ada templat pemberitahuan", "No notification templates yet")}
          description={t(
            "Templat emel dan WhatsApp untuk tempahan, bayaran dan peringatan akan muncul di sini selepas didayakan.",
            "Email and WhatsApp templates for bookings, payments and reminders will show here once turned on.",
          )}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Template list */}
          <div className="flex flex-col gap-2">
            {templates.map((tpl) => {
              const isActive = activeId === tpl.id;
              const ChannelIcon = tpl.channel === "email" ? Mail : MessageSquare;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setActiveId(tpl.id)}
                  aria-pressed={isActive}
                  className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border px-3 py-3 text-left transition-colors focus-ring ${
                    isActive
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`tv-icon-tile ${channelTone(tpl.channel)}`}
                      aria-hidden="true"
                    >
                      <ChannelIcon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-semibold text-[var(--color-text)]">
                        {t(tpl.name.ms, tpl.name.en)}
                      </span>
                      <span className={`tv-pill mt-0.5 ${channelTone(tpl.channel)}`}>
                        {tpl.channel === "email" ? "Email" : "WhatsApp"}
                      </span>
                    </span>
                  </span>
                  <span
                    className={`h-2 w-2 flex-none rounded-full ${
                      tpl.enabled ? "bg-[var(--color-success)]" : "bg-[var(--color-border-strong)]"
                    }`}
                    title={tpl.enabled ? t("Aktif", "Enabled") : t("Lumpuh", "Disabled")}
                  />
                </button>
              );
            })}

            {/* Placeholder helper */}
            <div className="tv-panel p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                {t("Placeholder", "Placeholders")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((p) => (
                  <code
                    key={p}
                    className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-text-secondary)]"
                  >
                    {`{{${p}}}`}
                  </code>
                ))}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="tv-panel flex flex-col gap-3 p-4 lg:col-span-2">
            {active ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="m-0 text-[14.5px] font-semibold text-[var(--color-text)]">
                    {t("Edit Templat", "Edit Template")}
                  </h2>
                  <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                    <input
                      type="checkbox"
                      checked={active.enabled}
                      onChange={(e) => update({ enabled: e.target.checked })}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                    {t("Aktif", "Enabled")}
                  </label>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nt-subject" className="tv-label font-semibold">
                    {t("Subjek", "Subject")}
                  </label>
                  <input
                    id="nt-subject"
                    value={active.subject}
                    onChange={(e) => update({ subject: e.target.value })}
                    className="tv-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="nt-body" className="tv-label font-semibold">
                    {t("Kandungan", "Body")}
                  </label>
                  <textarea
                    id="nt-body"
                    rows={8}
                    value={active.body}
                    onChange={(e) => update({ body: e.target.value })}
                    className="tv-input h-auto resize-y py-2 font-mono text-xs"
                  />
                </div>
              </>
            ) : (
              <EmptyState
                compact
                icon={MessageSquare}
                title={t("Pilih satu templat", "Select a template")}
                description={t(
                  "Pilih templat di sebelah kiri untuk mula menyunting.",
                  "Pick a template on the left to start editing.",
                )}
              />
            )}
          </div>
        </div>
      )}

      {/* Live preview */}
      {active ? (
        <div className="tv-panel">
          <div className="tv-panel__head">
            <h2 className="tv-panel__title flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
              {t("Pratonton (data contoh)", "Preview (sample data)")}
            </h2>
            <span className={`tv-pill ${channelTone(active.channel)}`}>
              {active.channel === "email" ? "Email" : "WhatsApp"}
            </span>
          </div>
          <div className="p-5">
            <div className="rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] p-4">
              <p className="m-0 font-semibold text-[var(--color-text)]">{renderPreview(active.subject)}</p>
              <p className="m-0 mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                {renderPreview(active.body)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {templates.length > 0 ? (
        <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
          {t(
            "Placeholder {{nama}} digantikan dengan data sebenar semasa mesej dihantar.",
            "Placeholders like {{name}} are replaced with real data when the message is sent.",
          )}
        </p>
      ) : null}
    </div>
  );
}

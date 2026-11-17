import { useState } from "react";
import { Check, Code2, Eye, Mail, MessageSquare, Save } from "lucide-react";
import { useLang } from "@/lib/i18n";

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

// Mock data — backend template API menyusul pada fasa backend.
const STUB: Template[] = [
  {
    id: "nt_booking_confirm",
    name: { ms: "Pengesahan Tempahan", en: "Booking Confirmation" },
    channel: "email",
    subject: "Tempahan anda disahkan — {{booking_ref}}",
    body: "Assalamualaikum {{customer_name}},\n\nTerima kasih. Tempahan anda untuk {{package_name}} ({{booking_ref}}) telah disahkan. Keberangkatan pada {{departure_date}}.\n\nTerima kasih,\nZAQONE TRAVEL",
    enabled: true,
  },
  {
    id: "nt_payment_reminder",
    name: { ms: "Peringatan Bayaran", en: "Payment Reminder" },
    channel: "whatsapp",
    subject: "Peringatan bayaran {{booking_ref}}",
    body: "Hi {{customer_name}}, jangan lupa bayaran {{amount}} untuk {{booking_ref}} sebelum {{due_date}}. Terima kasih!",
    enabled: true,
  },
  {
    id: "nt_departure_reminder",
    name: { ms: "Peringatan Keberangkatan", en: "Departure Reminder" },
    channel: "email",
    subject: "Keberangkatan anda dalam 3 hari",
    body: "Assalamualaikum {{customer_name}},\n\nPakej {{package_name}} anda berlepas pada {{departure_date}}. Sila daftar masuk 3 jam awal.",
    enabled: false,
  },
];

const PLACEHOLDERS = Object.keys(SAMPLE_DATA);

const PANEL = "rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]";
const BTN =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-55 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)]`;
const FIELD =
  "w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-[13.5px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:-outline-offset-1";

function channelPill(channel: "email" | "whatsapp") {
  return channel === "email"
    ? "bg-[var(--color-info-soft)] text-[var(--color-info)]"
    : "bg-[var(--color-success-soft)] text-[var(--color-success)]";
}

export default function NotificationTemplates() {
  const { t } = useLang();
  const [templates, setTemplates] = useState<Template[]>(STUB);
  const [activeId, setActiveId] = useState(STUB[0].id);
  const [saved, setSaved] = useState(false);

  const active = templates.find((x) => x.id === activeId)!;

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
    <div className="space-y-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">
            {t("Templat Pemberitahuan", "Notification Templates")}
          </h1>
          <p className="tvl-subtitle">
            {t(
              "Edit mesej emel dan WhatsApp dengan placeholder dinamik.",
              "Edit email and WhatsApp messages with dynamic placeholders.",
            )}
          </p>
        </div>
        <button onClick={handleSave} className={BTN_PRIMARY}>
          {saved ? (
            <Check className="h-4 w-4 text-[var(--color-success-soft)]" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? t("Disimpan!", "Saved!") : t("Simpan", "Save")}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Template list */}
        <div className="space-y-2">
          {templates.map((tpl) => {
            const isActive = activeId === tpl.id;
            const ChannelIcon = tpl.channel === "email" ? Mail : MessageSquare;
            return (
              <button
                key={tpl.id}
                onClick={() => setActiveId(tpl.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-[var(--radius-card)] border px-3 py-3 text-left transition-colors ${
                  isActive
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-raised)]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] ${channelPill(tpl.channel)}`}
                    aria-hidden="true"
                  >
                    <ChannelIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold text-[var(--color-text)]">
                      {t(tpl.name.ms, tpl.name.en)}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${channelPill(tpl.channel)}`}
                    >
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
          <div className={`${PANEL} p-3`}>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
              <Code2 className="h-3.5 w-3.5" />
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
        <div className={`${PANEL} space-y-3 p-4 lg:col-span-2`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14.5px] font-semibold text-[var(--color-text)]">
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

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
              {t("Subjek", "Subject")}
            </label>
            <input
              value={active.subject}
              onChange={(e) => update({ subject: e.target.value })}
              className={FIELD}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
              {t("Kandungan", "Body")}
            </label>
            <textarea
              rows={8}
              value={active.body}
              onChange={(e) => update({ body: e.target.value })}
              className={`${FIELD} resize-y font-mono text-xs`}
            />
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className={PANEL}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="flex items-center gap-1.5 text-[14.5px] font-semibold text-[var(--color-text)]">
            <Eye className="h-4 w-4 text-[var(--color-text-secondary)]" />
            {t("Pratonton (data contoh)", "Preview (sample data)")}
          </h2>
          <span className="rounded-full bg-[var(--color-neutral-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)]">
            {active.channel === "email" ? "Email" : "WhatsApp"}
          </span>
        </div>
        <div className="p-5">
          <div className="rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] p-4">
            <p className="font-semibold text-[var(--color-text)]">
              {renderPreview(active.subject)}
            </p>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {renderPreview(active.body)}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "Data olok-olok — templat sebenar akan didayakan pada fasa backend.",
          "Mock data — real templates will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

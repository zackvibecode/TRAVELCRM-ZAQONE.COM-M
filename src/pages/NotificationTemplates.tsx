import { useState } from "react";
import { Check, Code2, Eye, Mail, MessageSquare, Save } from "lucide-react";
import { cn } from "@/lib/utils";
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

  const fieldCls =
    "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Templat Pemberitahuan", "Notification Templates")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Edit mesej emel dan WhatsApp dengan placeholder dinamik.",
              "Edit email and WhatsApp messages with dynamic placeholders.",
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90",
            saved && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? t("Disimpan!", "Saved!") : t("Simpan", "Save")}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Template list */}
        <div className="space-y-2">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => setActiveId(tpl.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                activeId === tpl.id && "border-primary/50 bg-primary/5",
              )}
            >
              <div>
                <div className="text-sm font-medium">{t(tpl.name.ms, tpl.name.en)}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  {tpl.channel === "email" ? (
                    <Mail className="h-3 w-3" />
                  ) : (
                    <MessageSquare className="h-3 w-3" />
                  )}
                  {tpl.channel === "email" ? "Email" : "WhatsApp"}
                </div>
              </div>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  tpl.enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
                )}
                title={tpl.enabled ? t("Aktif", "Enabled") : t("Lumpuh", "Disabled")}
              />
            </button>
          ))}

          {/* Placeholder helper */}
          <div className="rounded-lg border bg-white p-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Code2 className="h-3.5 w-3.5" />
              {t("Placeholder", "Placeholders")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <code key={p} className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] font-mono">
                  {`{{${p}}}`}
                </code>
              ))}
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="space-y-3 rounded-lg border bg-white p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {t("Edit Templat", "Edit Template")}
            </h2>
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={active.enabled}
                onChange={(e) => update({ enabled: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              {t("Aktif", "Enabled")}
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("Subjek", "Subject")}</label>
            <input
              value={active.subject}
              onChange={(e) => update({ subject: e.target.value })}
              className={fieldCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("Kandungan", "Body")}</label>
            <textarea
              rows={8}
              value={active.body}
              onChange={(e) => update({ body: e.target.value })}
              className={cn(fieldCls, "resize-y font-mono text-xs")}
            />
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Eye className="h-4 w-4" />
          {t("Pratonton (data contoh)", "Preview (sample data)")}
        </h2>
        <div className="rounded-lg border bg-muted/30 p-4">
          {active.channel === "email" ? (
            <Mail className="mb-2 h-5 w-5 text-primary" />
          ) : (
            <MessageSquare className="mb-2 h-5 w-5 text-emerald-600" />
          )}
          <p className="font-semibold">{renderPreview(active.subject)}</p>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {renderPreview(active.body)}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "Data olok-olok — templat sebenar akan didayakan pada fasa backend.",
          "Mock data — real templates will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

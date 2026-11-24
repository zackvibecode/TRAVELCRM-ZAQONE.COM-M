import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Building2,
  CalendarClock,
  Check,
  FileDigit,
  Globe,
  Languages,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { invalidateBranding } from "@/lib/useBranding";
import { Button } from "@/components/ui/button";

type SettingsTab =
  | "general"
  | "company"
  | "site"
  | "documents"
  | "booking"
  | "notifications"
  | "security"
  | "ai";

// Mock state — backend settings API menyusul pada fasa backend.
const TABS: { id: SettingsTab; label: { ms: string; en: string }; icon: typeof Globe }[] = [
  { id: "general", label: { ms: "Am", en: "General" }, icon: SlidersHorizontal },
  { id: "company", label: { ms: "Syarikat", en: "Company" }, icon: Building2 },
  { id: "site", label: { ms: "Website", en: "Website" }, icon: Globe },
  { id: "documents", label: { ms: "Dokumen", en: "Documents" }, icon: FileDigit },
  { id: "booking", label: { ms: "Booking", en: "Booking" }, icon: CalendarClock },
  { id: "notifications", label: { ms: "Pemberitahuan", en: "Notifications" }, icon: Bell },
  { id: "security", label: { ms: "Keselamatan", en: "Security" }, icon: ShieldCheck },
  { id: "ai", label: { ms: "AI", en: "AI" }, icon: Sparkles },
];

const CURRENCIES = [
  { value: "MYR", label: "RM — Ringgit Malaysia" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "SGD", label: "SGD — Singapore Dollar" },
];

const TIMEZONES = [
  { value: "Asia/Kuala_Lumpur", label: "Asia/Kuala_Lumpur (GMT+8)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (GMT+8)" },
  { value: "UTC", label: "UTC" },
];

export default function Settings() {
  const { t, lang, setLang } = useLang();
  const [tab, setTab] = useState<SettingsTab>("general");

  // General
  const [defaultLang, setDefaultLang] = useState<"ms" | "en">("ms");
  const [currency, setCurrency] = useState("MYR");
  const [timezone, setTimezone] = useState("Asia/Kuala_Lumpur");
  const [seatsThreshold, setSeatsThreshold] = useState("20");

  // Company
  const [companyName, setCompanyName] = useState("ZAQONE TRAVEL & TOURS");
  const [regNo, setRegNo] = useState("SA0123456789-KLM");
  const [address, setAddress] = useState("Lot 12, Jalan Sultan Ismail, 50250 Kuala Lumpur");
  const [phone, setPhone] = useState("+60 3-2168 8888");
  const [email, setEmail] = useState("hello@zaqone.travel");

  // Website chrome (shared with the public website)
  const [site, setSite] = useState({
    brandName: "ZAQONE Travel",
    tagline: "Agensi pelancongan",
    whatsapp: "60123880030",
  });

  // Notifications
  const [notifyLowSeats, setNotifyLowSeats] = useState(true);
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [notifyDeparture, setNotifyDeparture] = useState(true);
  const [notifyNewLead, setNotifyNewLead] = useState(false);

  // Documents (penomboran)
  const [docs, setDocs] = useState({
    quotationPrefix: "QUO",
    quotationNext: "1201",
    quotationValidity: "14",
    invoicePrefix: "INV",
    invoiceNext: "0487",
    invoiceTerms: "30",
    receiptPrefix: "RCP",
    receiptNext: "0234",
  });

  // Booking defaults
  const [booking, setBooking] = useState({
    holdHours: "48",
    depositPercent: "30",
    taxRate: "6",
    currency: "MYR",
    minPaxGroup: "10",
    taxInclusive: false,
    policy:
      "Pembatalan 14 hari sebelum keberangkatan: bayaran balik 50%. Kurang dari 14 hari: tiada bayaran balik.",
  });

  // AI provider (OpenAI-compatible). The API key is write-only — the backend
  // never sends it back, only a masked placeholder.
  const [ai, setAi] = useState({
    enabled: true,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    temperature: "0.3",
    maxTokens: "4000",
  });
  const [aiLoaded, setAiLoaded] = useState(false);
  const [siteLoaded, setSiteLoaded] = useState(false);

  useEffect(() => {
    if (tab !== "ai" || aiLoaded) return;
    (async () => {
      try {
        const res = await apiFetch<{ settings?: Record<string, unknown> }>("/settings");
        const stored = res.settings?.ai as Record<string, unknown> | undefined;
        if (stored) {
          setAi((current) => ({
            enabled: stored.enabled !== false,
            baseUrl: String(stored.baseUrl ?? current.baseUrl),
            apiKey: "",
            model: String(stored.model ?? current.model),
            temperature: String(stored.temperature ?? current.temperature),
            maxTokens: String(stored.maxTokens ?? current.maxTokens),
          }));
        }
      } catch {
        /* keep defaults */
      } finally {
        setAiLoaded(true);
      }
    })();
  }, [tab, aiLoaded]);

  async function saveAi() {
    setSaveState("saving");
    try {
      await apiFetch("/settings/ai", {
        method: "PUT",
        body: JSON.stringify({
          enabled: ai.enabled,
          baseUrl: ai.baseUrl.trim(),
          apiKey: ai.apiKey,
          model: ai.model.trim(),
          temperature: Number(ai.temperature),
          maxTokens: Number(ai.maxTokens),
        }),
      });
      setAi((c) => ({ ...c, apiKey: "" }));
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      setErrors({ ai: e instanceof Error ? e.message : t("Gagal menyimpan.", "Failed to save.") });
      setSaveState("idle");
    }
  }

  // Load the website chrome settings the first time the tab is opened.
  useEffect(() => {
    if (tab !== "site" || siteLoaded) return;
    (async () => {
      try {
        const res = await apiFetch<{ settings?: Record<string, unknown> }>("/settings");
        const stored = res.settings?.site as Record<string, unknown> | undefined;
        if (stored) {
          setSite((c) => ({
            brandName: String(stored.brandName ?? c.brandName),
            tagline: String(stored.tagline ?? c.tagline),
            whatsapp: String(stored.whatsapp ?? c.whatsapp),
          }));
        }
      } catch {
        /* keep defaults */
      } finally {
        setSiteLoaded(true);
      }
    })();
  }, [tab, siteLoaded]);

  async function saveSite() {
    const wa = site.whatsapp.replace(/\D/g, "");
    if (wa.length < 8 || wa.length > 15) {
      setErrors({ whatsapp: t("Nombor WhatsApp mesti 8–15 digit.", "WhatsApp number must be 8–15 digits.") });
      return;
    }
    setErrors({});
    setSaveState("saving");
    try {
      await apiFetch("/settings/site", {
        method: "PUT",
        body: JSON.stringify({
          brandName: site.brandName.trim(),
          tagline: site.tagline.trim(),
          whatsapp: wa,
        }),
      });
      invalidateBranding();
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    } catch (e) {
      setErrors({ whatsapp: e instanceof Error ? e.message : t("Gagal menyimpan.", "Failed to save.") });
      setSaveState("idle");
    }
  }

  const handleSave = () => {
    // Validasi borang aktif sebelum simpan (mock backend).
    const errs: Record<string, string> = {};
    if (tab === "company") {
      if (!companyName.trim()) errs.companyName = t("Nama syarikat wajib diisi.", "Company name is required.");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = t("Format emel tidak sah.", "Invalid email format.");
      if (phone && !/^[+\d][\d\s\-()]{6,}$/.test(phone)) errs.phone = t("Format telefon tidak sah.", "Invalid phone format.");
    }
    if (tab === "general") {
      const n = Number(seatsThreshold);
      if (!Number.isFinite(n) || n < 1 || n > 100) errs.seatsThreshold = t("Ambang mesti antara 1–100.", "Threshold must be 1–100.");
    }
    if (tab === "documents") {
      if (!docs.quotationPrefix.trim()) errs.quotationPrefix = t("Prefix penawaran wajib.", "Quotation prefix is required.");
      if (!docs.invoicePrefix.trim()) errs.invoicePrefix = t("Prefix invois wajib.", "Invoice prefix is required.");
      if (!docs.receiptPrefix.trim()) errs.receiptPrefix = t("Prefix resit wajib.", "Receipt prefix is required.");
      const terms = Number(docs.invoiceTerms);
      if (!Number.isFinite(terms) || terms < 1 || terms > 180) errs.invoiceTerms = t("Tempo mesti 1–180 hari.", "Terms must be 1–180 days.");
    }
    if (tab === "booking") {
      const hold = Number(booking.holdHours);
      const dep = Number(booking.depositPercent);
      const tax = Number(booking.taxRate);
      if (!Number.isFinite(hold) || hold < 1 || hold > 720) errs.holdHours = t("Hold mesti 1–720 jam.", "Hold must be 1–720 hours.");
      if (!Number.isFinite(dep) || dep < 0 || dep > 100) errs.depositPercent = t("DP mesti 0–100%.", "Deposit must be 0–100%.");
      if (!Number.isFinite(tax) || tax < 0 || tax > 100) errs.taxRate = t("Cukai mesti 0–100%.", "Tax must be 0–100%.");
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaveState("saving");
    window.setTimeout(() => {
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 2000);
    }, 500);
  };

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const fieldCls =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Tetapan", "Settings")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Konfigurasi sistem, syarikat dan keselamatan workspace.",
              "System, company and workspace security configuration.",
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveState === "saving"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60",
            saveState === "saved" && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {saveState === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saveState === "saving"
            ? t("Sedang simpan…", "Saving…")
            : saveState === "saved"
              ? t("Disimpan!", "Saved!")
              : t("Simpan Tetapan", "Save Settings")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t(label.ms, label.en)}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === "general" && (
        <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("Bahasa Lalai", "Default Language")}
            </label>
            <select
              value={defaultLang}
              onChange={(e) => setDefaultLang(e.target.value as "ms" | "en")}
              className={cn(fieldCls, "bg-white")}
            >
              <option value="ms">Bahasa Melayu</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("Mata Wang", "Currency")}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={cn(fieldCls, "bg-white")}
            >
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("Zon Waktu", "Timezone")}
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className={cn(fieldCls, "bg-white")}
            >
              {TIMEZONES.map((z) => (
                <option key={z.value} value={z.value}>{z.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("Ambang Kerusi Kritikal (%)", "Critical Seats Threshold (%)")}
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={seatsThreshold}
              onChange={(e) => setSeatsThreshold(e.target.value)}
              className={cn(fieldCls, errors.seatsThreshold && "border-red-400 focus-visible:ring-red-400")}
            />
            {errors.seatsThreshold && (
              <p className="text-xs text-red-600">{errors.seatsThreshold}</p>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground md:col-span-2">
            <Languages className="h-3.5 w-3.5" />
            {t("Sesi anda sekarang", "Your current session")}: {lang === "ms" ? "Bahasa Melayu" : "English"} —{" "}
            <button onClick={() => setLang(lang === "ms" ? "en" : "ms")} className="font-medium text-primary hover:underline">
              {t("tukar", "switch")}
            </button>
          </p>
        </div>
      )}

      {/* Company */}
      {tab === "company" && (
        <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">
              {t("Nama Syarikat", "Company Name")}
            </label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={cn(fieldCls, errors.companyName && "border-red-400 focus-visible:ring-red-400")}
            />
            {errors.companyName && (
              <p className="text-xs text-red-600">{errors.companyName}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("No. Pendaftaran (SSM)", "Registration No. (SSM)")}
            </label>
            <input value={regNo} onChange={(e) => setRegNo(e.target.value)} className={fieldCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("Telefon", "Phone")}</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={cn(fieldCls, errors.phone && "border-red-400 focus-visible:ring-red-400")}
            />
            {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">{t("Alamat", "Address")}</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={fieldCls} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">{t("Emel", "Email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(fieldCls, errors.email && "border-red-400 focus-visible:ring-red-400")}
            />
            {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
          </div>
        </div>
      )}

      {/* Website chrome — shared with the public website */}
      {tab === "site" && (
        <div className="space-y-4">
          <section className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h2 className="font-display text-[15px] font-bold">{t("Identiti Website", "Website Identity")}</h2>
              <span className="text-xs text-muted-foreground">
                {t("Digunakan pada header & footer website awam", "Used in the public site header & footer")}
              </span>
            </div>
            <div className="flex flex-col gap-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="site-brand" className="text-[12.5px] font-semibold text-muted-foreground">
                    {t("Nama Jenama", "Brand Name")}
                  </label>
                  <input
                    id="site-brand"
                    value={site.brandName}
                    onChange={(e) => setSite((c) => ({ ...c, brandName: e.target.value }))}
                    className={cn(fieldCls, "bg-white")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="site-tagline" className="text-[12.5px] font-semibold text-muted-foreground">
                    {t("Tagline", "Tagline")}
                  </label>
                  <input
                    id="site-tagline"
                    value={site.tagline}
                    onChange={(e) => setSite((c) => ({ ...c, tagline: e.target.value }))}
                    className={cn(fieldCls, "bg-white")}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="site-wa" className="text-[12.5px] font-semibold text-muted-foreground">
                  {t("Nombor WhatsApp", "WhatsApp Number")}
                </label>
                <div className="flex items-center rounded-md border border-input bg-white shadow-sm focus-within:ring-1 focus-within:ring-ring">
                  <span className="whitespace-nowrap pl-3 text-sm text-muted-foreground">+</span>
                  <input
                    id="site-wa"
                    inputMode="numeric"
                    value={site.whatsapp}
                    aria-invalid={!!errors.whatsapp}
                    onChange={(e) => setSite((c) => ({ ...c, whatsapp: e.target.value.replace(/\D/g, "") }))}
                    className="h-9 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                  />
                </div>
                {errors.whatsapp ? (
                  <p className="text-xs text-red-600">{errors.whatsapp}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {t("Tanpa '+' atau ruang. Contoh: 60123880030", "Without '+' or spaces. Example: 60123880030")}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t pt-4">
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Tetapan ini dikongsi — website awam dan shell CRM membaca nilai yang sama.",
                    "These settings are shared — the public website and the CRM shell read the same values.",
                  )}
                </p>
                <Button onClick={() => void saveSite()} disabled={saveState === "saving"}>
                  <Save className="h-4 w-4" />
                  {saveState === "saving"
                    ? t("Menyimpan…", "Saving…")
                    : t("Simpan Tetapan Website", "Save Website Settings")}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Documents */}
      {tab === "documents" && (
        <div className="space-y-4">
          <section className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h2 className="font-display text-[15px] font-bold">{t("Penomboran Dokumen", "Document Numbering")}</h2>
              <span className="text-xs text-muted-foreground">{t("Tahun berjalan automatik", "Current year applied automatically")}</span>
            </div>
            <div className="flex flex-col gap-5 p-5">
              {[
                { key: "quotationPrefix" as const, numKey: "quotationNext" as const, label: t("Prefix Penawaran", "Quotation prefix"), numLabel: t("Nombor Berjalan", "Running number"), hint: t("Penawaran seterusnya guna nombor ini.", "Next quotation uses this number.") },
                { key: "invoicePrefix" as const, numKey: "invoiceNext" as const, label: t("Prefix Invois", "Invoice prefix"), numLabel: t("Nombor Berjalan", "Running number"), hint: undefined },
                { key: "receiptPrefix" as const, numKey: "receiptNext" as const, label: t("Prefix Resit", "Receipt prefix"), numLabel: t("Nombor Berjalan", "Running number"), hint: undefined },
              ].map((row, idx) => (
                <div key={row.key} className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <label htmlFor={`doc-${row.key}`} className="text-[12.5px] font-semibold text-muted-foreground">{row.label}</label>
                    <div className="flex items-center gap-1.5 rounded-md border border-input bg-transparent px-3 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                      <input
                        id={`doc-${row.key}`}
                        value={docs[row.key]}
                        aria-invalid={!!errors[row.key]}
                        onChange={(e) => { setDocs((p) => ({ ...p, [row.key]: e.target.value.toUpperCase() })); setErrors((p) => ({ ...p, [row.key]: "" })); }}
                        className="h-9 min-w-0 flex-1 bg-transparent text-sm uppercase outline-none"
                      />
                      <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">/{new Date().getFullYear()}/{String(docs[row.numKey]).padStart(4, "0")}</span>
                    </div>
                    {errors[row.key] && <p className="text-xs text-red-600">{errors[row.key]}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`doc-${row.numKey}`} className="text-[12.5px] font-semibold text-muted-foreground">{row.numLabel}</label>
                    <input
                      id={`doc-${row.numKey}`}
                      type="number"
                      inputMode="numeric"
                      value={docs[row.numKey]}
                      onChange={(e) => setDocs((p) => ({ ...p, [row.numKey]: e.target.value }))}
                      className={fieldCls}
                    />
                    {row.hint && <p className="text-[11px] text-muted-foreground">{row.hint}</p>}
                  </div>
                  {idx === 0 && (
                    <div className="space-y-1.5">
                      <label htmlFor="doc-quo-valid" className="text-[12.5px] font-semibold text-muted-foreground">{t("Tempoh Sah Penawaran (hari)", "Quotation validity (days)")}</label>
                      <input id="doc-quo-valid" type="number" inputMode="numeric" value={docs.quotationValidity} onChange={(e) => setDocs((p) => ({ ...p, quotationValidity: e.target.value }))} className={fieldCls} />
                    </div>
                  )}
                  {idx === 1 && (
                    <div className="space-y-1.5">
                      <label htmlFor="doc-inv-terms" className="text-[12.5px] font-semibold text-muted-foreground">{t("Tempo Bayaran (hari)", "Payment terms (days)")}</label>
                      <input id="doc-inv-terms" type="number" inputMode="numeric" value={docs.invoiceTerms} aria-invalid={!!errors.invoiceTerms} onChange={(e) => { setDocs((p) => ({ ...p, invoiceTerms: e.target.value })); setErrors((p) => ({ ...p, invoiceTerms: "" })); }} className={cn(fieldCls, errors.invoiceTerms && "border-red-400")} />
                      {errors.invoiceTerms && <p className="text-xs text-red-600">{errors.invoiceTerms}</p>}
                    </div>
                  )}
                </div>
              ))}
              <p className="flex items-start gap-1.5 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
                {t("Perubahan prefix dan nombor hanya untuk dokumen baru. Dokumen sudah terbit kekal dengan nombornya.", "Prefix and number changes apply only to new documents. Already-issued documents keep their numbers.")}
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Booking */}
      {tab === "booking" && (
        <div className="space-y-4">
          <section className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="border-b px-5 py-3.5">
              <h2 className="font-display text-[15px] font-bold">{t("Lalai Tempahan", "Booking Defaults")}</h2>
            </div>
            <div className="flex flex-col gap-5 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="bk-hold" className="text-[12.5px] font-semibold text-muted-foreground">{t("Durasi Hold Kerusi", "Seat hold duration")}</label>
                  <div className="flex items-center rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
                    <input id="bk-hold" type="number" inputMode="numeric" value={booking.holdHours} aria-invalid={!!errors.holdHours} onChange={(e) => { setBooking((p) => ({ ...p, holdHours: e.target.value })); setErrors((p) => ({ ...p, holdHours: "" })); }} className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
                    <span className="whitespace-nowrap pr-3 text-xs text-muted-foreground">{t("jam", "hours")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{t("Kerusi dilepas otomatis bila hold tamat.", "Seats are released when the hold expires.")}</p>
                  {errors.holdHours && <p className="text-xs text-red-600">{errors.holdHours}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="bk-deposit" className="text-[12.5px] font-semibold text-muted-foreground">{t("DP Minimum", "Minimum deposit")}</label>
                  <div className="flex items-center rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
                    <input id="bk-deposit" type="number" inputMode="numeric" value={booking.depositPercent} aria-invalid={!!errors.depositPercent} onChange={(e) => { setBooking((p) => ({ ...p, depositPercent: e.target.value })); setErrors((p) => ({ ...p, depositPercent: "" })); }} className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
                    <span className="whitespace-nowrap pr-3 text-xs text-muted-foreground">%</span>
                  </div>
                  {errors.depositPercent && <p className="text-xs text-red-600">{errors.depositPercent}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="bk-tax" className="text-[12.5px] font-semibold text-muted-foreground">{t("Tarif Cukai", "Tax rate")}</label>
                  <div className="flex items-center rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
                    <input id="bk-tax" type="number" inputMode="numeric" value={booking.taxRate} aria-invalid={!!errors.taxRate} onChange={(e) => { setBooking((p) => ({ ...p, taxRate: e.target.value })); setErrors((p) => ({ ...p, taxRate: "" })); }} className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" />
                    <span className="whitespace-nowrap pr-3 text-xs text-muted-foreground">%</span>
                  </div>
                  {errors.taxRate && <p className="text-xs text-red-600">{errors.taxRate}</p>}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <label htmlFor="bk-currency" className="text-[12.5px] font-semibold text-muted-foreground">{t("Mata Wang", "Currency")}</label>
                  <select id="bk-currency" value={booking.currency} onChange={(e) => setBooking((p) => ({ ...p, currency: e.target.value }))} className={cn(fieldCls, "bg-white")}>
                    <option value="MYR">MYR — Ringgit Malaysia</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="SGD">SGD — Singapore Dollar</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="bk-group" className="text-[12.5px] font-semibold text-muted-foreground">{t("Minimal Pax Grup", "Minimum group pax")}</label>
                  <input id="bk-group" type="number" inputMode="numeric" value={booking.minPaxGroup} onChange={(e) => setBooking((p) => ({ ...p, minPaxGroup: e.target.value }))} className={fieldCls} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="bk-tax-mode" className="text-[12.5px] font-semibold text-muted-foreground">{t("Perlakuan Cukai", "Tax treatment")}</label>
                  <select id="bk-tax-mode" value={booking.taxInclusive ? "inclusive" : "exclusive"} onChange={(e) => setBooking((p) => ({ ...p, taxInclusive: e.target.value === "inclusive" }))} className={cn(fieldCls, "bg-white")}>
                    <option value="exclusive">{t("Ditambah di atas harga", "Added on top of price")}</option>
                    <option value="inclusive">{t("Sudah termasuk harga", "Already included in price")}</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="bk-policy" className="text-[12.5px] font-semibold text-muted-foreground">{t("Teks Dasar Pembatalan", "Cancellation policy text")}</label>
                <textarea id="bk-policy" rows={4} value={booking.policy} onChange={(e) => setBooking((p) => ({ ...p, policy: e.target.value }))} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                <p className="text-[11px] text-muted-foreground">{t("Tercetak di halaman terakhir penawaran dan invois.", "Printed on the last page of quotations and invoices.")}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="border-b px-5 py-3.5">
              <h2 className="font-display text-[15px] font-bold">{t("Simulasi Tagihan", "Billing Simulation")}</h2>
            </div>
            <div className="p-5">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { label: t("Contoh harga paket 2 pax dewasa", "Sample package price, 2 adults"), value: `${booking.currency} 24,800` },
                    { label: `${t("DP minimum", "Minimum deposit")} (${booking.depositPercent}%)`, value: `${booking.currency} ${Math.round((24800 * Number(booking.depositPercent || 0)) / 100).toLocaleString("en-MY")}` },
                    {
                      label: `${t("Cukai", "Tax")} (${booking.taxRate}%, ${booking.taxInclusive ? t("termasuk", "included") : t("ditambah", "added")})`,
                      value: `${booking.currency} ${Math.round(24800 * Number(booking.taxRate || 0) / (booking.taxInclusive ? 100 + Number(booking.taxRate || 0) : 100)).toLocaleString("en-MY")}`,
                    },
                    { label: t("Kerusi di-hold selama", "Seats held for"), value: `${booking.holdHours || 0} ${t("jam", "hours")}` },
                  ].map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className={cn("py-2.5", i === 3 && "font-semibold")}>{r.label}</td>
                      <td className={cn("whitespace-nowrap py-2.5 text-right font-mono text-xs [font-variant-numeric:tabular-nums]", i === 3 && "font-semibold")}>{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* Notifications */}
      {tab === "notifications" && (
        <div className="rounded-lg border bg-white p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            {t(
              "Pilih jenis amaran yang memacu pemberitahuan sistem.",
              "Choose which alert kinds drive system notifications.",
            )}
          </p>
          {[
            { label: { ms: "Kerusi hampir habis", en: "Low seats warning" }, value: notifyLowSeats, set: setNotifyLowSeats },
            { label: { ms: "Invois tertunggak", en: "Overdue payments" }, value: notifyOverdue, set: setNotifyOverdue },
            { label: { ms: "Keberangkatan hampir", en: "Upcoming departures" }, value: notifyDeparture, set: setNotifyDeparture },
            { label: { ms: "Lead baharu", en: "New leads" }, value: notifyNewLead, set: setNotifyNewLead },
          ].map(({ label, value, set }) => (
            <label key={label.en} className="flex items-center justify-between border-b py-3 last:border-b-0">
              <span className="text-sm font-medium">{t(label.ms, label.en)}</span>
              <button
                type="button"
                role="switch"
                aria-checked={value}
                onClick={() => set(!value)}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  value ? "bg-primary" : "bg-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                    value ? "left-[18px]" : "left-0.5",
                  )}
                />
              </button>
            </label>
          ))}
        </div>
      )}

      {/* Security */}
      {tab === "security" && (
        <div className="rounded-lg border bg-white p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            {t(
              "Dasar keselamatan akaun staf dan sesi log masuk.",
              "Staff account and session security policy.",
            )}
          </p>
          {[
            {
              label: { ms: "Wajib 2FA untuk Super Admin", en: "Require 2FA for Super Admin" },
              desc: { ms: "Kunci log masuk peranan tertinggi dengan pengesahan dua faktor.", en: "Lock the highest role sign-in behind two-factor authentication." },
            },
            {
              label: { ms: "Kunci akaun selepas 5 percubaan gagal", en: "Lock account after 5 failed attempts" },
              desc: { ms: "Sekat log masuk sementara apabila percubaan melebihi had.", en: "Temporarily block sign-in when attempts exceed the limit." },
            },
            {
              label: { ms: "Tamat sesi selepas 30 minit melahu", en: "End session after 30 minutes idle" },
              desc: { ms: "Log keluar automatik apabila tiada aktiviti.", en: "Automatically sign out after inactivity." },
            },
          ].map(({ label, desc }) => (
            <div key={label.en} className="flex items-center justify-between border-b py-3 last:border-b-0">
              <div>
                <p className="text-sm font-medium">{t(label.ms, label.en)}</p>
                <p className="text-xs text-muted-foreground">{t(desc.ms, desc.en)}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {t("Akan didayakan (backend)", "Enabled later (backend)")}
              </span>
            </div>
          ))}
        </div>
      )}
      {tab === "ai" && (
        <div className="space-y-4 rounded-lg border bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">
                {t("Pembantu AI (OpenAI-compatible)", "AI Assistant (OpenAI-compatible)")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(
                  "Hubungkan mana-mana provider yang menyokong API OpenAI — OpenAI, OpenRouter, DeepSeek, Groq, atau model tempatan (Ollama, LM Studio). Base URL bolehtinger tanpa kunci API.",
                  "Connect any provider that speaks the OpenAI API — OpenAI, OpenRouter, DeepSeek, Groq, or a local model (Ollama, LM Studio). A local base URL needs no API key.",
                )}
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ai.enabled}
                onChange={(e) => setAi({ ...ai, enabled: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              {t("Aktif", "Enabled")}
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("Base URL", "Base URL")}
              </label>
              <input
                value={ai.baseUrl}
                onChange={(e) => setAi({ ...ai, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("Model", "Model")}
              </label>
              <input
                value={ai.model}
                onChange={(e) => setAi({ ...ai, model: e.target.value })}
                placeholder="gpt-4o-mini"
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("API Key", "API Key")}
              </label>
              <input
                type="password"
                value={ai.apiKey}
                onChange={(e) => setAi({ ...ai, apiKey: e.target.value })}
                placeholder="sk-…"
                autoComplete="off"
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t(
                  "Kunci disimpan di D1 dan tidak dipulangkan ke pelayar. Biarkan kosong untuk kekalkan kunci sedia ada.",
                  "The key is stored in D1 and never sent back to the browser. Leave blank to keep the existing key.",
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("Temperature", "Temperature")}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={ai.temperature}
                  onChange={(e) => setAi({ ...ai, temperature: e.target.value })}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("Max Tokens", "Max Tokens")}
                </label>
                <input
                  type="number"
                  step="256"
                  min="256"
                  max="32000"
                  value={ai.maxTokens}
                  onChange={(e) => setAi({ ...ai, maxTokens: e.target.value })}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {errors.ai && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {errors.ai}
            </p>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {t(
                "Pembantu AI boleh membaca data CRM dan mencipta draf pakej, tempahan serta halaman web — tetapi tidak boleh-published tanpa semakan staf.",
                "The assistant can read CRM data and create draft packages, bookings and web pages — but nothing is published without staff review.",
              )}
            </p>
            <Button onClick={() => void saveAi()} disabled={saveState === "saving"}>
              <Save className="h-4 w-4" />
              {saveState === "saving"
                ? t("Menyimpan…", "Saving…")
                : t("Simpan Tetapan AI", "Save AI Settings")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState } from "react";
import {
  Bell,
  Building2,
  Check,
  Globe,
  Languages,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

type SettingsTab = "general" | "company" | "notifications" | "security";

// Mock state — backend settings API menyusul pada fasa backend.
const TABS: { id: SettingsTab; label: { ms: string; en: string }; icon: typeof Globe }[] = [
  { id: "general", label: { ms: "Am", en: "General" }, icon: SlidersHorizontal },
  { id: "company", label: { ms: "Syarikat", en: "Company" }, icon: Building2 },
  { id: "notifications", label: { ms: "Pemberitahuan", en: "Notifications" }, icon: Bell },
  { id: "security", label: { ms: "Keselamatan", en: "Security" }, icon: ShieldCheck },
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
  const [saved, setSaved] = useState(false);

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

  // Notifications
  const [notifyLowSeats, setNotifyLowSeats] = useState(true);
  const [notifyOverdue, setNotifyOverdue] = useState(true);
  const [notifyDeparture, setNotifyDeparture] = useState(true);
  const [notifyNewLead, setNotifyNewLead] = useState(false);

  const handleSave = () => {
    // Mock save — backend settings API menyusul.
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

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
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90",
            saved && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved
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
              className={fieldCls}
            />
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
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={fieldCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              {t("No. Pendaftaran (SSM)", "Registration No. (SSM)")}
            </label>
            <input value={regNo} onChange={(e) => setRegNo(e.target.value)} className={fieldCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("Telefon", "Phone")}</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldCls} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">{t("Alamat", "Address")}</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={fieldCls} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">{t("Emel", "Email")}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} />
          </div>
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
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Building2, Check, ImagePlus, Save, UploadCloud } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";
import { invalidateBranding } from "@/lib/useBranding";

// Empty defaults — real company profile is loaded from the backend API.
const INITIAL = {
  name: "",
  brandName: "",
  registrationNo: "",
  licenseNo: "",
  licenseExpiry: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  city: "",
  state: "",
  postcode: "",
  country: "",
  taxId: "",
  bankName: "",
  bankAccount: "",
  bankHolder: "",
};

type FormKey = keyof typeof INITIAL;

function FormSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="tv-panel" aria-labelledby={id}>
      <div className="tv-panel__head">
        <h2 id={id} className="tv-panel__title">
          {title}
        </h2>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2">{children}</div>
    </section>
  );
}

export default function CompanyProfile() {
  const { t } = useLang();
  const [form, setForm] = useState(INITIAL);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoName, setLogoName] = useState("zaqone-logo.png");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load the stored profile so the website and the CRM render the SAME
  // settings. The public website reads the same `company` settings key
  // through GET /public/branding.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch<{ company?: Record<string, unknown> | null }>(
          "/settings/company",
        );
        const stored = res.company ?? {};
        if (alive) {
          setForm((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next) as FormKey[]) {
              const v = stored[key];
              if (typeof v === "string" && v.trim()) next[key] = v;
            }
            return next;
          });
          const logo = typeof stored.logoUrl === "string" ? stored.logoUrl : "";
          setLogoUrl(logo);
          if (logo) setLogoName(logo.split("/").pop() ?? "logo");
        }
      } catch {
        // keep defaults — the page still works read-only
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const set = (key: FormKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t("Nama syarikat wajib diisi.", "Company name is required.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t("Format emel tidak sah.", "Invalid email format.");
    if (form.website && !/^https?:\/\/.+\..+/.test(form.website)) errs.website = t("Format URL tidak sah (https://…).", "Invalid URL (https://…).");
    if (form.licenseExpiry && new Date(form.licenseExpiry) < new Date("2020-01-01")) errs.licenseExpiry = t("Tarikh lesen tidak sah.", "Invalid licence date.");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaved(true);
    try {
      await apiFetch("/settings/company", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      // The website reads the same settings — drop the cached copy so the
      // next read refetches the new values.
      invalidateBranding();
    } catch {
      setSaved(false);
      setErrors({
        name: t("Gagal menyimpan. Periksa andaian anda.", "Failed to save. Check your permissions."),
      });
      return;
    }
    window.setTimeout(() => setSaved(false), 2000);
  };

  const handleLogoUpload = useCallback(async (file: File) => {
    setLogoName(file.name);
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await apiFetch<{ logoUrl?: string }>("/settings/company/logo", {
        method: "POST",
        body,
      });
      if (res.logoUrl) {
        setLogoUrl(res.logoUrl);
        invalidateBranding();
      }
    } catch {
      setErrors({
        name: t("Gagal memuat naik logo.", "Failed to upload the logo."),
      });
    }
  }, [t]);

  const field = (
    key: FormKey,
    labelMs: string,
    labelEn: string,
    opts?: { type?: string; span?: boolean },
  ) => (
    <div className={`flex min-w-0 flex-col gap-1.5 ${opts?.span ? "md:col-span-2" : ""}`}>
      <label htmlFor={`cp-${key}`} className="tv-label">
        {t(labelMs, labelEn)}
      </label>
      <input
        id={`cp-${key}`}
        type={opts?.type ?? "text"}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={errors[key] ? "true" : undefined}
        className="tv-input"
      />
      {errors[key] ? (
        <span className="text-[11.5px] font-semibold text-[var(--color-danger)]" role="alert">
          {errors[key]}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Profil Syarikat", "Company Profile")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Maklumat syarikat, lesen dan butiran bank untuk invois.",
              "Company details, travel licence and bank info for invoices.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="tv-btn tv-btn--primary"
          aria-live="polite"
        >
          {saved ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
          {saved ? t("Disimpan!", "Saved!") : t("Simpan Profil", "Save Profile")}
        </button>
      </div>

      {/* Logo */}
      <section className="tv-panel" aria-labelledby="cp-logo-title">
        <div className="tv-panel__head">
          <h2 id="cp-logo-title" className="tv-panel__title">
            {t("Logo Syarikat", "Company Logo")}
          </h2>
          <span className="text-[12px] text-[var(--color-text-muted)]">PNG / JPG · 2MB</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 p-5">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={t("Logo syarikat", "Company logo")}
              className="h-14 w-14 flex-none rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] object-contain p-1.5"
            />
          ) : (
            <div
              aria-hidden="true"
              className="grid h-14 w-14 flex-none place-items-center rounded-[var(--radius-card)] bg-[var(--color-primary)] text-[var(--color-on-primary)]"
            >
              <Building2 size={26} />
            </div>
          )}
          <div className="min-w-0 flex-[1_1_220px]">
            <p className="m-0 text-[13.5px] font-semibold text-[var(--color-text)]">{logoName}</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
              {t("PNG atau JPG · maks. 2MB", "PNG or JPG · max 2MB")}
            </p>
          </div>
          <label className="tv-btn tv-btn--secondary cursor-pointer">
            <ImagePlus size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
            {t("Tukar Logo", "Change Logo")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              disabled={loading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleLogoUpload(f);
              }}
            />
          </label>
        </div>
      </section>

      {/* Company details */}
      <FormSection id="cp-details-title" title={t("Maklumat Syarikat", "Company Details")}>
        {field("name", "Nama Penuh Syarikat", "Full Company Name", { span: true })}
        {field("brandName", "Nama Jenama", "Brand Name")}
        {field("registrationNo", "No. Pendaftaran (SSM)", "Registration No. (SSM)")}
        {field("phone", "Telefon", "Phone")}
        {field("email", "Emel", "Email", { type: "email" })}
        {field("website", "Laman Web", "Website", { type: "url", span: true })}
      </FormSection>

      {/* Licence */}
      <FormSection id="cp-licence-title" title={t("Lesen & Lokasi", "Licence & Location")}>
        {field("licenseNo", "No. Lesen KPL", "Travel Licence No. (KPL)")}
        {field("licenseExpiry", "Tarikh Luput Lesen", "Licence Expiry", { type: "date" })}
        {field("address", "Alamat", "Address", { span: true })}
        {field("city", "Bandar", "City")}
        {field("state", "Negeri", "State")}
        {field("postcode", "Poskod", "Postcode")}
        {field("country", "Negara", "Country")}
      </FormSection>

      {/* Bank & tax */}
      <section className="tv-panel" aria-labelledby="cp-invoice-title">
        <div className="tv-panel__head">
          <h2 id="cp-invoice-title" className="tv-panel__title">
            {t("Butiran Invois", "Invoice Details")}
          </h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {field("taxId", "No. Cukai (TIN)", "Tax ID (TIN)")}
          {field("bankName", "Nama Bank", "Bank Name")}
          {field("bankAccount", "No. Akaun Bank", "Bank Account No.")}
          {field("bankHolder", "Nama Pemegang Akaun", "Account Holder", { span: true })}
        </div>
        <div className="px-5 pb-5">
          <div className="flex items-start gap-2 rounded-[var(--radius-card)] bg-[var(--color-info-soft)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--color-info)]">
            <UploadCloud size={15} className="mt-px flex-none" aria-hidden="true" />
            <span>
              {t(
                "Data ini dipaparkan pada kop invois, resit dan sebut harga pelanggan.",
                "This data appears on invoice, receipt and quotation letterheads.",
              )}
            </span>
          </div>
        </div>
      </section>

      <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
        {t(
          "Tetapan ini dikongsi — perubahan di sini kekal terpakai pada website awam dan shell CRM.",
          "These settings are shared — a change here applies to the public website and the CRM shell.",
        )}
      </p>
    </div>
  );
}

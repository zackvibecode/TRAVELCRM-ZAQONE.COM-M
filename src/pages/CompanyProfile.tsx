import { useState } from "react";
import { Building2, Check, ImagePlus, Save, UploadCloud } from "lucide-react";
import { useLang } from "@/lib/i18n";

// Mock data — backend company profile API menyusul pada fasa backend.
const INITIAL = {
  name: "ZAQONE TRAVEL & TOURS",
  brandName: "ZAQONE TRAVEL",
  registrationNo: "SA0123456789-KLM",
  licenseNo: "KPL/LN/000012345",
  licenseExpiry: "2028-06-30",
  phone: "+60 3-2168 8888",
  email: "hello@zaqone.travel",
  website: "https://zaqone.travel",
  address: "Lot 12, Jalan Sultan Ismail, 50250 Kuala Lumpur",
  city: "Kuala Lumpur",
  state: "Wilayah Persekutuan",
  postcode: "50250",
  country: "Malaysia",
  taxId: "MY-TIN-2026-001",
  bankName: "Maybank Islamic Berhad",
  bankAccount: "1234 5678 9012",
  bankHolder: "ZAQONE TRAVEL & TOURS SDN BHD",
};

type FormKey = keyof typeof INITIAL;

const panelStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-panel)",
};

const inputCls =
  "h-[37px] w-full rounded-[var(--radius-control)] border px-[11px] text-[13.5px] text-[var(--color-text)] bg-[var(--color-surface)] outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:-outline-offset-1";

const fieldCls = (invalid?: string) =>
  `${inputCls} ${invalid ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)]" : "border-[var(--color-border-strong)]"}`;

export default function CompanyProfile() {
  const { t } = useLang();
  const [form, setForm] = useState(INITIAL);
  const [saved, setSaved] = useState(false);
  const [logoName, setLogoName] = useState("zaqone-logo.png");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: FormKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t("Nama syarikat wajib diisi.", "Company name is required.");
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = t("Format emel tidak sah.", "Invalid email format.");
    if (form.website && !/^https?:\/\/.+\..+/.test(form.website)) errs.website = t("Format URL tidak sah (https://…).", "Invalid URL (https://…).");
    if (form.licenseExpiry && new Date(form.licenseExpiry) < new Date("2020-01-01")) errs.licenseExpiry = t("Tarikh lesen tidak sah.", "Invalid licence date.");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const field = (
    key: FormKey,
    labelMs: string,
    labelEn: string,
    opts?: { type?: string; span?: boolean },
  ) => (
    <div className={`flex flex-col gap-1.5 min-w-0 ${opts?.span ? "md:col-span-2" : ""}`}>
      <label htmlFor={`cp-${key}`} className="text-[12.5px] font-medium text-[var(--color-text-secondary)]">
        {t(labelMs, labelEn)}
      </label>
      <input
        id={`cp-${key}`}
        type={opts?.type ?? "text"}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={errors[key] ? "true" : undefined}
        className={fieldCls(errors[key])}
      />
      {errors[key] ? (
        <span className="text-[11.5px] font-semibold text-[var(--color-danger)]" role="alert">
          {errors[key]}
        </span>
      ) : null}
    </div>
  );

  const sectionTitle = (title: string) => (
    <h2 className="m-0 text-[14.5px] font-semibold text-[var(--color-text)]">{title}</h2>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div style={{ minWidth: 0 }}>
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
          className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55"
          style={
            saved
              ? { background: "var(--color-success)", border: "1px solid var(--color-success)", color: "var(--color-surface)" }
              : { background: "var(--color-primary)", border: "1px solid var(--color-primary)", color: "var(--color-on-primary)" }
          }
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? t("Disimpan!", "Saved!") : t("Simpan Profil", "Save Profile")}
        </button>
      </div>

      {/* Logo */}
      <section style={panelStyle} aria-labelledby="cp-logo-title">
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <h2 id="cp-logo-title" className="m-0 text-[14.5px] font-semibold text-[var(--color-text)]">
            {t("Logo Syarikat", "Company Logo")}
          </h2>
          <span className="text-[12px] text-[var(--color-text-muted)]">PNG / JPG · 2MB</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-5 py-5">
          <div
            aria-hidden="true"
            className="grid h-[56px] w-[56px] place-items-center rounded-[var(--radius-card)]"
            style={{ background: "var(--color-primary)", color: "var(--color-on-primary)" }}
          >
            <Building2 size={26} />
          </div>
          <div className="min-w-0" style={{ flex: "1 1 220px" }}>
            <p className="m-0 text-[13.5px] font-semibold text-[var(--color-text)]">{logoName}</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-[var(--color-text-muted)]">
              {t("PNG atau JPG · maks. 2MB (mock upload)", "PNG or JPG · max 2MB (mock upload)")}
            </p>
          </div>
          <label
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-muted)]"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            <ImagePlus size={14} style={{ color: "var(--color-primary)" }} />
            {t("Tukar Logo", "Change Logo")}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setLogoName(f.name);
              }}
            />
          </label>
        </div>
      </section>

      {/* Company details */}
      <section style={panelStyle} aria-labelledby="cp-details-title">
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          {sectionTitle(t("Maklumat Syarikat", "Company Details"))}
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          {field("name", "Nama Penuh Syarikat", "Full Company Name", { span: true })}
          {field("brandName", "Nama Jenama", "Brand Name")}
          {field("registrationNo", "No. Pendaftaran (SSM)", "Registration No. (SSM)")}
          {field("phone", "Telefon", "Phone")}
          {field("email", "Emel", "Email", { type: "email" })}
          {field("website", "Laman Web", "Website", { type: "url", span: true })}
        </div>
      </section>

      {/* Licence */}
      <section style={panelStyle} aria-labelledby="cp-licence-title">
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          {sectionTitle(t("Lesen & Lokasi", "Licence & Location"))}
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          {field("licenseNo", "No. Lesen KPL", "Travel Licence No. (KPL)")}
          {field("licenseExpiry", "Tarikh Luput Lesen", "Licence Expiry", { type: "date" })}
          {field("address", "Alamat", "Address", { span: true })}
          {field("city", "Bandar", "City")}
          {field("state", "Negeri", "State")}
          {field("postcode", "Poskod", "Postcode")}
          {field("country", "Negara", "Country")}
        </div>
      </section>

      {/* Bank & tax */}
      <section style={panelStyle} aria-labelledby="cp-invoice-title">
        <div
          className="px-5 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          {sectionTitle(t("Butiran Invois", "Invoice Details"))}
        </div>
        <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
          {field("taxId", "No. Cukai (TIN)", "Tax ID (TIN)")}
          {field("bankName", "Nama Bank", "Bank Name")}
          {field("bankAccount", "No. Akaun Bank", "Bank Account No.")}
          {field("bankHolder", "Nama Pemegang Akaun", "Account Holder", { span: true })}
        </div>
        <div className="px-5 pb-5">
          <div
            className="flex items-start gap-2 rounded-[var(--radius-card)] px-4 py-3 text-[12.5px] leading-relaxed"
            style={{ background: "var(--color-info-soft)", color: "var(--color-info)" }}
          >
            <UploadCloud size={15} style={{ flex: "none", marginTop: 1 }} aria-hidden="true" />
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
          "Data olok-olok — profil syarikat sebenar akan didayakan pada fasa backend.",
          "Mock data — real company profile will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

import { useState } from "react";
import { Building2, Check, ImagePlus, Save, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
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

export default function CompanyProfile() {
  const { t } = useLang();
  const [form, setForm] = useState(INITIAL);
  const [saved, setSaved] = useState(false);
  const [logoName, setLogoName] = useState("zaqone-logo.png");

  const set = (key: FormKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const fieldCls =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const field = (
    key: FormKey,
    labelMs: string,
    labelEn: string,
    opts?: { type?: string; span?: boolean },
  ) => (
    <div className={cn("space-y-1.5", opts?.span && "md:col-span-2")}>
      <label className="text-sm font-medium">{t(labelMs, labelEn)}</label>
      <input
        type={opts?.type ?? "text"}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        className={fieldCls}
      />
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Profil Syarikat", "Company Profile")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Maklumat syarikat, lesen dan butiran bank untuk invois.",
              "Company details, travel licence and bank info for invoices.",
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
          {saved ? t("Disimpan!", "Saved!") : t("Simpan Profil", "Save Profile")}
        </button>
      </div>

      {/* Logo */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <ImagePlus className="h-4 w-4" />
          {t("Logo Syarikat", "Company Logo")}
        </h2>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <p className="text-sm font-medium">{logoName}</p>
            <p className="text-xs text-muted-foreground">
              {t("PNG atau JPG · maks. 2MB (mock upload)", "PNG or JPG · max 2MB (mock upload)")}
            </p>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted/50">
              <UploadCloud className="h-3.5 w-3.5" />
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
        </div>
      </div>

      {/* Company details */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {t("Maklumat Syarikat", "Company Details")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {field("name", "Nama Penuh Syarikat", "Full Company Name", { span: true })}
          {field("brandName", "Nama Jenama", "Brand Name")}
          {field("registrationNo", "No. Pendaftaran (SSM)", "Registration No. (SSM)")}
          {field("phone", "Telefon", "Phone")}
          {field("email", "Emel", "Email", { type: "email" })}
          {field("website", "Laman Web", "Website", { type: "url", span: true })}
        </div>
      </div>

      {/* Licence */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {t("Lesen & Lokasi", "Licence & Location")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {field("licenseNo", "No. Lesen KPL", "Travel Licence No. (KPL)")}
          {field("licenseExpiry", "Tarikh Luput Lesen", "Licence Expiry", { type: "date" })}
          {field("address", "Alamat", "Address", { span: true })}
          {field("city", "Bandar", "City")}
          {field("state", "Negeri", "State")}
          {field("postcode", "Poskod", "Postcode")}
          {field("country", "Negara", "Country")}
        </div>
      </div>

      {/* Bank & tax */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {t("Butiran Invois", "Invoice Details")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {field("taxId", "No. Cukai (TIN)", "Tax ID (TIN)")}
          {field("bankName", "Nama Bank", "Bank Name")}
          {field("bankAccount", "No. Akaun Bank", "Bank Account No.")}
          {field("bankHolder", "Nama Pemegang Akaun", "Account Holder", { span: true })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "Data olok-olok — profil syarikat sebenar akan didayakan pada fasa backend.",
          "Mock data — real company profile will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

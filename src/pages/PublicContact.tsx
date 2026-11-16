import { useState } from "react";
import {
  Send,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Clock,
  MessageCircle,
} from "lucide-react";
import { mockPackages } from "@/lib/mock-data";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface EnquiryForm {
  name: string;
  phone: string;
  email: string;
  packageName: string;
  pax: string;
  departureDate: string;
  message: string;
}

const EMPTY_FORM: EnquiryForm = {
  name: "",
  phone: "",
  email: "",
  packageName: "",
  pax: "2",
  departureDate: "",
  message: "",
};

export default function PublicContact() {
  const { t, lang } = useLang();
  const [form, setForm] = useState<EnquiryForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof EnquiryForm, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof EnquiryForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof EnquiryForm, string>> = {};
    if (!form.name.trim()) next.name = t("Nama wajib diisi", "Name is required");
    if (!form.phone.trim()) next.phone = t("Nombor WhatsApp wajib diisi", "WhatsApp number is required");
    else if (!/^(\+?6?01|01)\d{7,9}$/.test(form.phone.replace(/[\s-]/g, "")))
      next.phone = t("Format nombor WhatsApp tidak sah (cth\\: 0123456789)", "Invalid WhatsApp number format (e.g. 0123456789)");
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      next.email = t("Format email tidak sah", "Invalid email format");
    if (!form.packageName) next.packageName = t("Pilih pakej atau destinasi", "Please choose a package or destination");
    return Object.keys(next).length === 0 ? true : (setErrors(next), false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Frontend phase: show confirmation. The backend phase will POST this to
    // /enquiries which creates a lead in the CRM pipeline.
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <section>
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center">
          <div className="rounded-full bg-emerald-50 p-4">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("Terima kasih", "Thank you")}, {form.name.split(" ")[0]}!
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-stone-600">
            {t(
              "Permintaan anda untuk",
              "Your request for",
            )} <strong>{form.packageName}</strong>{" "}
            {t(
              "telah kami terima. Pasukan ZAQONE TRAVEL akan menghubungi anda melalui WhatsApp ke",
              "has been received. The ZAQONE TRAVEL team will contact you via WhatsApp at",
            )}{" "}
            <strong>{form.phone}</strong>{" "}
            {t("dalam 1×24 jam bekerja.", "within 1 business day.")}
          </p>

          <Card className="mt-6 w-full max-w-md text-left">
            <CardContent className="space-y-2 p-5 text-sm">
              {[
                [t("Nama", "Name"), form.name],
                ["WhatsApp", form.phone],
                ["Email", form.email || "—"],
                [t("Pakej", "Package"), form.packageName],
                [t("Bilangan pax", "Number of pax"), form.pax],
                [
                  t("Tarikh dirancang", "Planned date"),
                  form.departureDate
                    ? new Date(form.departureDate).toLocaleDateString(
                        lang === "ms" ? "ms-MY" : "en-GB",
                        {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        },
                      )
                    : t("Fleksibel", "Flexible"),
                ],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-stone-500">{label}</span>
                  <span className="text-right font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              setForm(EMPTY_FORM);
              setSubmitted(false);
            }}
          >
            {t("Hantar permintaan lain", "Send another request")}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <>
      {/* Header */}
      <section className="bg-gradient-to-b from-red-50/70 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("Hubungi Kami", "Contact Us")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            {t(
              "Isi borang di bawah — konsultasi percuma, tanpa komitmen. Pasukan kami membalas dalam 1×24 jam bekerja melalui WhatsApp.",
              "Fill in the form below — free consultation, no commitment. Our team replies within 1 business day via WhatsApp.",
            )}
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-3">
          {/* Contact info */}
          <div className="space-y-4">
            {[
              {
                icon: MessageCircle,
                title: t("WhatsApp (terpantas)", "WhatsApp (fastest)"),
                lines: ["+60 12 345 6789", t("Sembang terus dengan jualan", "Chat directly with sales")],
              },
              {
                icon: Phone,
                title: t("Telefon Pejabat", "Office Phone"),
                lines: ["+60 3 5555 0123", t("Isnin–Sabtu 09.00–18.00", "Mon–Sat 9am–6pm")],
              },
              {
                icon: Mail,
                title: "Email",
                lines: ["hello@zaqonetravel.com", t("Balasan maks 1×24 jam", "Reply within 1 business day")],
              },
              {
                icon: MapPin,
                title: t("Pejabat", "Office"),
                lines: ["Jalan Sultan Ismail, Kuala Lumpur", t("Lawatan dengan temujanji", "Visits by appointment")],
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardContent className="flex gap-3 p-4">
                  <div className="rounded-lg bg-red-50 p-2">
                    <item.icon className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.lines.map((l) => (
                      <p key={l} className="text-xs text-stone-600">
                        {l}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Form */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      {t("Nama Penuh", "Full Name")} *
                    </label>
                    <Input
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder={t("cth\: Ahmad Zaqi", "e.g. John Smith")}
                    />
                    {errors.name && (
                      <p className="text-xs text-red-600">{errors.name}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      {t("Nombor WhatsApp", "WhatsApp Number")} *
                    </label>
                    <Input
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder={t("cth\: 0123456789", "e.g. 0123456789")}
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-600">{errors.phone}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      {t("Email (pilihan)", "Email (optional)")}
                    </label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="nama@email.com"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-600">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      {t("Pakej / Destinasi", "Package / Destination")} *
                    </label>
                    <select
                      value={form.packageName}
                      onChange={(e) => set("packageName", e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">{t("Pilih pakej…", "Choose a package…")}</option>
                      {mockPackages
                        .filter((p) => p.status !== "archived")
                        .map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      <option value="Belum tahu — minta rekomendasi">
                        {t(
                          "Belum tahu — minta cadangan",
                          "Not sure yet — ask for a recommendation",
                        )}
                      </option>
                    </select>
                    {errors.packageName && (
                      <p className="text-xs text-red-600">
                        {errors.packageName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      {t("Bilangan Pax (anggaran)", "Number of Pax (estimate)")}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={form.pax}
                      onChange={(e) => set("pax", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      {t("Tarikh Dirancang (pilihan)", "Planned Date (optional)")}
                    </label>
                    <Input
                      type="date"
                      value={form.departureDate}
                      onChange={(e) => set("departureDate", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t("Mesej", "Message")}</label>
                  <Textarea
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    rows={4}
                    placeholder={t(
                      "Ceritakan keperluan anda — bajet, pilihan hotel, destinasi impian, dll.",
                      "Tell us your needs — budget, hotel preference, dream destination, etc.",
                    )}
                  />
                </div>

                <Button type="submit" size="lg" className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  {t("Hantar Permintaan", "Send Request")}
                </Button>
                <p className="flex items-center justify-center gap-1 text-center text-[11px] text-stone-500">
                  <Clock className="h-3 w-3" />
                  {t(
                    "Data anda selamat dan hanya digunakan untuk susulan perjalanan.",
                    "Your data is safe and used only for trip follow-up.",
                  )}
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

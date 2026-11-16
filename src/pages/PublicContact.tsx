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
  const [form, setForm] = useState<EnquiryForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof EnquiryForm, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof EnquiryForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof EnquiryForm, string>> = {};
    if (!form.name.trim()) next.name = "Nama wajib diisi";
    if (!form.phone.trim()) next.phone = "Nomor WhatsApp wajib diisi";
    else if (!/^(\+62|62|0)8\d{7,12}$/.test(form.phone.replace(/[\s-]/g, "")))
      next.phone = "Format nomor WhatsApp tidak valid (cth: 081234567890)";
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      next.email = "Format email tidak valid";
    if (!form.packageName) next.packageName = "Pilih paket atau destinasi";
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
            Terima kasih, {form.name.split(" ")[0]}!
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-stone-600">
            Permintaan Anda untuk <strong>{form.packageName}</strong> sudah
            kami terima. Tim TravelOS akan menghubungi Anda via WhatsApp ke{" "}
            <strong>{form.phone}</strong> dalam 1×24 jam kerja.
          </p>

          <Card className="mt-6 w-full max-w-md text-left">
            <CardContent className="space-y-2 p-5 text-sm">
              {[
                ["Nama", form.name],
                ["WhatsApp", form.phone],
                ["Email", form.email || "—"],
                ["Paket", form.packageName],
                ["Jumlah pax", form.pax],
                [
                  "Rencana tanggal",
                  form.departureDate
                    ? new Date(form.departureDate).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Fleksibel",
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
            Kirim permintaan lain
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
            Hubungi Kami
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            Isi form di bawah — konsultasi gratis, tanpa komitmen. Tim kami
            balas dalam 1×24 jam kerja via WhatsApp.
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
                title: "WhatsApp (tercepat)",
                lines: ["+62 812 3456 7890", "Chat langsung dengan sales"],
              },
              {
                icon: Phone,
                title: "Telepon Kantor",
                lines: ["+62 21 5555 0123", "Senin–Sabtu 09.00–18.00"],
              },
              {
                icon: Mail,
                title: "Email",
                lines: ["hello@travelos.id", "Balasan maks 1×24 jam"],
              },
              {
                icon: MapPin,
                title: "Kantor",
                lines: ["Jl. Sudirman Kav. 52, Jakarta", "Kunjungan dengan appointment"],
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
                      Nama Lengkap *
                    </label>
                    <Input
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="cth: Budi Santoso"
                    />
                    {errors.name && (
                      <p className="text-xs text-red-600">{errors.name}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      Nomor WhatsApp *
                    </label>
                    <Input
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                      placeholder="cth: 081234567890"
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-600">{errors.phone}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">
                      Email (opsional)
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
                      Paket / Destinasi *
                    </label>
                    <select
                      value={form.packageName}
                      onChange={(e) => set("packageName", e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">Pilih paket…</option>
                      {mockPackages
                        .filter((p) => p.status !== "archived")
                        .map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      <option value="Belum tahu — minta rekomendasi">
                        Belum tahu — minta rekomendasi
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
                      Jumlah Pax (perkiraan)
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
                      Rencana Tanggal (opsional)
                    </label>
                    <Input
                      type="date"
                      value={form.departureDate}
                      onChange={(e) => set("departureDate", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Pesan</label>
                  <Textarea
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    rows={4}
                    placeholder="Ceritakan kebutuhan Anda — budget, preferensi hotel, destinasi impian, dsb."
                  />
                </div>

                <Button type="submit" size="lg" className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  Kirim Permintaan
                </Button>
                <p className="flex items-center justify-center gap-1 text-center text-[11px] text-stone-500">
                  <Clock className="h-3 w-3" />
                  Data Anda aman dan hanya digunakan untuk keperluan follow-up
                  perjalanan.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

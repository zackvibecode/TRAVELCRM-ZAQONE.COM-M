import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Send,
} from "lucide-react";
import { useLang } from "@/lib/i18n";

const WHATSAPP_URL = "https://wa.me/60123880030";

interface ContactCard {
  icon: typeof MessageCircle;
  title: { ms: string; en: string };
  value: string;
  href?: string;
  note: { ms: string; en: string };
}

const CONTACT_CARDS: ContactCard[] = [
  {
    icon: MessageCircle,
    title: { ms: "WhatsApp (terpantas)", en: "WhatsApp (fastest)" },
    value: "+60 12 388 0030",
    href: WHATSAPP_URL,
    note: { ms: "Sembang terus dengan pasukan jualan", en: "Chat directly with our sales team" },
  },
  {
    icon: Phone,
    title: { ms: "Telefon pejabat", en: "Office phone" },
    value: "+60 3 2711 8899",
    href: "tel:+60327118899",
    note: { ms: "Isnin–Sabtu, 09.00–18.00", en: "Mon–Sat, 9am–6pm" },
  },
  {
    icon: Mail,
    title: { ms: "Email", en: "Email" },
    value: "hello@zaqone.travel",
    href: "mailto:hello@zaqone.travel",
    note: { ms: "Balasan maksimum 1×24 jam bekerja", en: "Reply within 1 business day" },
  },
  {
    icon: MapPin,
    title: { ms: "Pejabat", en: "Office" },
    value: "Jalan Ampang 88, 50450 Kuala Lumpur",
    note: { ms: "Lawatan dengan temujanji", en: "Visits by appointment" },
  },
];

interface MessageForm {
  name: string;
  contact: string;
  subject: string;
  message: string;
}

const EMPTY_FORM: MessageForm = { name: "", contact: "", subject: "", message: "" };

export default function PublicContact() {
  const { t, localePath } = useLang();
  const [form, setForm] = useState<MessageForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof MessageForm, string>>>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof MessageForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof MessageForm, string>> = {};
    if (!form.name.trim()) next.name = t("Nama wajib diisi", "Name is required");
    if (!form.contact.trim())
      next.contact = t(
        "Nombor WhatsApp atau email wajib diisi",
        "WhatsApp number or email is required",
      );
    if (!form.message.trim())
      next.message = t("Mesej wajib diisi", "Message is required");
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return false;
    }
    return true;
  };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    // Borang statik prototaip — pengesahan tempatan tanpa penghantaran API.
    setSubmitted(true);
  }

  const inputClass =
    "h-[42px] w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_var(--color-primary-soft)]";
  const labelClass =
    "text-caption font-semibold tracking-[0.02em] text-[var(--color-text-muted)]";

  if (submitted) {
    return (
      <div className="mx-auto max-w-site px-4">
        <div className="flex max-w-xl flex-col items-center gap-[var(--space-5)] py-[var(--space-9)] text-center">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 place-items-center rounded-full bg-[var(--color-success-soft)]"
          >
            <CheckCircle2 className="h-7 w-7 text-[var(--color-success)]" />
          </span>
          <div className="min-w-0">
            <h1 className="text-heading-md m-0 font-bold">
              {t("Terima kasih", "Thank you")}, {form.name.split(" ")[0]}!
            </h1>
            <p className="text-body-md m-0 mt-2 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
              {t(
                "Mesej anda telah kami terima. Pasukan ZAQONE Travel akan menghubungi anda melalui",
                "Your message has been received. The ZAQONE Travel team will reach you at",
              )}{" "}
              <strong>{form.contact}</strong>{" "}
              {t("dalam 1×24 jam bekerja.", "within 1 business day.")}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setForm(EMPTY_FORM);
                setSubmitted(false);
              }}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-text)] focus-ring"
            >
              {t("Hantar mesej lain", "Send another message")}
            </button>
            <Link
              to={localePath("/site/packages")}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
            >
              {t("Lihat pakej", "Browse packages")}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)]">
      {/* Hero kecil — gaya prototaip public site */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        <div className="mx-auto max-w-site px-4 py-[var(--space-8)]">
          <nav aria-label="Breadcrumb" className="text-caption mb-2 text-[var(--color-text-muted)]">
            <Link
              to={localePath("/site")}
              className="text-inherit no-underline hover:text-[var(--color-primary)] focus-ring rounded"
            >
              {t("Utama", "Home")}
            </Link>
            <span aria-hidden="true" className="px-1.5">/</span>
            <span className="text-[var(--color-text)]">{t("Hubungi kami", "Contact us")}</span>
          </nav>
          <span className="text-caption inline-flex items-center gap-2 font-semibold uppercase tracking-[var(--tracking-wide)] text-[var(--color-primary)]">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {t("Konsultasi percuma", "Free consultation")}
          </span>
          <h1 className="m-0 mt-2 text-balance font-display text-[clamp(26px,3.2vw,34px)] font-extrabold leading-[1.15] tracking-[-0.02em]">
            {t("Hubungi Kami", "Contact Us")}
          </h1>
          <p className="text-body-lg m-0 mt-2 max-w-[46ch] leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
            {t(
              "Ada soalan tentang pakej, tarikh keberangkatan atau tempahan kumpulan? Pasukan kami membalas dalam 1×24 jam bekerja.",
              "Questions about packages, departure dates or group bookings? Our team replies within 1 business day.",
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-site px-4">
        <div className="flex flex-col gap-[var(--space-9)] py-[var(--space-9)]">
          <section
            aria-label={t("Maklumat kontak", "Contact information")}
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
          >
            {CONTACT_CARDS.map((item) => {
              const label = t(item.title.ms, item.title.en);
              const body = (
                <>
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 flex-none place-items-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)]"
                  >
                    <item.icon className="h-4 w-4 text-[var(--color-primary)]" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="text-label-md text-[var(--color-text)]">{label}</span>
                    <span className="text-body-sm font-semibold [overflow-wrap:anywhere] text-[var(--color-text)]">
                      {item.value}
                    </span>
                    <span className="text-caption text-[var(--color-text-muted)]">
                      {t(item.note.ms, item.note.en)}
                    </span>
                  </span>
                </>
              );
              return item.href ? (
                <a
                  key={label}
                  href={item.href}
                  target={item.href.startsWith("http") ? "_blank" : undefined}
                  rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                  className="flex min-w-0 items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 no-underline transition-colors hover:border-[var(--color-border-strong)] hover:shadow-[0_10px_24px_-18px_rgba(20,23,31,0.5)] focus-ring"
                >
                  {body}
                </a>
              ) : (
                <div
                  key={label}
                  className="flex min-w-0 items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  {body}
                </div>
              );
            })}
          </section>

          {/* Borang mesej */}
          <section
            aria-labelledby="contact-form-title"
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
          >
            <div className="flex min-w-0 flex-col gap-[var(--space-3)]">
              <h2
                id="contact-form-title"
                className="text-heading-sm m-0 font-bold"
              >
                {t("Hantar mesej", "Send a message")}
              </h2>
              <p className="text-body-sm m-0 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                {t(
                  "Isi borang ringkas di sebelah — konsultasi percuma, tanpa komitmen. Kami akan hubungi anda melalui WhatsApp atau email.",
                  "Fill in the short form beside — free consultation, no commitment. We will contact you via WhatsApp or email.",
                )}
              </p>
              <p className="text-caption m-0 flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {t(
                  "Data anda selamat dan hanya digunakan untuk susulan perjalanan.",
                  "Your data is safe and used only for trip follow-up.",
                )}
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="contact-name" className={labelClass}>
                    {t("Nama penuh", "Full name")} *
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder={t("cth. Ahmad Zaqi", "e.g. Ahmad Zaqi")}
                    className={inputClass}
                    aria-invalid={errors.name ? true : undefined}
                  />
                  {errors.name ? (
                    <p className="text-caption m-0 text-[var(--color-danger)]">{errors.name}</p>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <label htmlFor="contact-detail" className={labelClass}>
                    {t("WhatsApp / Email", "WhatsApp / Email")} *
                  </label>
                  <input
                    id="contact-detail"
                    type="text"
                    value={form.contact}
                    onChange={(e) => set("contact", e.target.value)}
                    placeholder={t("cth. 0123456789", "e.g. 0123456789")}
                    className={inputClass}
                    aria-invalid={errors.contact ? true : undefined}
                  />
                  {errors.contact ? (
                    <p className="text-caption m-0 text-[var(--color-danger)]">{errors.contact}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="contact-subject" className={labelClass}>
                  {t("Subjek", "Subject")}
                </label>
                <input
                  id="contact-subject"
                  type="text"
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  placeholder={t(
                    "cth. Pertanyaan pakej Jepun April",
                    "e.g. Japan package enquiry for April",
                  )}
                  className={inputClass}
                />
              </div>

              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="contact-message" className={labelClass}>
                  {t("Mesej", "Message")} *
                </label>
                <textarea
                  id="contact-message"
                  rows={5}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder={t(
                    "Ceritakan keperluan anda — bajet, pilihan hotel, destinasi impian, bilangan pax, dll.",
                    "Tell us your needs — budget, hotel preference, dream destination, number of pax, etc.",
                  )}
                  className="w-full rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm leading-[var(--leading-normal)] text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:shadow-[0_0_0_3px_var(--color-primary-soft)]"
                  aria-invalid={errors.message ? true : undefined}
                />
                {errors.message ? (
                  <p className="text-caption m-0 text-[var(--color-danger)]">{errors.message}</p>
                ) : null}
              </div>

              <button
                type="submit"
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {t("Hantar Mesej", "Send Message")}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

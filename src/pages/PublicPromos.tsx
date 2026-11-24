import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BadgePercent,
  Clock,
  Flame,
  Sparkles,
  Users,
} from "lucide-react";
import { useLang } from "@/lib/i18n";

const IMG = {
  japan: "https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=900&q=70",
  korea: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=900&q=70",
  lombok: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=900&q=70",
};

interface Promo {
  id: string;
  label: { ms: string; en: string };
  tag: string;
  name: string;
  destination: string;
  days: string;
  departs: string;
  originalPrice: number;
  promoPrice: number;
  discountPct: number;
  tone: { bg: string; fg: string };
  icon: typeof Flame;
  blurb: { ms: string; en: string };
  image: string;
}

const PROMOS: Promo[] = [
  {
    id: "flash-sale",
    label: { ms: "Jualan Kilat", en: "Flash Sale" },
    tag: "FLASH SALE",
    name: "Japan Sakura 7D6N",
    destination: "Japan",
    days: "7 hari 6 malam",
    departs: "4 Apr 2026",
    originalPrice: 6290,
    promoPrice: 5032,
    discountPct: 20,
    tone: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
    icon: Flame,
    blurb: {
      ms: "Diskaun terhad untuk keberangkatan terdekat — kuota kerusi terhad!",
      en: "Limited discount for the nearest departures — limited seat quota!",
    },
    image: IMG.japan,
  },
  {
    id: "early-bird",
    label: { ms: "Early Bird", en: "Early Bird" },
    tag: "EARLY BIRD",
    name: "Korea Autumn 6D5N",
    destination: "Korea",
    days: "6 hari 5 malam",
    departs: "18 Okt 2026",
    originalPrice: 5250,
    promoPrice: 4463,
    discountPct: 15,
    tone: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
    icon: Clock,
    blurb: {
      ms: "Tempah awal, bayar kurang — sah untuk jadual 3 bulan akan datang.",
      en: "Book early, pay less — valid for schedules 3 months ahead.",
    },
    image: IMG.korea,
  },
  {
    id: "group-deal",
    label: { ms: "Tawaran Berkumpulan", en: "Group Deal" },
    tag: "GROUP DEAL",
    name: "Lombok & Gili 4D3N",
    destination: "Lombok",
    days: "4 hari 3 malam",
    departs: "12 Mac 2026",
    originalPrice: 1410,
    promoPrice: 1269,
    discountPct: 10,
    tone: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
    icon: Users,
    blurb: {
      ms: "Ajak 6+ rakan pergi bersama, semua dapat diskaun kumpulan.",
      en: "Bring 6+ friends along and everyone gets a group discount.",
    },
    image: IMG.lombok,
  },
];

const TERMS: { ms: string; en: string }[] = [
  {
    ms: "Promosi sah untuk pendaftaran baharu sepanjang tempoh berjalan.",
    en: "Promos apply to new registrations during the running period.",
  },
  {
    ms: "Harga promosi tidak boleh digabung dengan diskaun lain.",
    en: "Promo prices cannot be combined with other discounts.",
  },
  {
    ms: "Kuota kerusi promosi terhad dan boleh tamat bila-bila masa.",
    en: "Promo seat quotas are limited and may end at any time.",
  },
  {
    ms: "Bayaran deposit minimum 30% untuk mengekalkan harga promosi.",
    en: "A minimum 30% deposit locks in the promo price.",
  },
  {
    ms: "Perubahan jadual selepas pengesahan dikenakan caj pentadbiran.",
    en: "Schedule changes after confirmation incur an administrative fee.",
  },
  {
    ms: "Keputusan ZAQONE TRAVEL adalah muktamad bagi sebarang pertikaian promosi.",
    en: "ZAQONE TRAVEL's decision is final on any promo disputes.",
  },
];

function ringgit(value: number): string {
  return "RM " + value.toLocaleString("en-MY");
}

export default function PublicPromos() {
  const { t, localePath } = useLang();

  return (
    <div className="bg-[var(--color-surface)]">
      {/* Hero kecil — gaya prototaip public site */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
        <div className="mx-auto max-w-site px-4 md:px-6 py-[var(--space-8)]">
          <nav aria-label="Breadcrumb" className="text-caption mb-2 text-[var(--color-text-muted)]">
            <Link
              to={localePath("/site")}
              className="text-inherit no-underline hover:text-[var(--color-primary)] focus-ring rounded"
            >
              {t("Utama", "Home")}
            </Link>
            <span aria-hidden="true" className="px-1.5">/</span>
            <span className="text-[var(--color-text)]">{t("Promosi", "Promos")}</span>
          </nav>
          <span className="text-caption inline-flex items-center gap-2 font-semibold uppercase tracking-[var(--tracking-wide)] text-[var(--color-primary)]">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t("Tawaran istimewa", "Special offers")}
          </span>
          <h1 className="m-0 mt-2 text-balance font-display text-[clamp(26px,3.2vw,34px)] font-extrabold leading-[1.15] tracking-[-0.02em]">
            {t("Promosi & Tawaran Istimewa", "Promos & Special Offers")}
          </h1>
          <p className="text-body-lg m-0 mt-2 max-w-[52ch] leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
            {t(
              "Diskaun flash sale, harga early bird dan tawaran kumpulan untuk pakej pilihan. Cepat — kuota dan tempoh promosi terhad.",
              "Flash sale discounts, early bird pricing and group offers for selected packages. Act fast — quotas and promo periods are limited.",
            )}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-site px-4 md:px-6">
        <div className="flex flex-col gap-[var(--space-9)] py-[var(--space-9)]">
          {/* Grid kad promo */}
          <section aria-labelledby="promos-list-title">
            <h2 id="promos-list-title" className="sr-only">
              {t("Senarai promosi", "Promo list")}
            </h2>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {PROMOS.map((promo) => {
                const label = t(promo.label.ms, promo.label.en);
                return (
                  <article
                    key={promo.id}
                    className="flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-border-strong)] hover:shadow-[0_10px_24px_-18px_rgba(20,23,31,0.5)]"
                  >
                    <div className="relative bg-[var(--color-surface-muted)] [aspect-ratio:16/10]">
                      <img
                        src={promo.image}
                        alt={t(
                          `Landskap perjalanan di ${promo.destination}`,
                          `Travel scene in ${promo.destination}`,
                        )}
                        width={900}
                        height={563}
                        loading="lazy"
                        className="block h-full w-full object-cover"
                      />
                      <span
                        className="absolute left-3 top-3 inline-flex items-center gap-[5px] whitespace-nowrap rounded-[var(--radius-pill)] px-[10px] py-[4px] text-xs font-bold tracking-[var(--tracking-wide)]"
                        style={{ background: promo.tone.bg, color: promo.tone.fg }}
                      >
                        <promo.icon className="h-3.5 w-3.5" aria-hidden="true" />
                        -{promo.discountPct}%
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="grid h-8 w-8 flex-none place-items-center rounded-[var(--radius-control)]"
                          style={{ background: promo.tone.bg, color: promo.tone.fg }}
                        >
                          <promo.icon className="h-4 w-4" />
                        </span>
                        <span className="text-label-md text-[var(--color-text)]">{label}</span>
                      </div>
                      <span className="text-caption text-[var(--color-text-muted)]">
                        {promo.destination} · {t(promo.days, promo.days)}
                      </span>
                      <h3 className="text-heading-sm m-0 font-semibold leading-[var(--leading-tight)]">
                        {promo.name}
                      </h3>
                      <p className="text-caption m-0 text-[var(--color-text-muted)]">
                        {t("Berangkat", "Departs")} {promo.departs}
                      </p>

                      <div className="mt-1 flex flex-wrap items-baseline gap-2">
                        <span className="text-body-sm text-[var(--color-text-muted)] line-through [font-variant-numeric:tabular-nums]">
                          {ringgit(promo.originalPrice)}
                        </span>
                        <span className="text-[20px] font-bold text-[var(--color-primary)] [font-variant-numeric:tabular-nums]">
                          {ringgit(promo.promoPrice)}
                        </span>
                      </div>
                      <p className="text-caption m-0 text-[var(--color-text-muted)]">
                        {t("per pax dewasa", "per adult pax")}
                      </p>

                      <p className="text-body-sm m-0 mt-1 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                        {t(promo.blurb.ms, promo.blurb.en)}
                      </p>

                      <Link
                        to={localePath("/site/contact")}
                        className="mt-auto inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
                      >
                        <BadgePercent className="h-4 w-4" aria-hidden="true" />
                        {t("Ambil Promosi Ini", "Claim This Promo")}
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Syarat & Ketentuan */}
          <section
            aria-labelledby="promos-terms-title"
            className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6 max-sm:p-4"
          >
            <h2
              id="promos-terms-title"
              className="m-0 text-caption font-bold uppercase tracking-[var(--tracking-wide)] text-[var(--color-text-muted)]"
            >
              {t("Syarat & Ketentuan", "Terms & Conditions")}
            </h2>
            <ul className="text-body-sm m-0 mt-3 grid list-none gap-2 p-0 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)] sm:grid-cols-2">
              {TERMS.map((term, index) => (
                <li key={index} className="flex gap-1.5">
                  <span aria-hidden="true">•</span>
                  <span>{t(term.ms, term.en)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Help strip */}
          <section
            aria-labelledby="promos-help-title"
            className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-6 max-sm:p-4"
          >
            <div className="min-w-0">
              <h2 id="promos-help-title" className="text-heading-sm m-0 font-bold">
                {t("Perlukan bantuan memilih promosi?", "Need help choosing a promo?")}
              </h2>
              <p className="text-body-sm m-0 mt-1.5 leading-[var(--leading-relaxed)] text-[var(--color-text-secondary)]">
                {t(
                  "Beritahu kami destinasi dan saiz kumpulan anda — kami akan cadangkan tawaran terbaik.",
                  "Tell us your destination and group size — we will recommend the best offer.",
                )}
              </p>
            </div>
            <Link
              to={localePath("/site/contact")}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
            >
              {t("Hubungi Kami", "Contact Us")}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

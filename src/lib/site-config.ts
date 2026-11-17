/** Shared website configuration consumed by both the admin Website Manager
 *  and the public site. The backend phase will replace these constants with
 *  API-backed data. */

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  /** ISO dates — banner only shows on the public site between these dates. */
  startAt: string;
  endAt: string;
  active: boolean;
}

export interface SeoSettings {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  /** English variant for the /site/en locale (falls back to the BM text). */
  metaTitleEn?: string;
  metaDescriptionEn?: string;
  keywordsEn?: string;
}

export const siteBanners: Banner[] = [
  {
    id: "ban-1",
    title: "Sakura Season 2027 — Early Bird 15%",
    subtitle: "Booking sebelum Desember untuk keberangkatan Maret–April.",
    ctaLabel: "Lihat Paket Jepang",
    ctaHref: "/site/packages",
    startAt: "2026-11-01",
    endAt: "2026-12-31",
    active: true,
  },
  {
    id: "ban-2",
    title: "Weekend Getaway Bali & Lombok",
    subtitle: "Open trip tiap Jumat malam — cocok untuk pekerja kantoran.",
    ctaLabel: "Cek Jadwal",
    ctaHref: "/site/packages",
    startAt: "2026-11-10",
    endAt: "2027-01-15",
    active: true,
  },
];

export const siteSeo: Record<string, SeoSettings> = {
  home: {
    metaTitle: "ZAQONE TRAVEL — Pakej Pelancongan Domestik & Antarabangsa",
    metaDescription:
      "Agensi pelancongan serba lengkap: open trip, private tour, dan korporat dengan itinerary terkurasi dan harga telus. Tempahan mudah, sokongan penuh.",
    keywords: "pakej pelancongan, open trip, agensi travel malaysia, travel murah",
    metaTitleEn: "ZAQONE TRAVEL — Domestic & International Tour Packages",
    metaDescriptionEn:
      "All-in-one travel agency: open trips, private tours, and corporate travel with curated itineraries and transparent pricing. Easy booking, full support.",
    keywordsEn: "tour packages malaysia, open trip, travel agency kuala lumpur, cheap travel",
  },
  promos: {
    metaTitle: "Promosi & Tawaran Istimewa — ZAQONE TRAVEL",
    metaDescription:
      "Diskaun flash sale, harga early bird, dan tawaran kumpulan untuk pakej pelancongan pilihan. Kuota terhad!",
    keywords: "promosi pelancongan, diskaun tiket tour, flash sale travel",
    metaTitleEn: "Promos & Special Offers — ZAQONE TRAVEL",
    metaDescriptionEn:
      "Flash sale discounts, early bird pricing, and group deals on selected tour packages. Limited quota!",
    keywordsEn: "travel promotions, tour discounts, flash sale travel deals",
  },
  packages: {
    metaTitle: "Pakej Pelancongan Lengkap — ZAQONE TRAVEL",
    metaDescription:
      "Terokai semua pakej pelancongan ZAQONE TRAVEL: Jepun, Korea, Bali, Lombok, Singapura, hingga Eropah. Harga per pax jelas, keberangkatan berjadual.",
    keywords: "pakej tour jepang, wisata bali, tour korea, pakej eropah",
    metaTitleEn: "Complete Tour Packages — ZAQONE TRAVEL",
    metaDescriptionEn:
      "Explore all ZAQONE TRAVEL packages: Japan, Korea, Bali, Lombok, Singapore, and Europe. Clear per-pax pricing, scheduled departures.",
    keywordsEn: "japan tour package, bali holiday, korea tour, europe package",
  },
};

/** Returns banners active within today's window. */
export function activeBanners(): Banner[] {
  const today = new Date().toISOString().slice(0, 10);
  return siteBanners.filter(
    (b) => b.active && b.startAt <= today && b.endAt >= today,
  );
}

/** Applies SEO metadata (title + meta description) for the given page key,
 *  localised to the active public language when an English variant exists. */
export function applySeo(page: string, lang: "ms" | "en" = "ms"): void {
  const seo = siteSeo[page];
  if (!seo) return;

  const en = lang === "en";
  document.title = (en && seo.metaTitleEn) || seo.metaTitle;

  let desc = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );
  if (!desc) {
    desc = document.createElement("meta");
    desc.name = "description";
    document.head.appendChild(desc);
  }
  desc.content = (en && seo.metaDescriptionEn) || seo.metaDescription;

  let kw = document.querySelector<HTMLMetaElement>('meta[name="keywords"]');
  if (!kw) {
    kw = document.createElement("meta");
    kw.name = "keywords";
    document.head.appendChild(kw);
  }
  kw.content = (en && seo.keywordsEn) || seo.keywords;
}

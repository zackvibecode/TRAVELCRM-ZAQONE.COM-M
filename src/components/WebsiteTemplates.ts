import type { Block, BlockKind } from "../pages/WebsiteContentEditorTypes";

/**
 * Ready-made content templates for a travel agency site. Applying one
 * replaces the block list with a fully ordered outline so staff only fill
 * in the blanks instead of assembling blocks one by one.
 *
 * `blocks` describes the outline; `packageTemplate` marks templates that
 * must be filled from a real package in D1 (itinerary, pricing, gallery).
 */

export interface TemplateBlock {
  kind: BlockKind;
  value: string;
}

export interface ContentTemplate {
  id: string;
  nameMs: string;
  nameEn: string;
  descMs: string;
  descEn: string;
  /** Suggested page type for the editor dropdown. */
  type: string;
  /** Suggested summary text (staff overwrites). */
  summary: string;
  blocks: TemplateBlock[];
  /** When true the editor asks the user to pick a package from D1 first. */
  needsPackage?: boolean;
}

export const TEMPLATES: ContentTemplate[] = [
  {
    id: "pakej-sebenar",
    nameMs: "Halaman Pakej (Dari Data Sebenar)",
    nameEn: "Package Page (From Live Data)",
    descMs:
      "Pilih satu pakej daripada pustaka CRM — itinerary hari demi hari, harga, termasuk/tidak dan galeri diisi automatik dari data sebenar.",
    descEn:
      "Pick a package from the CRM library — day-by-day itinerary, pricing, inclusions and gallery are filled from live data automatically.",
    type: "Promo page",
    summary: "",
    needsPackage: true,
    blocks: [
      { kind: "hero", value: "" },
      { kind: "heading", value: "Ringkasan Pakej" },
      { kind: "text", value: "" },
      { kind: "heading", value: "Sorotan Trip" },
      { kind: "list", value: "" },
      { kind: "heading", value: "Itinerary Hari demi Hari" },
      { kind: "itinerary", value: "" },
      { kind: "heading", value: "Harga" },
      { kind: "pricing", value: "" },
      { kind: "heading", value: "Termasuk & Tidak Termasuk" },
      { kind: "list", value: "" },
      { kind: "heading", value: "Galeri Perjalanan" },
      { kind: "gallery", value: "" },
      { kind: "cta", value: "Tempah Sekarang" },
    ],
  },
  {
    id: "pakej",
    nameMs: "Halaman Pakej Pelancongan",
    nameEn: "Travel Package Page",
    descMs:
      "Struktur lengkap promosi pakej: hero, pengenalan, sorotan, itinerary, harga, termasuk/tidak, CTA tempahan.",
    descEn:
      "Full package promotion outline: hero, intro, highlights, itinerary, pricing, inclusions, booking CTA.",
    type: "Promo page",
    summary:
      "Pakej pelancongan semua termasuk dengan ketua rombongan berpengalaman, penginapan selesa dan itinerary lengkap.",
    blocks: [
      { kind: "hero", value: "" },
      { kind: "heading", value: "Ringkasan Pakej" },
      {
        kind: "text",
        value:
          "Tulis pengenalan pakej di sini: destinasi, durasi, kenapa pakej ini istimewa, dan untuk siapa pakej ini sesuai.",
      },
      { kind: "heading", value: "Sorotan Trip" },
      {
        kind: "list",
        value:
          "Destinasi utama|Penginapan bintang dan tempat menarik|Makanan termasuk|Ketua rombongan berpengalaman|Insurans perjalanan",
      },
      { kind: "heading", value: "Itinerary Hari demi Hari" },
      { kind: "text", value: "Hari 1: Kedatangan — tulis aktiviti hari pertama di sini." },
      { kind: "text", value: "Hari 2: — tulis aktiviti hari kedua di sini." },
      { kind: "text", value: "Hari 3: — tulis aktiviti hari ketiga di sini." },
      { kind: "heading", value: "Harga" },
      {
        kind: "text",
        value:
          "Dewasa (12+): RM 0/pax\nKanak-kanak (2–11): RM 0/pax\nBayi (bawah 2): RM 0/pax\nDeposit 30% untuk tempahan awal.",
      },
      { kind: "heading", value: "Termasuk & Tidak Termasuk" },
      {
        kind: "list",
        value: "TERMASUK: Tiket penerbangan|Penginapan|Pengangkutan|Makanan ikut itinerary|Ketua rombongan",
      },
      {
        kind: "list",
        value:
          "TIDAK TERMASUK: Perbelanjaan peribadi|Tipping|Visa (sokongan permohonan disediakan)|Aktiviti pilihan luar itinerary",
      },
      { kind: "cta", value: "Tempah Sekarang" },
    ],
  },
  {
    id: "promosi",
    nameMs: "Halaman Promosi / Diskaun",
    nameEn: "Promo / Discount Page",
    descMs: "Halaman kilat untuk promosi bermusim: hero, tawaran, syarat, CTA.",
    descEn: "Flash promo page: hero, offer, terms, CTA.",
    type: "Promo page",
    summary: "Penawaran terhad masa — simpan tempat anda sebelum kuota habis.",
    blocks: [
      { kind: "hero", value: "" },
      { kind: "heading", value: "Tawaran Spesial" },
      { kind: "text", value: "Diskaun sehingga X% untuk tempahan sebelum [tarikh]. Kuota terhad!" },
      {
        kind: "list",
        value:
          "Diskaun X% harga pakej|Hadiah percuma untuk 10 tempahan pertama|Pembatalan percuma 30 hari sebelum",
      },
      { kind: "heading", value: "Syarat & Ketentuan" },
      {
        kind: "text",
        value:
          "Tulis syarat promosi di sini (tempoh, pakej terlibat, tidak boleh digabung dengan tawaran lain).",
      },
      { kind: "cta", value: "Dapatkan Tawaran Ini" },
    ],
  },
  {
    id: "destinasi",
    nameMs: "Halaman Destinasi",
    nameEn: "Destination Page",
    descMs: "Perkenalkan satu destinasi: hero, mesti lawat, pengalaman, tips, CTA tengok pakej.",
    descEn: "Introduce a destination: hero, must-sees, experiences, travel tips, packages CTA.",
    type: "Landing page",
    summary: "Temui [destinasi] — panduan ringkas untuk percutian pertama anda.",
    blocks: [
      { kind: "hero", value: "" },
      { kind: "heading", value: "Kenali [Destinasi]" },
      { kind: "text", value: "Tulis pengenalan destinasi: budaya, makanan, musim terbaik untuk melawat." },
      { kind: "heading", value: "Tempat Wajib Lawati" },
      { kind: "list", value: "Tempat tarikan 1|Tempat tarikan 2|Tempat tarikan 3|Tempat tarikan 4" },
      { kind: "heading", value: "Pengalaman Popular" },
      { kind: "text", value: "Aktiviti yang paling digemari pelancong di destinasi ini." },
      { kind: "heading", value: "Tips Perjalanan" },
      { kind: "list", value: "Mata wang & bajet|Cuaca & pakaian|Pengangkutan|Do & Don't" },
      { kind: "cta", value: "Lihat Pakej [Destinasi]" },
    ],
  },
  {
    id: "tentang",
    nameMs: "Halaman Tentang Kami",
    nameEn: "About Us Page",
    descMs: "Kisuh syarikat: hero, misi, kelebihan, pencapaian, CTA hubungi.",
    descEn: "Company story: hero, mission, why us, milestones, contact CTA.",
    type: "Static page",
    summary: "Agensi pelancongan berpengalaman yang melayani ribuan pelancong dengan amanah.",
    blocks: [
      { kind: "hero", value: "" },
      { kind: "heading", value: "Tentang Kami" },
      { kind: "text", value: "Tulis kisah syarikat: bila ditubuhkan, misi, dan nilai yang dipegang." },
      { kind: "heading", value: "Kenapa Pilih Kami" },
      {
        kind: "list",
        value:
          "Pengalaman bertahun-tahun|Itinerary teliti & telus|Sokongan penuh sepanjang trip|Harga berdaya saing",
      },
      { kind: "heading", value: "Pencapaian" },
      { kind: "text", value: "Contoh: 12,000+ pelancong berpuas hati, rating 4.9/5, anugerah industri." },
      { kind: "cta", value: "Hubungi Kami" },
    ],
  },
  {
    id: "kosong",
    nameMs: "Mula Kosong",
    nameEn: "Start Blank",
    descMs: "Mula dengan senarai blok kosong — susun sendiri.",
    descEn: "Start with an empty block list — arrange everything yourself.",
    type: "Static page",
    summary: "",
    blocks: [],
  },
];

/** Instantiate template blocks with fresh ids. */
export function instantiateTemplate(tpl: ContentTemplate, idSeed: number): Block[] {
  return tpl.blocks.map((b, i) => ({
    id: `blk-tpl-${idSeed}-${i}`,
    kind: b.kind,
    value: b.value,
  }));
}

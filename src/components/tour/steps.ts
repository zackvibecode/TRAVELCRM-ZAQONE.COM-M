import type { TourStep } from "./TourContext";

/**
 * Sales onboarding tour — follows the real daily lead flow:
 * Import Lead → Lead Management → Follow-Up Engine (FU1–FU3).
 *
 * Every `anchor` matches a `data-tour="..."` attribute on the real page element.
 */
export const SALES_TOUR_STEPS: TourStep[] = [
  {
    route: "/lead-import",
    anchor: "import-format",
    side: "bottom",
    ms: {
      title: "Langkah 1 — Format fail lead",
      body: "Mula di sini. Fail Excel/CSV mesti ikut susunan lajur Name → Phone → Package → Pax. Satu baris untuk satu pelanggan. Boleh muat turun templat (.csv) jika belum ada.",
    },
    en: {
      title: "Step 1 — Lead file format",
      body: "Start here. Your Excel/CSV file must follow the column order Name → Phone → Package → Pax. One row per customer. Download the template (.csv) if you don't have one yet.",
    },
  },
  {
    route: "/lead-import",
    anchor: "import-dropzone",
    side: "top",
    ms: {
      title: "Langkah 2 — Muat naik fail",
      body: "Seret fail ke sini atau klik untuk pilih. Selepas fail disahkan, import berjalan automatik dan semua lead masuk ke sistem — tiada butang tambah diperlukan.",
    },
    en: {
      title: "Step 2 — Upload the file",
      body: "Drag your file here or click to pick one. Once the file is validated, the import runs automatically and every lead enters the system — no extra button needed.",
    },
  },
  {
    route: "/lead-management",
    anchor: "lead-table",
    side: "top",
    ms: {
      title: "Langkah 3 — Pengurusan Lead",
      body: "Klik mana-mana lead untuk buka butiran — nombor WhatsApp, pakej, dan sejarah susulan.",
    },
    en: {
      title: "Step 3 — Lead Management",
      body: "Click any lead to open its details — WhatsApp number, package, and follow-up history.",
    },
  },
  {
    route: "/mesin-follow-up",
    anchor: "engine-stages",
    side: "top",
    ms: {
      title: "Langkah 4 — Mesin Follow-Up",
      body: "Tiga peringkat susulan. FU1 dijadualkan automatik bila lead masuk, FU2 selepas FU1 tanpa jawapan, FU3 = eskalasi untuk semakan admin.",
    },
    en: {
      title: "Step 4 — Follow-Up Engine",
      body: "Three follow-up stages. FU1 is scheduled automatically when a lead comes in, FU2 after FU1 with no reply, FU3 = escalation for admin review.",
    },
  },
  {
    route: "/mesin-follow-up",
    anchor: "engine-lead-action",
    side: "left",
    ms: {
      title: "Langkah 5 — Hantar susulan",
      body: "Tekan butang WhatsApp — mesej templat dibuka dan susulan bergerak ke peringkat seterusnya secara automatik. Selesai!",
    },
    en: {
      title: "Step 5 — Send a follow-up",
      body: "Tap the WhatsApp button — the template message opens and the follow-up moves to the next stage automatically. Done!",
    },
  },
];

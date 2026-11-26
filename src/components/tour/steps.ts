import type { TourStep } from "./TourContext";

/**
 * Sales onboarding tour — follows the real daily lead flow:
 * Import Lead → Leads Pipeline → Lead Management → Follow-Up Center →
 * Follow-Up Engine (FU1–FU3).
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
    route: "/leads",
    anchor: "pipeline-board",
    side: "top",
    ms: {
      title: "Langkah 3 — Saluran Leads",
      body: "Lead yang diimport muncul di sini. Seret kad mengikut peringkat untuk kemaskini status lead.",
    },
    en: {
      title: "Step 3 — Leads Pipeline",
      body: "Imported leads show up here. Drag cards across stages to update a lead's status.",
    },
  },
  {
    route: "/lead-management",
    anchor: "lead-table",
    side: "top",
    ms: {
      title: "Langkah 4 — Pengurusan Lead",
      body: "Klik mana-mana lead untuk buka butiran — nombor WhatsApp, pakej, dan sejarah susulan.",
    },
    en: {
      title: "Step 4 — Lead Management",
      body: "Click any lead to open its details — WhatsApp number, package, and follow-up history.",
    },
  },
  {
    route: "/followups",
    anchor: "fu-today-tab",
    side: "bottom",
    ms: {
      title: "Langkah 5 — Pusat Susulan",
      body: "Senarai lead yang perlu dihubungi hari ini, tertunggak, atau dijeda. Mula dengan tab Hari Ini setiap pagi.",
    },
    en: {
      title: "Step 5 — Follow-Up Center",
      body: "Leads to contact today, overdue, or paused. Start on the Today tab every morning.",
    },
  },
  {
    route: "/mesin-follow-up",
    anchor: "engine-stages",
    side: "top",
    ms: {
      title: "Langkah 6 — Mesin Follow-Up",
      body: "Tiga peringkat susulan. FU1 dijadualkan automatik bila lead masuk, FU2 selepas FU1 tanpa jawapan, FU3 = eskalasi untuk semakan admin.",
    },
    en: {
      title: "Step 6 — Follow-Up Engine",
      body: "Three follow-up stages. FU1 is scheduled automatically when a lead comes in, FU2 after FU1 with no reply, FU3 = escalation for admin review.",
    },
  },
  {
    route: "/mesin-follow-up",
    anchor: "engine-lead-action",
    side: "left",
    ms: {
      title: "Langkah 7 — Hantar susulan",
      body: "Tekan butang WhatsApp — mesej templat dibuka dan susulan bergerak ke peringkat seterusnya secara automatik. Selesai!",
    },
    en: {
      title: "Step 7 — Send a follow-up",
      body: "Tap the WhatsApp button — the template message opens and the follow-up moves to the next stage automatically. Done!",
    },
  },
];

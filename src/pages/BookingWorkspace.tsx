import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarCheck2,
  Check,
  Circle,
  CircleAlert,
  Clock,
  Inbox,
  Info,
  Plus,
  ReceiptText,
  Search,
  Table2,
  Trash2,
  TriangleAlert,
  UserPlus,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import type { BookingStatus } from "@/lib/types";
import { useLang } from "@/lib/i18n";

// ------------------------------------------------------------------ styles

const css = `
.bw-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-4); }
.bw-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: var(--space-4); align-items: start; }
.bw-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-panel); min-width: 0; overflow: hidden; }
.bw-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); padding: 14px var(--space-5); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
.bw-card__title { margin: 0; font-size: 14.5px; font-weight: 600; color: var(--color-text); }
.bw-card__sub { margin: 3px 0 0; font-size: 12px; color: var(--color-text-muted); }
.bw-toolbar { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); flex-wrap: wrap; }
.bw-search { display: flex; align-items: center; gap: 8px; flex: 1 1 220px; max-width: 320px; min-width: 0; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface-raised); color: var(--color-text-muted); }
.bw-search input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 13px; color: var(--color-text); outline: none; }
.bw-search:focus-within { border-color: var(--color-primary); background: var(--color-surface); box-shadow: 0 0 0 3px var(--color-primary-soft); }
.bw-select { padding: 8px 10px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); font: inherit; font-size: 12.5px; font-weight: 500; color: var(--color-text-secondary); cursor: pointer; max-width: 100%; min-width: 0; }
.bw-select:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
.bw-tabs { display: flex; gap: 4px; }
.bw-tab { padding: 7px 12px; border-radius: var(--radius-pill); border: 1px solid transparent; background: transparent; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--color-text-muted); cursor: pointer; white-space: nowrap; }
.bw-tab:hover { background: var(--color-surface-muted); color: var(--color-text); }
.bw-tab[aria-selected="true"] { background: var(--color-primary-soft); color: var(--color-primary); }
.bw-tab:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
.bw-tab__count { font-size: 11px; font-weight: 700; padding: 0 5px; margin-left: 4px; border-radius: var(--radius-pill); background: var(--color-surface-muted); font-variant-numeric: tabular-nums; }
.bw-tab[aria-selected="true"] .bw-tab__count { background: var(--color-surface); }

.bw-list { display: flex; flex-direction: column; }
.bw-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-2) var(--space-3); align-items: center; width: 100%; padding: 12px var(--space-5); border: 0; border-bottom: 1px solid var(--color-border); background: transparent; font: inherit; text-align: left; cursor: pointer; color: var(--color-text); }
.bw-row:last-child { border-bottom: 0; }
.bw-row:hover { background: var(--color-surface-raised); }
.bw-row:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: -2px; }
.bw-row[aria-current="true"] { background: var(--color-primary-soft); box-shadow: inset 3px 0 0 var(--color-primary); }
.bw-row__main { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.bw-row__ref { font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.bw-row__name { font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bw-row__meta { font-size: 11.5px; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bw-row__side { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.bw-row__amount { font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }

.bw-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: var(--radius-pill); font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.bw-body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-5); }
.bw-kv { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 7px 12px; font-size: 12.5px; margin: 0; }
.bw-kv dt { color: var(--color-text-muted); }
.bw-kv dd { margin: 0; font-weight: 500; overflow-wrap: anywhere; }
.bw-money { display: grid; gap: 6px; font-size: 12.5px; }
.bw-money div { display: flex; justify-content: space-between; gap: var(--space-3); }
.bw-money strong { font-variant-numeric: tabular-nums; white-space: nowrap; }
.bw-bar { display: block; height: 7px; border-radius: var(--radius-pill); background: var(--color-surface-muted); overflow: hidden; }
.bw-bar span { display: block; height: 100%; }
.bw-pax { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); padding: 9px 0; border-top: 1px solid var(--color-border); font-size: 12.5px; }
.bw-pax:first-child { border-top: 0; padding-top: 0; }
.bw-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; font-size: 12.5px; }
.bw-timeline li { display: flex; gap: 10px; align-items: flex-start; }
.bw-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: none; }

.bw-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border-radius: var(--radius-control); border: 1px solid var(--color-border); background: var(--color-surface); font: inherit; font-size: 12.5px; font-weight: 600; color: var(--color-text); cursor: pointer; text-decoration: none; transition: background 140ms ease, border-color 140ms ease; }
.bw-btn:hover { background: var(--color-surface-muted); }
.bw-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
.bw-btn--primary { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
.bw-btn--primary:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
.bw-btn--danger { color: var(--color-danger); border-color: color-mix(in srgb, var(--color-danger) 35%, transparent); }
.bw-btn--danger:hover { background: var(--color-danger-soft); }
.bw-btn.bg-solid { background: var(--color-danger); color: var(--color-on-primary); border-color: var(--color-danger); }
.bw-btn.bg-solid:hover { background: color-mix(in srgb, var(--color-danger) 84%, var(--color-text)); }
.bw-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.bw-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.bw-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: var(--space-8) var(--space-5); text-align: center; color: var(--color-text-muted); font-size: 13px; }
.bw-empty svg { width: 26px; height: 26px; }

.bw-dialog { width: min(880px, calc(100vw - 32px)); max-height: calc(100vh - 48px); border: 1px solid var(--color-border); border-radius: var(--radius-panel); padding: 0; background: var(--color-surface); color: var(--color-text); box-shadow: 0 24px 64px color-mix(in srgb, var(--color-text) 22%, transparent); }
.bw-dialog[open] { display: flex; flex-direction: column; overflow: hidden; }
.bw-dialog::backdrop { background: color-mix(in srgb, var(--color-text) 42%, transparent); }
.bw-dialog__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--color-border); }
.bw-dialog__body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-4); overflow-y: auto; min-height: 0; }
.bw-dialog__foot { display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: var(--space-4) var(--space-5); border-top: 1px solid var(--color-border); background: var(--color-surface-raised); flex-wrap: wrap; }
.bw-close { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 6px; border: 0; background: transparent; color: var(--color-text-muted); cursor: pointer; font-size: 16px; flex: none; }
.bw-close:hover { background: var(--color-surface-muted); color: var(--color-text); }
.bw-close--inline { width: 22px; height: 22px; font-size: 13px; color: inherit; }
.bw-close:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }

.bw-steps { display: flex; gap: 6px; flex-wrap: wrap; }
.bw-step { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: var(--radius-pill); border: 1px solid var(--color-border); background: var(--color-surface); font-size: 12px; font-weight: 600; color: var(--color-text-muted); }
.bw-step[data-state="active"] { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-soft); }
.bw-step[data-state="done"] { border-color: color-mix(in srgb, var(--color-success) 35%, transparent); color: var(--color-success); background: var(--color-success-soft); }

.bw-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.bw-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.bw-field--wide { grid-column: 1 / -1; }
.bw-label { font-size: 12.5px; font-weight: 600; color: var(--color-text-secondary); }
.bw-input { width: 100%; box-sizing: border-box; padding: 9px 11px; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); font: inherit; font-size: 13px; color: var(--color-text); min-width: 0; }
.bw-input:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; border-color: var(--color-primary); }
.bw-input[aria-invalid="true"] { border-color: var(--color-danger); background: var(--color-danger-soft); }
.bw-hint { font-size: 11.5px; color: var(--color-text-muted); }
.bw-error { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; color: var(--color-danger); }
.bw-alert { display: flex; gap: 9px; align-items: flex-start; padding: 10px 12px; border-radius: var(--radius-control); background: var(--color-info-soft); color: var(--color-info); font-size: 12.5px; line-height: 1.5; }
.bw-alert--warn { background: var(--color-warning-soft); color: var(--color-warning); }
.bw-alert--danger { background: var(--color-danger-soft); color: var(--color-danger); }
.bw-alert--success { background: var(--color-success-soft); color: var(--color-success); }

.bw-paxrow { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.8fr) minmax(0, 1fr) auto; gap: var(--space-3); align-items: end; padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface-raised); }
.bw-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
.bw-summary__cell { padding: 10px 12px; border-radius: var(--radius-control); background: var(--color-surface-muted); font-size: 12.5px; min-width: 0; }
.bw-summary__cell span { display: block; color: var(--color-text-muted); font-size: 11.5px; }
.bw-summary__cell strong { display: block; margin-top: 3px; font-size: 14px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.bw-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

@media (max-width: 1279px) {
  .bw-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bw-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 767px) {
  .bw-kpis { grid-template-columns: minmax(0, 1fr); }
  .bw-row { grid-template-columns: minmax(0, 1fr); }
  .bw-row__side { flex-direction: row; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 6px; }
  .bw-row__meta { white-space: normal; overflow-wrap: anywhere; }
  .bw-row__name { white-space: normal; overflow-wrap: anywhere; }
  .bw-tab { padding: 6px 9px; font-size: 12px; }
  .bw-tabs { flex-wrap: wrap; }
  .bw-toolbar { padding: var(--space-3) var(--space-4); }
  .bw-search { max-width: none; flex: 1 1 100%; }
  .bw-row { padding: 12px var(--space-4); }
  .bw-fields { grid-template-columns: minmax(0, 1fr); }
  .bw-paxrow { grid-template-columns: minmax(0, 1fr); }
  .bw-summary { grid-template-columns: minmax(0, 1fr); }
  .bw-kv { grid-template-columns: minmax(0, 1fr); gap: 2px 0; }
  .bw-kv dd { margin-bottom: 6px; }
  .bw-body { padding: var(--space-4); }
  .bw-card__head { padding: 12px var(--space-4); }
  .bw-dialog__body { padding: var(--space-4); }
  .bw-dialog__foot { padding: var(--space-3) var(--space-4); }
}
@media (prefers-reduced-motion: reduce) {
  .bw-btn { transition: none; }
}
`;

// ------------------------------------------------------------------ types

type Tone = "success" | "warning" | "info" | "danger" | "neutral";
type PaxType = "dewasa" | "anak" | "bayi";
type SortKey = "terbaru" | "terbesar" | "sisa";

interface BwPax {
  id: string;
  nama: string;
  tipe: PaxType;
}
interface BwHistory {
  id: string;
  teks: string;
  ket: string;
  tone: string;
}
interface BwCustomer {
  id: string;
  nama: string;
  email: string;
  wa: string;
}
interface BwPackage {
  id: string;
  nama: string;
  harga: Record<PaxType, number>;
}
interface BwDeparture {
  id: string;
  paket: string;
  label: string;
  sisa: number;
  kapasitas: number;
}
interface BwBooking {
  ref: string;
  pelanggan: string;
  paket: string;
  keberangkatan: string;
  tipe: "individu" | "grup";
  status: BookingStatus;
  dibuat: string;
  diskon: number;
  dibayar: number;
  penumpang: BwPax[];
  riwayat: BwHistory[];
}
interface Bilingual {
  ms: string;
  en: string;
}
type ErrorKey = "pelanggan" | "keberangkatan" | "penumpang" | "kursi" | "diskon" | "alasan";
interface Toast {
  tone: "success" | "danger" | "warning";
  ms: string;
  en: string;
}

// --------------------------------------------- static prototype seed data

const PAKET: BwPackage[] = [
  { id: "jp-sakura", nama: "Langkawi Island Escape 4D3N", harga: { dewasa: 3890, anak: 2990, bayi: 690 } },
  { id: "tr-istanbul", nama: "Perhentian Dive Retreat 5D4N", harga: { dewasa: 3450, anak: 2690, bayi: 590 } },
  { id: "kr-autumn", nama: "Penang Heritage & Food 3D2N", harga: { dewasa: 1890, anak: 1390, bayi: 390 } },
  { id: "bali-prem", nama: "Borneo Wildlife Discovery 6D5N", harga: { dewasa: 5280, anak: 3990, bayi: 790 } },
];

const KEBERANGKATAN: BwDeparture[] = [
  { id: "DP-4471", paket: "jp-sakura", label: "12–15 Dec 2025", sisa: 4, kapasitas: 32 },
  { id: "DP-4473", paket: "jp-sakura", label: "9–12 Jan 2026", sisa: 18, kapasitas: 32 },
  { id: "DP-4482", paket: "tr-istanbul", label: "18–22 Dec 2025", sisa: 9, kapasitas: 40 },
  { id: "DP-4485", paket: "tr-istanbul", label: "22–26 Jan 2026", sisa: 26, kapasitas: 40 },
  { id: "DP-4490", paket: "kr-autumn", label: "23–25 Dec 2025", sisa: 2, kapasitas: 28 },
  { id: "DP-4501", paket: "bali-prem", label: "28 Dec 2025–2 Jan 2026", sisa: 14, kapasitas: 24 },
];

const PELANGGAN: BwCustomer[] = [
  { id: "c1", nama: "Hendra Wijaya", email: "hendra.w@mail.com", wa: "+60 12-330 1141" },
  { id: "c2", nama: "Siti Nurhaliza", email: "siti.nur@mail.com", wa: "+60 13-224 8890" },
  { id: "c3", nama: "Gunawan Family", email: "gunawan.fam@mail.com", wa: "+60 11-907 2200" },
  { id: "c4", nama: "Andi Pratama", email: "andi.pratama@mail.com", wa: "+60 18-112 3344" },
  { id: "c5", nama: "Rani & Dimas", email: "rani.dimas@mail.com", wa: "+60 12-661 0099" },
  { id: "c6", nama: "Bambang Sutrisno", email: "b.sutrisno@mail.com", wa: "+60 16-445 7712" },
];

const STATUS: Record<BookingStatus, { label: Bilingual; tone: Tone }> = {
  draft: { label: { ms: "Draf", en: "Draft" }, tone: "neutral" },
  hold: { label: { ms: "Kerusi ditahan", en: "Seats held" }, tone: "warning" },
  pending_deposit: { label: { ms: "Deposit tertunggak", en: "Pending deposit" }, tone: "info" },
  confirmed: { label: { ms: "Disahkan", en: "Confirmed" }, tone: "success" },
  cancelled: { label: { ms: "Dibatalkan", en: "Cancelled" }, tone: "danger" },
  completed: { label: { ms: "Selesai", en: "Completed" }, tone: "neutral" },
};

const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  warning: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  info: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
  danger: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  neutral: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
};

const TAHAP: { id: string; label: Bilingual; statuses: BookingStatus[] }[] = [
  { id: "aktif", label: { ms: "Aktif", en: "Active" }, statuses: ["draft", "hold", "pending_deposit", "confirmed"] },
  { id: "draft", label: { ms: "Draf", en: "Draft" }, statuses: ["draft"] },
  { id: "selesai", label: { ms: "Selesai", en: "Completed" }, statuses: ["completed"] },
  { id: "batal", label: { ms: "Dibatalkan", en: "Cancelled" }, statuses: ["cancelled"] },
];

const TIPE_PENUMPANG: { id: PaxType; label: Bilingual }[] = [
  { id: "dewasa", label: { ms: "Dewasa", en: "Adult" } },
  { id: "anak", label: { ms: "Kanak-kanak", en: "Child" } },
  { id: "bayi", label: { ms: "Bayi", en: "Infant" } },
];

const AWAL_BOOKING: BwBooking[] = [
  {
    ref: "TRV-2025-0481", pelanggan: "c1", paket: "jp-sakura", keberangkatan: "DP-4471", tipe: "individu",
    status: "confirmed", dibuat: "16 Nov 2025", diskon: 0, dibayar: 15560,
    penumpang: [
      { id: "p1", nama: "Hendra Wijaya", tipe: "dewasa" },
      { id: "p2", nama: "Lina Wijaya", tipe: "dewasa" },
      { id: "p3", nama: "Raka Wijaya", tipe: "anak" },
      { id: "p4", nama: "Nadia Wijaya", tipe: "anak" },
    ],
    riwayat: [
      { id: "r1", teks: "Booking created from the website", ket: "16 Nov 2025 · Sales: Ayu Rahma", tone: "var(--color-primary)" },
      { id: "r2", teks: "Deposit of RM 4,670 verified by finance", ket: "18 Nov 2025", tone: "var(--color-success)" },
      { id: "r3", teks: "Final payment received, booking confirmed", ket: "2 Dec 2025", tone: "var(--color-success)" },
    ],
  },
  {
    ref: "TRV-2025-0480", pelanggan: "c2", paket: "tr-istanbul", keberangkatan: "DP-4482", tipe: "individu",
    status: "pending_deposit", dibuat: "15 Nov 2025", diskon: 0, dibayar: 2070,
    penumpang: [
      { id: "p1", nama: "Siti Nurhaliza", tipe: "dewasa" },
      { id: "p2", nama: "Fajar Hidayat", tipe: "dewasa" },
    ],
    riwayat: [
      { id: "r1", teks: "Booking created · seats held for 24 hours", ket: "15 Nov 2025 · Sales: Bayu Saputra", tone: "var(--color-primary)" },
      { id: "r2", teks: "Deposit of RM 2,070 recorded, awaiting verification", ket: "17 Nov 2025", tone: "var(--color-warning)" },
    ],
  },
  {
    ref: "TRV-2025-0479", pelanggan: "c3", paket: "kr-autumn", keberangkatan: "DP-4490", tipe: "grup",
    status: "hold", dibuat: "15 Nov 2025", diskon: 450, dibayar: 0,
    penumpang: [
      { id: "p1", nama: "Gunawan", tipe: "dewasa" },
      { id: "p2", nama: "Ratna Gunawan", tipe: "dewasa" },
      { id: "p3", nama: "Bima Gunawan", tipe: "dewasa" },
      { id: "p4", nama: "Citra Gunawan", tipe: "anak" },
      { id: "p5", nama: "Dewi Gunawan", tipe: "anak" },
      { id: "p6", nama: "Kirana Gunawan", tipe: "bayi" },
    ],
    riwayat: [
      { id: "r1", teks: "Group booking created", ket: "15 Nov 2025 · Sales: Ayu Rahma", tone: "var(--color-primary)" },
      { id: "r2", teks: "6 seats held until 18 Nov, 20:00", ket: "15 Nov 2025", tone: "var(--color-warning)" },
    ],
  },
  {
    ref: "TRV-2025-0478", pelanggan: "c4", paket: "bali-prem", keberangkatan: "DP-4501", tipe: "individu",
    status: "confirmed", dibuat: "14 Nov 2025", diskon: 0, dibayar: 5280,
    penumpang: [{ id: "p1", nama: "Andi Pratama", tipe: "dewasa" }],
    riwayat: [
      { id: "r1", teks: "Booking created from the website", ket: "14 Nov 2025 · Sales: Bayu Saputra", tone: "var(--color-primary)" },
      { id: "r2", teks: "Full payment received", ket: "14 Nov 2025", tone: "var(--color-success)" },
    ],
  },
  {
    ref: "TRV-2025-0475", pelanggan: "c6", paket: "tr-istanbul", keberangkatan: "DP-4482", tipe: "grup",
    status: "draft", dibuat: "12 Nov 2025", diskon: 300, dibayar: 0,
    penumpang: [
      { id: "p1", nama: "Bambang Sutrisno", tipe: "dewasa" },
      { id: "p2", nama: "Sri Sutrisno", tipe: "dewasa" },
      { id: "p3", nama: "Yoga Sutrisno", tipe: "anak" },
    ],
    riwayat: [{ id: "r1", teks: "Draft created over the phone", ket: "12 Nov 2025 · Sales: Ayu Rahma", tone: "var(--color-primary)" }],
  },
  {
    ref: "TRV-2025-0469", pelanggan: "c5", paket: "bali-prem", keberangkatan: "DP-4501", tipe: "individu",
    status: "completed", dibuat: "10 Nov 2025", diskon: 0, dibayar: 18540,
    penumpang: [
      { id: "p1", nama: "Dimas Saputra", tipe: "dewasa" },
      { id: "p2", nama: "Rani Saputra", tipe: "dewasa" },
      { id: "p3", nama: "Alif Saputra", tipe: "anak" },
      { id: "p4", nama: "Sari Saputra", tipe: "anak" },
    ],
    riwayat: [
      { id: "r1", teks: "Booking created", ket: "10 Nov 2025", tone: "var(--color-primary)" },
      { id: "r2", teks: "Trip completed, booking closed", ket: "9 Dec 2025", tone: "var(--color-success)" },
    ],
  },
];

const PESAN: Record<ErrorKey, Bilingual> = {
  pelanggan: { ms: "Pilih pelanggan yang membuat tempahan ini.", en: "Select the customer making this booking." },
  keberangkatan: { ms: "Pilih tarikh keberangkatan yang masih ada kerusi.", en: "Select a departure that still has seats." },
  penumpang: { ms: "Masukkan nama untuk setiap penumpang.", en: "Enter a name for every passenger." },
  kursi: { ms: "Penumpang melebihi kerusi yang tersedia pada keberangkatan ini.", en: "Passengers exceed the seats available on this departure." },
  diskon: { ms: "Diskaun tidak boleh melebihi subtotal atau negatif.", en: "Discount cannot exceed the subtotal or be negative." },
  alasan: { ms: "Tambah sebab pembatalan supaya direkodkan dalam sejarah.", en: "Add a cancellation reason so it is recorded in the history." },
};

// ------------------------------------------------------------------ helpers

function rupiah(nilai: number): string {
  return `RM ${Math.round(nilai).toLocaleString("en-MY")}`;
}
function singkat(nilai: number): string {
  if (nilai >= 1000000) {
    return `RM ${(nilai / 1000000).toLocaleString("en-MY", { maximumFractionDigits: 1 })}m`;
  }
  return `RM ${Math.round(nilai).toLocaleString("en-MY")}`;
}
function ambilPaket(id: string, senarai: BwPackage[]): BwPackage {
  return senarai.find((item) => item.id === id) ?? senarai[0];
}
function ambilPelanggan(id: string, senarai: BwCustomer[]): BwCustomer {
  return senarai.find((item) => item.id === id) ?? senarai[0];
}
function ambilKeberangkatan(id: string, senarai: BwDeparture[]): BwDeparture {
  return senarai.find((item) => item.id === id) ?? senarai[0];
}
function hitung(booking: BwBooking, senaraiPaket: BwPackage[]) {
  const harga = ambilPaket(booking.paket, senaraiPaket).harga;
  const subtotal = booking.penumpang.reduce((jumlah, orang) => jumlah + (harga[orang.tipe] || 0), 0);
  const total = Math.max(subtotal - booking.diskon, 0);
  return { subtotal, total, sisa: Math.max(total - booking.dibayar, 0) };
}

interface Kalkulasi {
  subtotal: number;
  total: number;
  sisa: number;
}

// ------------------------------------------------------------------ widgets

function Badge({ status }: { status: BookingStatus }) {
  const { t } = useLang();
  const meta = STATUS[status];
  const palette = TONE[meta.tone];
  return (
    <span className="bw-badge" style={{ background: palette.bg, color: palette.fg }}>
      {t(meta.label.ms, meta.label.en)}
    </span>
  );
}

function Ikon({ icon, size = 15, style }: { icon: LucideIcon; size?: number; style?: React.CSSProperties }) {
  const Icon = icon;
  return <Icon aria-hidden="true" style={{ fontSize: `${size}px`, width: size, height: size, flex: "none", ...style }} />;
}

function Kpi({
  id, label, nilai, catatan, ikon, bg, fg,
}: {
  id: string;
  label: string;
  nilai: string;
  catatan: string;
  ikon: LucideIcon;
  bg: string;
  fg: string;
}) {
  return (
    <article data-node-id={`bw.kpi.${id}`} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-panel)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <span style={{ fontSize: "12.5px", fontWeight: 500, color: "var(--color-text-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ display: "grid", placeItems: "center", width: "30px", height: "30px", flex: "none", borderRadius: "9px", background: bg, color: fg }}>
          <Ikon icon={ikon} />
        </span>
      </div>
      <strong style={{ fontSize: "23px", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{nilai}</strong>
      <span style={{ fontSize: "11.5px", color: "var(--color-text-muted)" }}>{catatan}</span>
    </article>
  );
}

function Medan({
  id, label, wide = false, hint, error, children,
}: {
  id: string;
  label: string;
  wide?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "bw-field bw-field--wide" : "bw-field"}>
      <label className="bw-label" htmlFor={id}>{label}</label>
      {children}
      {hint && !error ? <span className="bw-hint">{hint}</span> : null}
      {error ? (
        <span className="bw-error" id={`${id}-error`}>
          <Ikon icon={CircleAlert} size={13} style={{ marginTop: "1px" }} />
          {error}
        </span>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ page

export default function BookingWorkspace() {
  const { t } = useLang();

  const [bookings, setBookings] = useState<BwBooking[]>(AWAL_BOOKING);
  const [paketList, setPaketList] = useState<BwPackage[]>(PAKET);
  const [keberangkatanList, setKeberangkatanList] = useState<BwDeparture[]>(KEBERANGKATAN);
  const [pelangganList, setPelangganList] = useState<BwCustomer[]>(PELANGGAN);

  const [tahap, setTahap] = useState("aktif");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dipilih, setDipilih] = useState("TRV-2025-0481");
  const [urutkan, setUrutkan] = useState<SortKey>("terbaru");
  const [pesan, setPesan] = useState<Toast | null>(null);

  const dialogBuatan = useRef<HTMLDialogElement>(null);
  const dialogBatal = useRef<HTMLDialogElement>(null);
  const [langkah, setLangkah] = useState(1);
  const [galat, setGalat] = useState<Partial<Record<ErrorKey, string>>>({});
  const [form, setForm] = useState({
    pelanggan: "",
    paket: "jp-sakura",
    keberangkatan: "DP-4471",
    tipe: "individu" as "individu" | "grup",
    diskon: "",
    dp: "",
  });
  const [draftPenumpang, setDraftPenumpang] = useState<BwPax[]>([{ id: "n1", nama: "", tipe: "dewasa" }]);
  const [alasanBatal, setAlasanBatal] = useState("");
  const [galatBatal, setGalatBatal] = useState("");
  const [cariPelanggan, setCariPelanggan] = useState("");

  // Live data — same dynamic-import pattern as DashboardOverview.
  // Fields missing from D1 (passenger names, booking history) keep the
  // static prototype seed data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchBookings, fetchPackages, fetchDepartures } = await import("@/lib/live-data");
        const [bk, pk, dp] = await Promise.all([fetchBookings(), fetchPackages(), fetchDepartures()]);
        if (cancelled) return;

        if (pk.live && pk.packages.length > 0) {
          setPaketList(
            pk.packages.map((p) => ({
              id: p.id,
              nama: p.name,
              harga: { dewasa: p.adultPrice, anak: p.childPrice, bayi: p.infantPrice } as Record<PaxType, number>,
            })),
          );
        }
        if (dp.live && dp.departures.length > 0) {
          setKeberangkatanList(
            dp.departures.map((d) => ({
              id: d.id,
              paket: d.packageId,
              label: `${d.departureDate}${d.returnDate ? `–${d.returnDate}` : ""}`,
              sisa: Math.max(d.seatCapacity - d.seatsBooked - d.seatsHeld, 0),
              kapasitas: d.seatCapacity,
            })),
          );
        }

        if (bk.live && bk.bookings.length > 0) {
          const livePaket = pk.packages;
          const liveCustomers = bk.bookings.map((b, i) => ({
            id: `live-c${i + 1}`,
            nama: b.customerName,
            email: "",
            wa: b.customerPhone,
          }));
          const paxSynth = (n: number, tipe: PaxType, start: number): BwPax[] =>
            Array.from({ length: n }, (_, i) => ({ id: `p${start + i}`, nama: tipe === "dewasa" ? "Adult" : tipe === "anak" ? "Child" : "Infant", tipe }));
          const mapped: BwBooking[] = bk.bookings.map((b, i) => {
            const paketMatch =
              livePaket.find((p) => p.name === b.packageName) ??
              livePaket.find((p) => b.packageName.toLowerCase().includes(p.id)) ??
              livePaket[0];
            const depMatch =
              dp.departures.find((d) => d.departureDate === b.departureDate) ?? dp.departures[0];
            return {
              ref: b.reference || b.id || `LIVE-${i + 1}`,
              pelanggan: `live-c${i + 1}`,
              paket: paketMatch?.id ?? PAKET[0].id,
              keberangkatan: depMatch?.id ?? KEBERANGKATAN[0].id,
              tipe: b.type === "group" ? "grup" : "individu",
              status: b.status,
              dibuat: b.createdAt ? b.createdAt.slice(0, 10) : "",
              diskon: b.discount,
              dibayar: Math.min(b.paidAmount, b.totalAmount),
              penumpang: [
                ...paxSynth(b.paxAdult, "dewasa", 1),
                ...paxSynth(b.paxChild, "anak", b.paxAdult + 1),
                ...paxSynth(b.paxInfant, "bayi", b.paxAdult + b.paxChild + 1),
              ],
              riwayat: [
                {
                  id: "r1",
                  teks: `Booking loaded from database · ${b.packageName}`,
                  ket: b.createdBy ? `${b.createdAt?.slice(0, 10) ?? ""} · ${b.createdBy}` : b.createdAt?.slice(0, 10) ?? "",
                  tone: "var(--color-primary)",
                },
              ],
            };
          });
          if (!cancelled && mapped.length > 0) {
            setPelangganList(liveCustomers);
            setBookings(mapped);
            setDipilih(mapped[0].ref);
          }
        }
      } catch {
        /* live data unavailable — static prototype data remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const daftarTahap = TAHAP.find((item) => item.id === tahap) ?? TAHAP[0];

  const terlihat = useMemo(() => {
    const jarum = query.trim().toLowerCase();
    return bookings
      .filter((item) => daftarTahap.statuses.includes(item.status))
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => {
        if (!jarum) return true;
        const orang = ambilPelanggan(item.pelanggan, pelangganList);
        const paket = ambilPaket(item.paket, paketList);
        return (
          item.ref.toLowerCase().includes(jarum) ||
          orang.nama.toLowerCase().includes(jarum) ||
          paket.nama.toLowerCase().includes(jarum) ||
          orang.email.toLowerCase().includes(jarum)
        );
      })
      .slice()
      .sort((a: BwBooking, b: BwBooking) => {
        if (urutkan === "terbesar") return hitung(b, paketList).total - hitung(a, paketList).total;
        if (urutkan === "sisa") return hitung(b, paketList).sisa - hitung(a, paketList).sisa;
        return 0;
      });
  }, [bookings, daftarTahap, statusFilter, query, urutkan, pelangganList, paketList]);

  const jumlahTahap = useMemo(() => {
    const hasil: Record<string, number> = {};
    TAHAP.forEach((item) => {
      hasil[item.id] = bookings.filter((b) => item.statuses.includes(b.status)).length;
    });
    return hasil;
  }, [bookings]);

  const aktif = bookings.find((item) => item.ref === dipilih) ?? terlihat[0] ?? bookings[0];
  const aktifHitung = hitung(aktif, paketList) as Kalkulasi;
  const aktifPelanggan = ambilPelanggan(aktif.pelanggan, pelangganList);
  const aktifKeberangkatan = ambilKeberangkatan(aktif.keberangkatan, keberangkatanList);

  const ringkasan = useMemo(() => {
    const aktifList = bookings.filter((item) => item.status !== "cancelled" && item.status !== "completed");
    const nilai = aktifList.reduce((n, item) => n + hitung(item, paketList).total, 0);
    const masuk = bookings.reduce((n, item) => n + Math.min(item.dibayar, hitung(item, paketList).total), 0);
    const sisa = bookings.reduce((n, item) => n + hitung(item, paketList).sisa, 0);
    return { jumlah: aktifList.length, nilai, masuk, sisa };
  }, [bookings, paketList]);

  const opsiStatus = useMemo(() => {
    if (tahap !== "aktif") return [{ id: "all", label: t("Semua status", "All statuses") }];
    return [
      { id: "all", label: t("Semua status aktif", "All active statuses") },
      { id: "draft", label: t("Draf", "Draft") },
      { id: "hold", label: t("Kerusi ditahan", "Seats held") },
      { id: "pending_deposit", label: t("Deposit tertunggak", "Pending deposit") },
      { id: "confirmed", label: t("Disahkan", "Confirmed") },
    ];
  }, [tahap, t]);

  const opsiKeberangkatan = keberangkatanList.filter((item) => item.paket === form.paket);
  const keberangkatanForm = ambilKeberangkatan(form.keberangkatan, keberangkatanList);
  const slotTersisa = keberangkatanForm.sisa;

  const hitungDraft = useMemo(() => {
    const harga = ambilPaket(form.paket, paketList).harga;
    const subtotal = draftPenumpang.reduce((n, orang) => n + (harga[orang.tipe] || 0), 0);
    const diskon = Number(form.diskon) || 0;
    const total = Math.max(subtotal - diskon, 0);
    return { subtotal, diskon, total };
  }, [form.paket, form.diskon, draftPenumpang, paketList]);

  const opsiPelanggan = pelangganList.filter((item) =>
    item.nama.toLowerCase().includes(cariPelanggan.trim().toLowerCase()),
  );

  const bukaDialog = () => {
    setLangkah(1);
    setGalat({});
    setCariPelanggan("");
    setForm({ pelanggan: "", paket: paketList[0]?.id ?? "jp-sakura", keberangkatan: keberangkatanList[0]?.id ?? "DP-4471", tipe: "individu", diskon: "", dp: "" });
    setDraftPenumpang([{ id: `n${Date.now()}`, nama: "", tipe: "dewasa" }]);
    dialogBuatan.current?.showModal();
  };

  const tutupDialog = () => {
    dialogBuatan.current?.close();
  };

  const ubahPaket = (idPaket: string) => {
    const tujuan = keberangkatanList.find((item) => item.paket === idPaket);
    setForm((prev) => ({ ...prev, paket: idPaket, keberangkatan: tujuan ? tujuan.id : "" }));
  };

  const ubahPenumpang = (id: string, patch: Partial<BwPax>) => {
    setDraftPenumpang((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const periksaLangkah = (urutan: number) => {
    const baru: Partial<Record<ErrorKey, string>> = {};
    if (urutan >= 1) {
      if (!form.pelanggan) baru.pelanggan = "pelanggan";
      if (!form.keberangkatan) baru.keberangkatan = "keberangkatan";
    }
    if (urutan >= 2) {
      if (draftPenumpang.some((orang) => !orang.nama.trim())) baru.penumpang = "penumpang";
      if (draftPenumpang.length > slotTersisa) baru.kursi = "kursi";
    }
    if (urutan >= 3) {
      if (Number(form.diskon) < 0 || Number(form.diskon) > hitungDraft.subtotal) baru.diskon = "diskon";
    }
    return baru;
  };

  const lanjut = () => {
    const hasil = periksaLangkah(langkah);
    if (Object.keys(hasil).length) {
      setGalat(hasil);
      return;
    }
    setGalat({});
    setLangkah((step) => Math.min(step + 1, 3));
  };

  const kembali = () => {
    setGalat({});
    setLangkah((step) => Math.max(step - 1, 1));
  };

  const simpan = (target: "draft" | "hold") => {
    const hasil = periksaLangkah(3);
    if (Object.keys(hasil).length) {
      setGalat(hasil);
      setLangkah(hasil.pelanggan || hasil.keberangkatan ? 1 : hasil.penumpang || hasil.kursi ? 2 : 3);
      return;
    }
    const nomor =
      bookings.reduce((tertinggi, item) => {
        const angka = Number(item.ref.split("-").pop());
        return Number.isFinite(angka) ? Math.max(tertinggi, angka) : tertinggi;
      }, 0) + 1;
    const ref = `TRV-2025-${String(nomor).padStart(4, "0")}`;
    const status: BookingStatus = target === "hold" ? "hold" : "draft";
    const baru: BwBooking = {
      ref,
      pelanggan: form.pelanggan,
      paket: form.paket,
      keberangkatan: form.keberangkatan,
      tipe: form.tipe,
      status,
      dibuat: t("Hari ini", "Today"),
      diskon: hitungDraft.diskon,
      dibayar: target === "hold" ? Math.min(Number(form.dp) || 0, hitungDraft.total) : 0,
      penumpang: draftPenumpang.map((orang, index) => ({ id: `p${index + 1}`, nama: orang.nama.trim(), tipe: orang.tipe })),
      riwayat: [
        {
          id: "r1",
          teks: target === "hold" ? `Booking created · ${draftPenumpang.length} seats held for 24 hours` : "Booking saved as a draft",
          ket: `${t("Hari ini", "Today")} · Sales: Ayu Rahma`,
          tone: target === "hold" ? "var(--color-warning)" : "var(--color-primary)",
        },
      ],
    };
    setBookings((prev) => [baru, ...prev]);
    setDipilih(ref);
    setTahap("aktif");
    setStatusFilter("all");
    setPesan({
      tone: "success",
      ms: `Tempahan ${ref} disimpan sebagai ${STATUS[status].label.ms.toLowerCase()}.`,
      en: `Booking ${ref} saved as ${STATUS[status].label.en.toLowerCase()}.`,
    });
    tutupDialog();
  };

  const ubahStatus = (target: BookingStatus, extra = "") => {
    setBookings((prev) =>
      prev.map((item) => {
        if (item.ref !== aktif.ref) return item;
        const riwayat: BwHistory[] = [
          ...item.riwayat,
          {
            id: `r${item.riwayat.length + 1}`,
            teks: extra || `Status changed to ${STATUS[target].label.en}`,
            ket: `${t("Hari ini", "Today")} · Ayu Rahma`,
            tone:
              target === "cancelled"
                ? "var(--color-danger)"
                : target === "confirmed"
                  ? "var(--color-success)"
                  : "var(--color-warning)",
          },
        ];
        return { ...item, status: target, riwayat };
      }),
    );
    setPesan({
      tone: target === "cancelled" ? "danger" : "success",
      ms: `Tempahan ${aktif.ref} kini ${STATUS[target].label.ms.toLowerCase()}.`,
      en: `Booking ${aktif.ref} is now ${STATUS[target].label.en.toLowerCase()}.`,
    });
  };

  const bukaBatal = () => {
    setAlasanBatal("");
    setGalatBatal("");
    dialogBatal.current?.showModal();
  };

  const konfirmasiBatal = (event: React.FormEvent) => {
    event.preventDefault();
    if (!alasanBatal.trim()) {
      setGalatBatal(t(PESAN.alasan.ms, PESAN.alasan.en));
      return;
    }
    ubahStatus("cancelled", `Booking cancelled — ${alasanBatal.trim()}`);
    dialogBatal.current?.close();
  };

  const tambahPenumpang = () => {
    setDraftPenumpang((prev) => [...prev, { id: `n${Date.now()}-${prev.length}`, nama: "", tipe: "dewasa" }]);
  };

  const hapusPenumpang = (id: string) => {
    setDraftPenumpang((prev) => (prev.length === 1 ? prev : prev.filter((item) => item.id !== id)));
  };

  const tukarTahap = (id: string) => {
    setTahap(id);
    setStatusFilter("all");
  };

  const langkahMeta = [
    { n: 1, t: { ms: "Maklumat tempahan", en: "Booking details" } },
    { n: 2, t: { ms: "Penumpang", en: "Passengers" } },
    { n: 3, t: { ms: "Harga & diskaun", en: "Price & discounts" } },
  ];

  return (
    <main
      data-node-id="bw.root"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-5) var(--space-6) var(--space-8)", minWidth: 0, color: "var(--color-text)" }}
    >
      <style>{css}</style>

      {/* Page head */}
      <div className="tvl-pagehead" data-node-id="bw.header">
        <div style={{ minWidth: 0 }}>
          <h1 className="tvl-title" data-node-id="bw.title">{t("Ruang Kerja Tempahan", "Booking Workspace")}</h1>
          <p className="tvl-subtitle">{t("Cipta, jejak dan siapkan tempahan pelanggan di satu tempat", "Create, track, and complete customer bookings in one place")}</p>
        </div>
        <div className="bw-actions">
          <a className="bw-btn" href="/bookings" data-action="bw:go-bookings">
            <Ikon icon={Table2} />
            {t("Semua tempahan", "All bookings")}
          </a>
          <button type="button" className="bw-btn bw-btn--primary" data-action="bw:create" onClick={bukaDialog}>
            <Ikon icon={Plus} />
            {t("Cipta tempahan", "Create booking")}
          </button>
        </div>
      </div>

      {pesan ? (
        <div className={`bw-alert bw-alert--${pesan.tone}`} role="status" data-node-id="bw.toast">
          <Ikon icon={pesan.tone === "success" ? BadgeCheck : CircleAlert} />
          <span style={{ flex: 1, minWidth: 0 }}>{t(pesan.ms, pesan.en)}</span>
          <button type="button" className="bw-close bw-close--inline" data-action="bw:dismiss" aria-label={t("Tutup notifikasi", "Dismiss notification")} onClick={() => setPesan(null)}>
            <Ikon icon={X} size={13} />
          </button>
        </div>
      ) : null}

      {/* KPI cards */}
      <div className="bw-kpis" data-node-id="bw.kpis">
        <Kpi
          id="aktif"
          label={t("Tempahan aktif", "Active bookings")}
          nilai={String(ringkasan.jumlah)}
          catatan={t("Draf, ditahan dan disahkan", "Draft, held, and confirmed")}
          ikon={CalendarCheck2}
          bg="var(--color-primary-soft)"
          fg="var(--color-primary)"
        />
        <Kpi
          id="nilai"
          label={t("Nilai tempahan", "Booking value")}
          nilai={singkat(ringkasan.nilai)}
          catatan={t("Tidak termasuk tempahan dibatalkan", "Excludes cancelled bookings")}
          ikon={Wallet}
          bg="var(--color-info-soft)"
          fg="var(--color-info)"
        />
        <Kpi
          id="masuk"
          label={t("Bayaran diterima", "Payments collected")}
          nilai={singkat(ringkasan.masuk)}
          catatan={t("Deposit dan baki yang disahkan", "Verified deposits and balances")}
          ikon={Banknote}
          bg="var(--color-success-soft)"
          fg="var(--color-success)"
        />
        <Kpi
          id="sisa"
          label={t("Baki tertunggak", "Outstanding balance")}
          nilai={singkat(ringkasan.sisa)}
          catatan={t("Masih perlu dikutip daripada pelanggan", "Still to collect from customers")}
          ikon={ReceiptText}
          bg="var(--color-warning-soft)"
          fg="var(--color-warning)"
        />
      </div>

      {/* List + detail grid */}
      <div className="bw-grid">
        <section className="bw-card" data-node-id="bw.list" aria-labelledby="bw-list-title">
          <div className="bw-card__head">
            <div style={{ minWidth: 0 }}>
              <h2 className="bw-card__title" id="bw-list-title">{t("Tempahan", "Bookings")}</h2>
              <p className="bw-card__sub">{t("{n} daripada {total} tempahan", "{n} of {total} bookings").replace("{n}", String(terlihat.length)).replace("{total}", String(bookings.length))}</p>
            </div>
            <div className="bw-tabs" role="tablist" aria-label={t("Peringkat tempahan", "Booking stage")}>
              {TAHAP.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  id={`bw-tab-${item.id}`}
                  className="bw-tab"
                  aria-selected={tahap === item.id}
                  aria-controls="bw-list-panel"
                  tabIndex={tahap === item.id ? 0 : -1}
                  data-action={`bw:tab-${item.id}`}
                  onClick={() => tukarTahap(item.id)}
                  onKeyDown={(event) => {
                    const posisi = TAHAP.findIndex((x) => x.id === tahap);
                    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                      event.preventDefault();
                      const arah = event.key === "ArrowRight" ? 1 : -1;
                      const next = TAHAP[(posisi + arah + TAHAP.length) % TAHAP.length];
                      tukarTahap(next.id);
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      tukarTahap(TAHAP[0].id);
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      tukarTahap(TAHAP[TAHAP.length - 1].id);
                    }
                  }}
                >
                  {t(item.label.ms, item.label.en)}
                  <span className="bw-tab__count">{jumlahTahap[item.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bw-toolbar">
            <div className="bw-search">
              <Ikon icon={Search} />
              <label className="bw-sr" htmlFor="bw-query">{t("Cari tempahan", "Search bookings")}</label>
              <input id="bw-query" type="search" placeholder={t("Cari rujukan, nama atau pakej…", "Search reference, name, or package…")} value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <label className="bw-sr" htmlFor="bw-status">{t("Tapis mengikut status", "Filter by status")}</label>
            <select id="bw-status" className="bw-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {opsiStatus.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <label className="bw-sr" htmlFor="bw-sort">{t("Susun mengikut", "Sort by")}</label>
            <select id="bw-sort" className="bw-select" value={urutkan} onChange={(event) => setUrutkan(event.target.value as SortKey)} style={{ marginLeft: "auto" }}>
              <option value="terbaru">{t("Susunan asal", "Source order")}</option>
              <option value="terbesar">{t("Nilai tertinggi", "Highest value")}</option>
              <option value="sisa">{t("Baki terbesar", "Largest balance")}</option>
            </select>
          </div>

          <div id="bw-list-panel" role="tabpanel" aria-labelledby={`bw-tab-${tahap}`}>
            {terlihat.length === 0 ? (
              <div className="bw-empty" data-node-id="bw.empty">
                <Inbox />
                <p style={{ margin: 0 }}>{t("Tiada tempahan pada peringkat ini lagi.", "No bookings at this stage yet.")}</p>
                <button type="button" className="bw-btn" data-action="bw:reset" onClick={() => { setQuery(""); setStatusFilter("all"); tukarTahap("aktif") }}>
                  {t("Set semula penapis", "Reset filters")}
                </button>
              </div>
            ) : (
              <div className="bw-list">
                {terlihat.map((item) => {
                  const orang = ambilPelanggan(item.pelanggan, pelangganList);
                  const paket = ambilPaket(item.paket, paketList);
                  const uang = hitung(item, paketList);
                  return (
                    <button
                      key={item.ref}
                      type="button"
                      className="bw-row"
                      aria-current={aktif.ref === item.ref ? "true" : undefined}
                      data-action="bw:open"
                      data-node-id={`bw.row.${item.ref}`}
                      onClick={() => setDipilih(item.ref)}
                    >
                      <span className="bw-row__main">
                        <span className="bw-row__ref">{item.ref}</span>
                        <span className="bw-row__name">{orang.nama}</span>
                        <span className="bw-row__meta">{paket.nama} · {ambilKeberangkatan(item.keberangkatan, keberangkatanList).label} · {item.penumpang.length} pax</span>
                      </span>
                      <span className="bw-row__side">
                        <Badge status={item.status} />
                        <span className="bw-row__amount">{rupiah(uang.total)}</span>
                        <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{uang.sisa > 0 ? `${t("Baki", "Due")} ${rupiah(uang.sisa)}` : t("Selesai bayar", "Paid")}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="bw-card" data-node-id="bw.detail" aria-labelledby="bw-detail-title">
          <div className="bw-card__head">
            <div style={{ minWidth: 0 }}>
              <h2 className="bw-card__title" id="bw-detail-title">{aktif.ref}</h2>
              <p className="bw-card__sub">{aktifPelanggan.nama} · {t("dicipta", "created")} {aktif.dibuat}</p>
            </div>
            <Badge status={aktif.status} />
          </div>

          <div className="bw-body">
            <dl className="bw-kv">
              <dt>{t("Pakej", "Package")}</dt>
              <dd>{ambilPaket(aktif.paket, paketList).nama}</dd>
              <dt>{t("Keberangkatan", "Departure")}</dt>
              <dd>{aktifKeberangkatan.id} · {aktifKeberangkatan.label}</dd>
              <dt>{t("Jenis", "Type")}</dt>
              <dd>{aktif.tipe === "grup" ? t("Kumpulan", "Group") : t("Individu", "Individual")}</dd>
              <dt>{t("Hubungan", "Contact")}</dt>
              <dd>{aktifPelanggan.email}<br />{aktifPelanggan.wa}</dd>
            </dl>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", marginBottom: "6px", gap: "8px" }}>
                <span style={{ color: "var(--color-text-muted)" }}>{t("Dibayar", "Paid")}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  <strong>{rupiah(Math.min(aktif.dibayar, aktifHitung.total))}</strong> / {rupiah(aktifHitung.total)}
                </span>
              </div>
              <span className="bw-bar">
                <span
                  style={{
                    width: `${Math.min(100, Math.round((aktif.dibayar / Math.max(aktifHitung.total, 1)) * 100))}%`,
                    background: aktif.status === "cancelled" ? "var(--color-danger)" : "var(--color-success)",
                  }}
                />
              </span>
            </div>

            <div className="bw-money">
              <div><span style={{ color: "var(--color-text-muted)" }}>{t("Subjumlah", "Subtotal")}</span><strong>{rupiah(aktifHitung.subtotal)}</strong></div>
              <div><span style={{ color: "var(--color-text-muted)" }}>{t("Diskaun", "Discount")}</span><strong>{aktif.diskon > 0 ? `− ${rupiah(aktif.diskon)}` : "—"}</strong></div>
              <div style={{ paddingTop: "6px", borderTop: "1px solid var(--color-border)" }}><span style={{ fontWeight: 600 }}>{t("Jumlah", "Total")}</span><strong>{rupiah(aktifHitung.total)}</strong></div>
              <div>
                <span style={{ color: "var(--color-text-muted)" }}>{t("Tertunggak", "Outstanding")}</span>
                <strong style={{ color: aktifHitung.sisa > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                  {aktifHitung.sisa > 0 ? rupiah(aktifHitung.sisa) : t("Selesai bayar", "Paid")}
                </strong>
              </div>
            </div>

            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: "12.5px", fontWeight: 600 }}>
                {t("Penumpang", "Passengers")} <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>({aktif.penumpang.length})</span>
              </h3>
              {aktif.penumpang.map((orang) => {
                const tipeMeta = TIPE_PENUMPANG.find((tp) => tp.id === orang.tipe) ?? TIPE_PENUMPANG[0];
                return (
                  <div key={orang.id} className="bw-pax">
                    <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{orang.nama}</span>
                    <span style={{ color: "var(--color-text-muted)", flex: "none" }}>{t(tipeMeta.label.ms, tipeMeta.label.en)}</span>
                  </div>
                );
              })}
            </div>

            <div className="bw-actions">
              <button
                type="button"
                className="bw-btn bw-btn--primary"
                data-action="bw:confirm"
                disabled={aktif.status === "confirmed" || aktif.status === "cancelled" || aktif.status === "completed"}
                onClick={() => ubahStatus("confirmed", "Booking confirmed, seats become booked")}
              >
                <Ikon icon={BadgeCheck} />
                {t("Sahkan", "Confirm")}
              </button>
              <button
                type="button"
                className="bw-btn"
                data-action="bw:hold"
                disabled={aktif.status === "hold" || aktif.status === "cancelled" || aktif.status === "completed"}
                onClick={() => ubahStatus("hold", "Seats held for 24 hours, awaiting deposit")}
              >
                {t("Tahan kerusi", "Hold seats")}
              </button>
              <button
                type="button"
                className="bw-btn"
                data-action="bw:complete"
                disabled={aktif.status !== "confirmed"}
                onClick={() => ubahStatus("completed", "Trip completed, booking closed")}
              >
                {t("Selesaikan", "Complete")}
              </button>
              <button
                type="button"
                className="bw-btn bw-btn--danger"
                data-action="bw:cancel"
                disabled={aktif.status === "cancelled" || aktif.status === "completed"}
                onClick={bukaBatal}
              >
                {t("Batalkan tempahan", "Cancel booking")}
              </button>
            </div>

            <div>
              <h3 style={{ margin: "0 0 10px", fontSize: "12.5px", fontWeight: 600 }}>{t("Sejarah tempahan", "Booking history")}</h3>
              <ol className="bw-timeline">
                {aktif.riwayat.map((baris) => (
                  <li key={baris.id}>
                    <span className="bw-dot" style={{ background: baris.tone }} />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: "block", fontWeight: 600 }}>{baris.teks}</strong>
                      <span style={{ color: "var(--color-text-muted)" }}>{baris.ket}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </div>

      {/* Create booking dialog */}
      <dialog ref={dialogBuatan} className="bw-dialog" aria-labelledby="bw-create-title" data-node-id="bw.create" onClose={() => setGalat({})}>
        <div className="bw-dialog__head">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700, letterSpacing: "-0.01em" }} id="bw-create-title">
              {t("Cipta tempahan", "Create a booking")}
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--color-text-muted)" }}>
              {t("Pilih pelanggan dan keberangkatan, kemudian tambah penumpang.", "Choose the customer and departure, then add passengers.")}
            </p>
          </div>
          <button type="button" className="bw-close" aria-label={t("Tutup borang tempahan", "Close booking form")} data-action="bw:close-create" onClick={tutupDialog}>
            <Ikon icon={X} />
          </button>
        </div>

        <div className="bw-dialog__body">
          <div className="bw-steps" aria-label={t("Langkah tempahan", "Booking steps")}>
            {langkahMeta.map((item) => (
              <span key={item.n} className="bw-step" data-state={langkah === item.n ? "active" : langkah > item.n ? "done" : undefined}>
                <Ikon icon={langkah > item.n ? Check : Circle} size={12} />
                {item.n}. {t(item.t.ms, item.t.en)}
              </span>
            ))}
          </div>

          {langkah === 1 ? (
            <>
              <Medan id="bw-cari-pelanggan" label={t("Cari pelanggan", "Search customers")} hint={t("Biar kosong untuk senaraikan semua pelanggan.", "Leave empty to list every customer.")}>
                <input id="bw-cari-pelanggan" className="bw-input" type="search" value={cariPelanggan} onChange={(event) => setCariPelanggan(event.target.value)} placeholder={t("Nama atau emel", "Name or email")} />
              </Medan>
              <Medan id="bw-pelanggan" label={t("Pelanggan", "Customer")} wide error={galat.pelanggan ? t(PESAN[galat.pelanggan as ErrorKey].ms, PESAN[galat.pelanggan as ErrorKey].en) : undefined}>
                <select
                  id="bw-pelanggan"
                  className="bw-input"
                  value={form.pelanggan}
                  aria-invalid={galat.pelanggan ? "true" : undefined}
                  aria-describedby={galat.pelanggan ? "bw-pelanggan-error" : undefined}
                  onChange={(event) => setForm((prev) => ({ ...prev, pelanggan: event.target.value }))}
                >
                  <option value="">{t("Pilih pelanggan…", "Select a customer…")}</option>
                  {opsiPelanggan.map((item) => (
                    <option key={item.id} value={item.id}>{item.nama} · {item.email}</option>
                  ))}
                </select>
              </Medan>

              {form.pelanggan ? (
                <div className="bw-alert">
                  <Ikon icon={UserRound} />
                  <span>{ambilPelanggan(form.pelanggan, pelangganList).nama} · {ambilPelanggan(form.pelanggan, pelangganList).wa}</span>
                </div>
              ) : null}

              <div className="bw-fields">
                <Medan id="bw-paket" label={t("Pakej", "Package")}>
                  <select id="bw-paket" className="bw-input" value={form.paket} onChange={(event) => ubahPaket(event.target.value)}>
                    {paketList.map((item) => (
                      <option key={item.id} value={item.id}>{item.nama}</option>
                    ))}
                  </select>
                </Medan>
                <Medan id="bw-tipe" label={t("Jenis tempahan", "Booking type")}>
                  <select id="bw-tipe" className="bw-input" value={form.tipe} onChange={(event) => setForm((prev) => ({ ...prev, tipe: event.target.value as "individu" | "grup" }))}>
                    <option value="individu">{t("Individu", "Individual")}</option>
                    <option value="grup">{t("Kumpulan", "Group")}</option>
                  </select>
                </Medan>
                <Medan
                  id="bw-keberangkatan"
                  label={t("Keberangkatan", "Departure")}
                  wide
                  error={galat.keberangkatan ? t(PESAN.keberangkatan.ms, PESAN.keberangkatan.en) : undefined}
                  hint={t("{sisa} kerusi tersedia daripada {kapasiti}", "{sisa} seats available of {kapasiti}").replace("{sisa}", String(slotTersisa)).replace("{kapasiti}", String(keberangkatanForm.kapasitas))}
                >
                  <select
                    id="bw-keberangkatan"
                    className="bw-input"
                    value={form.keberangkatan}
                    aria-invalid={galat.keberangkatan ? "true" : undefined}
                    aria-describedby={galat.keberangkatan ? "bw-keberangkatan-error" : undefined}
                    onChange={(event) => setForm((prev) => ({ ...prev, keberangkatan: event.target.value }))}
                  >
                    <option value="">{t("Pilih keberangkatan…", "Select a departure…")}</option>
                    {opsiKeberangkatan.map((item) => (
                      <option key={item.id} value={item.id}>{item.id} · {item.label} · {item.sisa} {t("berbaki", "left")}</option>
                    ))}
                  </select>
                </Medan>
              </div>

              {slotTersisa <= 2 && form.keberangkatan ? (
                <div className="bw-alert bw-alert--warn">
                  <Ikon icon={TriangleAlert} />
                  <span>{t("Hanya {sisa} kerusi berbaki pada keberangkatan ini. Kira penumpang dengan teliti.", "Only {sisa} seats left on this departure. Count passengers carefully.").replace("{sisa}", String(slotTersisa))}</span>
                </div>
              ) : null}
            </>
          ) : null}

          {langkah === 2 ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: "12.5px", color: "var(--color-text-muted)" }}>
                  {t("{n} penumpang · {sisa} kerusi tersedia", "{n} passengers · {sisa} seats available").replace("{n}", String(draftPenumpang.length)).replace("{sisa}", String(slotTersisa))}
                </p>
                <button type="button" className="bw-btn" data-action="bw:add-pax" onClick={tambahPenumpang}>
                  <Ikon icon={UserPlus} />
                  {t("Tambah penumpang", "Add passenger")}
                </button>
              </div>

              {galat.kursi ? (
                <div className="bw-alert bw-alert--danger" role="alert"><Ikon icon={TriangleAlert} /><span>{t(PESAN.kursi.ms, PESAN.kursi.en)}</span></div>
              ) : null}
              {galat.penumpang ? (
                <div className="bw-alert bw-alert--danger" role="alert"><Ikon icon={CircleAlert} /><span>{t(PESAN.penumpang.ms, PESAN.penumpang.en)}</span></div>
              ) : null}

              {draftPenumpang.map((orang, index) => (
                <div key={orang.id} className="bw-paxrow">
                  <div className="bw-field">
                    <label className="bw-label" htmlFor={`bw-pax-nama-${orang.id}`}>{t("Penumpang", "Passenger")} {index + 1}</label>
                    <input
                      id={`bw-pax-nama-${orang.id}`}
                      className="bw-input"
                      type="text"
                      value={orang.nama}
                      placeholder={t("Nama seperti pada pasport", "Name as printed on passport")}
                      onChange={(event) => ubahPenumpang(orang.id, { nama: event.target.value })}
                    />
                  </div>
                  <div className="bw-field">
                    <label className="bw-label" htmlFor={`bw-pax-tipe-${orang.id}`}>{t("Jenis", "Type")}</label>
                    <select id={`bw-pax-tipe-${orang.id}`} className="bw-input" value={orang.tipe} onChange={(event) => ubahPenumpang(orang.id, { tipe: event.target.value as PaxType })}>
                      {TIPE_PENUMPANG.map((tipe) => (
                        <option key={tipe.id} value={tipe.id}>{t(tipe.label.ms, tipe.label.en)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bw-field">
                    <span className="bw-label">{t("Harga", "Price")}</span>
                    <span style={{ fontSize: "13px", fontVariantNumeric: "tabular-nums", padding: "9px 0", color: "var(--color-text-secondary)" }}>
                      {rupiah(ambilPaket(form.paket, paketList).harga[orang.tipe])}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="bw-btn"
                    data-action="bw:remove-pax"
                    aria-label={`${t("Buang penumpang", "Remove passenger")} ${index + 1}`}
                    disabled={draftPenumpang.length === 1}
                    onClick={() => hapusPenumpang(orang.id)}
                  >
                    <Ikon icon={Trash2} />
                  </button>
                </div>
              ))}
            </>
          ) : null}

          {langkah === 3 ? (
            <>
              <div className="bw-fields">
                <Medan id="bw-diskon" label={t("Diskaun (RM)", "Discount (RM)")} error={galat.diskon ? t(PESAN.diskon.ms, PESAN.diskon.en) : undefined} hint={t("Pilihan, sehingga jumlah subtotal.", "Optional, up to the subtotal.")}>
                  <input
                    id="bw-diskon"
                    className="bw-input"
                    type="number"
                    min="0"
                    step="10"
                    value={form.diskon}
                    aria-invalid={galat.diskon ? "true" : undefined}
                    placeholder="0"
                    onChange={(event) => setForm((prev) => ({ ...prev, diskon: event.target.value }))}
                  />
                </Medan>
                <Medan id="bw-dp" label={t("Deposit diterima (RM)", "Deposit received (RM)")} hint={t("Hanya direkodkan apabila disimpan sebagai tahanan.", "Only recorded when saved as held.")}>
                  <input
                    id="bw-dp"
                    className="bw-input"
                    type="number"
                    min="0"
                    step="10"
                    value={form.dp}
                    placeholder="0"
                    onChange={(event) => setForm((prev) => ({ ...prev, dp: event.target.value }))}
                  />
                </Medan>
              </div>

              <div className="bw-summary">
                <div className="bw-summary__cell"><span>{t("Subjumlah", "Subtotal")}</span><strong>{rupiah(hitungDraft.subtotal)}</strong></div>
                <div className="bw-summary__cell"><span>{t("Diskaun", "Discount")}</span><strong>{hitungDraft.diskon > 0 ? `− ${rupiah(hitungDraft.diskon)}` : "—"}</strong></div>
                <div className="bw-summary__cell"><span>{t("Jumlah perlu dibayar", "Total due")}</span><strong>{rupiah(hitungDraft.total)}</strong></div>
                <div className="bw-summary__cell"><span>{t("Baki selepas deposit", "Balance after deposit")}</span><strong>{rupiah(Math.max(hitungDraft.total - (Number(form.dp) || 0), 0))}</strong></div>
              </div>

              <dl className="bw-kv">
                <dt>{t("Pelanggan", "Customer")}</dt>
                <dd>{form.pelanggan ? ambilPelanggan(form.pelanggan, pelangganList).nama : "—"}</dd>
                <dt>{t("Keberangkatan", "Departure")}</dt>
                <dd>{form.keberangkatan ? `${keberangkatanForm.id} · ${keberangkatanForm.label}` : "—"}</dd>
                <dt>{t("Penumpang", "Passengers")}</dt>
                <dd>{draftPenumpang.map((orang) => orang.nama || t("(tiada nama)", "(unnamed)")).join(", ")}</dd>
              </dl>

              <div className="bw-alert">
                <Ikon icon={Info} />
                <span>
                  {t(
                    "Simpan sebagai tahanan menempah {n} kerusi selama 24 jam. Jika deposit tidak diterima, kerusi dilepaskan secara automatik.",
                    "Saving as held reserves {n} seats for 24 hours. If the deposit is not received, the seats are released automatically.",
                  ).replace("{n}", String(draftPenumpang.length))}
                </span>
              </div>
            </>
          ) : null}
        </div>

        <div className="bw-dialog__foot">
          <button type="button" className="bw-btn" data-action="bw:back" onClick={langkah === 1 ? tutupDialog : kembali}>
            {langkah === 1 ? t("Batal", "Cancel") : t("Kembali", "Back")}
          </button>
          {langkah < 3 ? (
            <button type="button" className="bw-btn bw-btn--primary" data-action="bw:next" onClick={lanjut}>
              {t("Seterusnya", "Next")}
              <Ikon icon={ArrowRight} />
            </button>
          ) : (
            <>
              <button type="button" className="bw-btn" data-action="bw:save-draft" onClick={() => simpan("draft")}>
                {t("Simpan draf", "Save draft")}
              </button>
              <button type="button" className="bw-btn bw-btn--primary" data-action="bw:save-hold" onClick={() => simpan("hold")}>
                <Ikon icon={Clock} />
                {t("Simpan & tahan kerusi", "Save & hold seats")}
              </button>
            </>
          )}
        </div>
      </dialog>

      {/* Cancel booking dialog */}
      <dialog ref={dialogBatal} className="bw-dialog" aria-labelledby="bw-cancel-title" style={{ width: "min(520px, calc(100vw - 32px))" }} data-node-id="bw.cancel">
        <form method="dialog" onSubmit={konfirmasiBatal}>
          <div className="bw-dialog__head">
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "17px", fontWeight: 700, letterSpacing: "-0.01em" }} id="bw-cancel-title">
                {t("Batalkan tempahan", "Cancel booking")}
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--color-text-muted)" }}>{aktif.ref} · {aktifPelanggan.nama}</p>
            </div>
            <button type="button" className="bw-close" aria-label={t("Tutup dialog pembatalan", "Close cancellation dialog")} onClick={() => dialogBatal.current?.close()}>
              <Ikon icon={X} />
            </button>
          </div>
          <div className="bw-dialog__body">
            <div className="bw-alert bw-alert--danger">
              <Ikon icon={TriangleAlert} />
              <span>
                {t(
                  "{n} kerusi akan dilepaskan semula ke keberangkatan {dep}. Ini direkodkan dalam sejarah tempahan.",
                  "{n} seats will be released back to departure {dep}. This is recorded in the booking history.",
                ).replace("{n}", String(aktif.penumpang.length)).replace("{dep}", aktifKeberangkatan.id)}
              </span>
            </div>
            <Medan id="bw-alasan" label={t("Sebab pembatalan", "Cancellation reason")} wide error={galatBatal || undefined}>
              <textarea
                id="bw-alasan"
                className="bw-input"
                rows={3}
                value={alasanBatal}
                aria-invalid={galatBatal ? "true" : undefined}
                onChange={(event) => setAlasanBatal(event.target.value)}
                placeholder={t("cth. pelanggan menangguhkan perjalanan", "e.g. customer postponed the trip")}
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </Medan>
          </div>
          <div className="bw-dialog__foot" style={{ borderBottomLeftRadius: "var(--radius-panel)", borderBottomRightRadius: "var(--radius-panel)" }}>
            <button type="button" className="bw-btn" onClick={() => dialogBatal.current?.close()}>
              {t("Kekalkan tempahan", "Keep booking")}
            </button>
            <button type="submit" className="bw-btn bw-btn--danger bg-solid" data-action="bw:confirm-cancel">
              {t("Batalkan tempahan", "Cancel booking")}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}

import { useState } from "react";
import { Check, Database, Download, HardDrive, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface Operation {
  id: string;
  label: { ms: string; en: string };
  desc: { ms: string; en: string };
  icon: typeof RefreshCw;
  tone: "primary" | "amber" | "red";
}

const OPERATIONS: Operation[] = [
  {
    id: "clear_cache",
    label: { ms: "Kosongkan Cache", en: "Clear Cache" },
    desc: { ms: "Buang cache halaman awam dan CDN.", en: "Flush public page and CDN cache." },
    icon: RefreshCw,
    tone: "primary",
  },
  {
    id: "rebuild_index",
    label: { ms: "Bina Semula Indeks Carian", en: "Rebuild Search Index" },
    desc: { ms: "Indeks semula pakej dan pelanggan untuk carian.", en: "Re-index packages and customers for search." },
    icon: Database,
    tone: "primary",
  },
  {
    id: "cleanup_holds",
    label: { ms: "Bersihkan Pegangan Luput", en: "Cleanup Expired Holds" },
    desc: { ms: "Lepaskan kerusi yang dipegang melebihi tempoh.", en: "Release seats held past their expiry." },
    icon: Trash2,
    tone: "amber",
  },
  {
    id: "purge_logs",
    label: { ms: "Padam Log Lama", en: "Purge Old Logs" },
    desc: { ms: "Buang log audit lebih daripada 90 hari.", en: "Delete audit logs older than 90 days." },
    icon: HardDrive,
    tone: "red",
  },
];

const STATS = [
  { label: { ms: "Tempahan", en: "Bookings" }, value: "1,284" },
  { label: { ms: "Pelanggan", en: "Customers" }, value: "3,921" },
  { label: { ms: "Pakej", en: "Packages" }, value: "48" },
  { label: { ms: "Saiz Pangkalan Data", en: "Database Size" }, value: "24.6 MB" },
];

// Ikon chip soft-tone (30px, radius 9px) mengikut token soft-tone design system.
const CHIP_TONE = {
  primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  amber: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  red: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
};

// Butang secondary mengikut corak ss-btn + varian tone.
const BTN =
  "inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:opacity-55 disabled:cursor-not-allowed";
const BTN_TONE = {
  primary: `${BTN} border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-border))] bg-[var(--color-surface)] text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]`,
  amber: `${BTN} border-[color-mix(in_srgb,var(--color-warning)_35%,var(--color-border))] bg-[var(--color-surface)] text-[var(--color-warning)] hover:bg-[var(--color-warning-soft)]`,
  red: `${BTN} border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]`,
};

const CARD = "rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]";

export default function DataMaintenance() {
  const { t } = useLang();
  const [running, setRunning] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [lastRun, setLastRun] = useState<Record<string, string>>({});

  const runOperation = (op: Operation) => {
    setRunning(op.id);
    window.setTimeout(() => {
      setRunning(null);
      setDone((prev) => [...prev, op.id]);
      setLastRun((prev) => ({
        ...prev,
        [op.id]: new Date().toLocaleString("en-MY", {
          dateStyle: "short",
          timeStyle: "short",
        }),
      }));
    }, 900);
  };

  return (
    <div className="max-w-5xl space-y-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Penyelenggaraan Data", "Data Maintenance")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Operasi penyelenggaraan sistem dan ringkasan data.",
              "System maintenance operations and data overview.",
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label.en} className={`${CARD} p-4`}>
            <p className="text-xs text-[var(--color-text-muted)]">{t(s.label.ms, s.label.en)}</p>
            <p className="mt-1 font-display text-xl font-bold tabular-nums text-[var(--color-text)]">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Operations */}
      <div>
        <h2 className="mb-2 font-display text-[15px] font-bold tracking-tight text-[var(--color-text)]">
          {t("Operasi", "Operations")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPERATIONS.map((op) => {
            const Icon = op.icon;
            const isRunning = running === op.id;
            const isDone = done.includes(op.id);
            return (
              <div key={op.id} className={`${CARD} p-4`}>
                <div className="flex items-start gap-3">
                  <span
                    className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] ${CHIP_TONE[op.tone]}`}
                    aria-hidden="true"
                  >
                    <Icon className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-[13.5px] font-semibold text-[var(--color-text)]">
                        {t(op.label.ms, op.label.en)}
                      </h3>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-success)]">
                          <Check className="h-3 w-3" />
                          {t("Selesai", "Done")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                      {t(op.desc.ms, op.desc.en)}
                    </p>
                    {lastRun[op.id] && (
                      <p className="mt-1 text-[11px] tabular-nums text-[var(--color-text-muted)]">
                        {t("Terakhir", "Last run")}: {lastRun[op.id]}
                      </p>
                    )}
                    <button
                      onClick={() => runOperation(op)}
                      disabled={running !== null}
                      className={`${BTN_TONE[op.tone]} mt-3 px-2.5 py-1.5 text-xs`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isRunning ? "animate-spin" : ""}`} />
                      {isRunning ? t("Sedang jalan…", "Running…") : t("Jalankan", "Run")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export / Import */}
      <div className={CARD}>
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-[14.5px] font-semibold text-[var(--color-text)]">
            {t("Eksport & Import Data", "Data Export & Import")}
          </h2>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            <button
              className={`${BTN} border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]`}
            >
              <Download className="h-3.5 w-3.5" />
              {t("Eksport Semua Data (JSON)", "Export All Data (JSON)")}
            </button>
            <button
              className={`${BTN} border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]`}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              {t("Import Data", "Import Data")}
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t(
              "Eksport/import akan didayakan dengan backend storage.",
              "Export/import will be enabled with backend storage.",
            )}
          </p>
        </div>
      </div>

      {/* Danger zone — border danger-soft + butang danger */}
      <div
        className="rounded-[var(--radius-panel)] border bg-[var(--color-surface)]"
        style={{ borderColor: "var(--color-danger-soft)" }}
      >
        <div
          className="border-b px-5 py-4"
          style={{ borderColor: "var(--color-danger-soft)" }}
        >
          <h2 className="text-[14.5px] font-semibold text-[var(--color-danger)]">
            {t("Zon Bahaya", "Danger Zone")}
          </h2>
        </div>
        <div className="space-y-3 p-5">
          <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {t(
              "Padam log lama dan data usang secara permanen. Tindakan direkodkan dalam log audit.",
              "Permanently delete old logs and stale data. Actions are recorded in the audit log.",
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className={`${BTN} border-[color-mix(in_srgb,var(--color-danger)_35%,var(--color-border))] bg-[var(--color-surface)] text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]`}>
              <Trash2 className="h-3.5 w-3.5" />
              {t("Kosongkan Data Lama", "Purge Old Data")}
            </button>
            <button
              className={`${BTN} border-transparent bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]`}
            >
              <HardDrive className="h-3.5 w-3.5" />
              {t("Padam Log Lama", "Purge Old Logs")}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {t(
          "Operasi olok-olok — penyelenggaraan sebenar akan didayakan pada fasa backend.",
          "Mock operations — real maintenance will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

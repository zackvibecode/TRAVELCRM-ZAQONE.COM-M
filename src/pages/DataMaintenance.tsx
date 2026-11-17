import { useState } from "react";
import {
  Check,
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const TONE_CLASS = {
  primary: "border-primary/30 text-primary hover:bg-primary/5",
  amber: "border-amber-200 text-amber-700 hover:bg-amber-50",
  red: "border-red-200 text-red-600 hover:bg-red-50",
};

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
        [op.id]: new Date().toLocaleString(langToLocale(), {
          dateStyle: "short",
          timeStyle: "short",
        }),
      }));
    }, 900);
  };

  const langToLocale = () => "en-MY";

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {t("Penyelenggaraan Data", "Data Maintenance")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "Operasi penyelenggaraan sistem dan ringkasan data.",
            "System maintenance operations and data overview.",
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label.en} className="rounded-lg border bg-white p-3">
            <p className="text-xs text-muted-foreground">{t(s.label.ms, s.label.en)}</p>
            <p className="mt-1 font-display text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Operations */}
      <div>
        <h2 className="mb-2 font-display text-lg font-bold tracking-tight">
          {t("Operasi", "Operations")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPERATIONS.map((op) => {
            const Icon = op.icon;
            const isRunning = running === op.id;
            const isDone = done.includes(op.id);
            return (
              <div key={op.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border", TONE_CLASS[op.tone])}>
                    <Icon className={cn("h-4 w-4", isRunning && "animate-spin")} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">
                        {t(op.label.ms, op.label.en)}
                      </h3>
                      {isDone && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <Check className="h-3 w-3" />
                          {t("Selesai", "Done")}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(op.desc.ms, op.desc.en)}
                    </p>
                    {lastRun[op.id] && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t("Terakhir", "Last run")}: {lastRun[op.id]}
                      </p>
                    )}
                    <button
                      onClick={() => runOperation(op)}
                      disabled={running !== null}
                      className={cn(
                        "mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50",
                        TONE_CLASS[op.tone],
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", isRunning && "animate-spin")} />
                      {isRunning
                        ? t("Sedang jalan…", "Running…")
                        : t("Jalankan", "Run")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export / Import */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">
          {t("Eksport & Import Data", "Data Export & Import")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted/50">
            <Download className="h-3.5 w-3.5" />
            {t("Eksport Semua Data (JSON)", "Export All Data (JSON)")}
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted/50">
            <UploadCloud className="h-3.5 w-3.5" />
            {t("Import Data", "Import Data")}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "Eksport/import akan didayakan dengan backend storage.",
            "Export/import will be enabled with backend storage.",
          )}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "Operasi olok-olok — penyelenggaraan sebenar akan didayakan pada fasa backend.",
          "Mock operations — real maintenance will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

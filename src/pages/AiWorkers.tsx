import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  FileUp,
  PackageCheck,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { apiFetch } from "@/lib/api";

/**
 * AI Workers — background automation for packages. Admin/management only
 * (route guard + backend role gate). Shows each worker as a card with a
 * toggle, a run-now button and the latest run; a run feed lists results and
 * PDF-sync diffs awaiting review.
 */

const PANEL = "tv-panel";
const BTN = "tv-btn disabled:opacity-55 disabled:cursor-not-allowed";
const BTN_PRIMARY = `${BTN} tv-btn--primary`;

type WorkerId = "enrich" | "pdf_sync" | "price_check";
type RunStatus = "running" | "done" | "failed" | "pending_review";

interface WorkerRun {
  id: string;
  worker: WorkerId;
  status: RunStatus;
  summary: string;
  result: Record<string, unknown> | null;
  packageId: string | null;
  staffId: string | null;
  appliedAt: string | null;
  createdAt: string;
}

interface AiWorkersSettings {
  enrich: boolean;
  pdf_sync: boolean;
  price_check: boolean;
}

interface StatusResponse {
  settings: AiWorkersSettings;
  latest: Record<string, WorkerRun>;
}

const WORKER_META: Record<
  WorkerId,
  { labelMs: string; labelEn: string; descMs: string; descEn: string; scheduleMs: string; scheduleEn: string }
> = {
  enrich: {
    labelMs: "Pelengkap Pakej",
    labelEn: "Package Enricher",
    descMs: "Auto isi deskripsi, highlight dan inklusi untuk pakej yang masih kosong.",
    descEn: "Auto-fills descriptions, highlights and inclusions for incomplete packages.",
    scheduleMs: "Harian, 7:00 pagi",
    scheduleEn: "Daily, 7:00 AM",
  },
  pdf_sync: {
    labelMs: "Sync PDF Supplier",
    labelEn: "Supplier PDF Sync",
    descMs: "Baca brochure PDF supplier, cadangkan perubahan pakej untuk semakan anda.",
    descEn: "Reads supplier brochure PDFs and proposes package changes for your review.",
    scheduleMs: "Manual — muat naik PDF",
    scheduleEn: "Manual — upload a PDF",
  },
  price_check: {
    labelMs: "Pemeriksa Harga",
    labelEn: "Price Checker",
    descMs: "Banding harga jualan dengan kos supplier, flag pakej bermargin rendah.",
    descEn: "Compares selling prices with supplier costs and flags low-margin packages.",
    scheduleMs: "Mingguan, Isnin 7:00 pagi",
    scheduleEn: "Weekly, Monday 7:00 AM",
  },
};

const STATUS_PILL: Record<RunStatus, { ms: string; en: string; cls: string }> = {
  running: { ms: "Sedang jalan", en: "Running", cls: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" },
  done: { ms: "Siap", en: "Done", cls: "bg-[var(--color-success-soft)] text-[var(--color-success)]" },
  failed: { ms: "Gagal", en: "Failed", cls: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" },
  pending_review: { ms: "Menunggu semakan", en: "Awaiting review", cls: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
};

const WORKER_ICON: Record<WorkerId, typeof Bot> = {
  enrich: PackageCheck,
  pdf_sync: FileUp,
  price_check: TrendingDown,
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AiWorkers() {
  const { t } = useLang();
  const [settings, setSettings] = useState<AiWorkersSettings | null>(null);
  const [latest, setLatest] = useState<Record<string, WorkerRun>>({});
  const [runs, setRuns] = useState<WorkerRun[]>([]);
  const [busyWorker, setBusyWorker] = useState<WorkerId | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const status = await apiFetch<StatusResponse>("/ai-workers/status");
      setSettings(status.settings);
      setLatest(status.latest ?? {});
      const feed = await apiFetch<{ runs: WorkerRun[] }>("/ai-workers/runs");
      setRuns(feed.runs ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuatkan data");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleWorker(worker: WorkerId) {
    if (!settings) return;
    const next = { ...settings, [worker]: !settings[worker] };
    setSettings(next);
    try {
      await apiFetch("/ai-workers/settings", {
        method: "PUT",
        body: JSON.stringify(next),
      });
    } catch {
      setSettings(settings); // revert on failure
    }
  }

  async function runNow(worker: WorkerId) {
    setBusyWorker(worker);
    setError(null);
    try {
      await apiFetch(`/ai-workers/run/${worker}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run gagal");
    } finally {
      setBusyWorker(null);
    }
  }

  async function uploadPdf(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiFetch("/ai-workers/supplier-pdf", { method: "POST", body: form });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Muat naik gagal");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function applyRun(id: string) {
    setBusyWorker("pdf_sync");
    try {
      await apiFetch(`/ai-workers/runs/${id}/apply`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Apply gagal");
    } finally {
      setBusyWorker(null);
    }
  }

  async function rejectRun(id: string) {
    setBusyWorker("pdf_sync");
    try {
      await apiFetch(`/ai-workers/runs/${id}/reject`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject gagal");
    } finally {
      setBusyWorker(null);
    }
  }

  const pendingRuns = runs.filter((r) => r.status === "pending_review");

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("AI Workers", "AI Workers")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Pekerja AI automatik yang bantu urus pakej — lengkapkan pakej kosong, sync brochure supplier dan semak margin harga.",
              "Automated AI helpers for your packages — fill empty packages, sync supplier brochures and check price margins.",
            )}
          </p>
        </div>
        <button type="button" onClick={() => void load()} className={BTN}>
          <RefreshCw className="h-4 w-4" />
          {t("Muat Semula", "Refresh")}
        </button>
      </div>

      {error && (
        <div className="rounded-[var(--radius-control)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-2.5 text-[13px] text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Worker cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(WORKER_META) as WorkerId[]).map((worker) => {
          const meta = WORKER_META[worker];
          const Icon = WORKER_ICON[worker];
          const enabled = settings ? settings[worker] : false;
          const lastRun = latest[worker];
          const busy = busyWorker === worker;
          return (
            <div key={worker} className={`${PANEL} flex flex-col gap-3 p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-control)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <div className="text-[14px] font-bold text-[var(--color-text)]">
                      {t(meta.labelMs, meta.labelEn)}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)]">
                      {t(meta.scheduleMs, meta.scheduleEn)}
                    </div>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => void toggleWorker(worker)}
                    className="h-4 w-4 rounded border-input"
                  />
                </label>
              </div>

              <p className="text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">
                {t(meta.descMs, meta.descEn)}
              </p>

              {lastRun && (
                <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_PILL[lastRun.status].cls}`}>
                      {t(STATUS_PILL[lastRun.status].ms, STATUS_PILL[lastRun.status].en)}
                    </span>
                    <span className="text-[10.5px] text-[var(--color-text-secondary)]">
                      {formatTime(lastRun.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[var(--color-text)]">{lastRun.summary}</p>
                </div>
              )}

              {worker !== "pdf_sync" && (
                <button
                  type="button"
                  disabled={busy || !enabled}
                  onClick={() => void runNow(worker)}
                  className={`${BTN_PRIMARY} justify-center`}
                >
                  {busy ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {t("Sedang jalan…", "Running…")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t("Jalankan Sekarang", "Run Now")}
                    </>
                  )}
                </button>
              )}

              {worker === "pdf_sync" && (
                <button
                  type="button"
                  disabled={uploading || !enabled}
                  onClick={() => fileInputRef.current?.click()}
                  className={`${BTN_PRIMARY} justify-center`}
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {t("Memproses PDF…", "Processing PDF…")}
                    </>
                  ) : (
                    <>
                      <FileUp className="h-4 w-4" />
                      {t("Muat Naik PDF Supplier", "Upload Supplier PDF")}
                    </>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadPdf(file);
        }}
      />

      {/* Pending reviews */}
      {pendingRuns.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold text-[var(--color-text)]">
            {t("Menunggu Semakan Anda", "Awaiting Your Review")}
          </h2>
          {pendingRuns.map((run) => (
            <PendingReviewCard
              key={run.id}
              run={run}
              busy={busyWorker === "pdf_sync"}
              onApply={() => void applyRun(run.id)}
              onReject={() => void rejectRun(run.id)}
            />
          ))}
        </div>
      )}

      {/* Run history */}
      <div className={`${PANEL} overflow-hidden`}>
        <div className="border-b border-[var(--color-border)] px-5 py-3 text-[13px] font-bold text-[var(--color-text)]">
          {t("Sejarah Run", "Run History")}
        </div>
        {runs.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[var(--color-text-secondary)]">
            {t("Belum ada run. Klik Jalankan Sekarang untuk mula.", "No runs yet. Click Run Now to start.")}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {runs.map((run) => (
              <div key={run.id} className="flex items-start gap-3 px-5 py-3">
                <span className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_PILL[run.status].cls}`}>
                  {t(STATUS_PILL[run.status].ms, STATUS_PILL[run.status].en)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-[var(--color-text)]">{run.summary}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    {t(WORKER_META[run.worker].labelMs, WORKER_META[run.worker].labelEn)} · {formatTime(run.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Diff card for a pending pdf_sync run. */
function PendingReviewCard(props: {
  run: WorkerRun;
  busy: boolean;
  onApply: () => void;
  onReject: () => void;
}) {
  const { t } = useLang();
  const { run, busy, onApply, onReject } = props;
  const result = (run.result ?? {}) as {
    draft?: Record<string, unknown>;
    matchedPackageName?: string | null;
    matchedPackageId?: string | null;
    diff?: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  };
  const diff = result.diff ?? [];
  const matched = Boolean(result.matchedPackageId);

  return (
    <div className={`${PANEL} flex flex-col gap-3 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-bold text-[var(--color-text)]">
            {result.matchedPackageName ?? (result.draft?.name as string) ?? "—"}
          </div>
          <div className="text-[11.5px] text-[var(--color-text-secondary)]">
            {matched
              ? t("Pakej sedia ada — semak perubahan di bawah", "Existing package — review the changes below")
              : t("Tiada pakej sepadan — draft pakej baru", "No matching package — new package draft")}
            {" · "}
            {formatTime(run.createdAt)}
          </div>
        </div>
        {matched && result.matchedPackageId && (
          <a
            href={`/packages?focus=${result.matchedPackageId}`}
            className={BTN}
          >
            {t("Lihat Pakej", "View Package")}
          </a>
        )}
      </div>

      {diff.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-text-secondary)]">
          {t(
            "Tiada perbezaan dikenal pasti dengan pakej sedia ada.",
            "No differences detected against the existing package.",
          )}
        </p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)]">
          {diff.map((d) => (
            <div
              key={d.field}
              className="grid grid-cols-[110px_1fr_1fr] gap-2 border-b border-[var(--color-border)] px-3 py-2 text-[12px] last:border-b-0"
            >
              <span className="font-semibold text-[var(--color-text-secondary)]">{d.field}</span>
              <span className="break-words text-[var(--color-text-secondary)] line-through decoration-[var(--color-danger)]">
                {String(d.oldValue ?? "—").slice(0, 160)}
              </span>
              <span className="break-words font-medium text-[var(--color-text)]">
                {String(d.newValue ?? "—").slice(0, 160)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !matched || diff.length === 0}
          onClick={onApply}
          className={`${BTN_PRIMARY} flex-1 justify-center`}
        >
          {t("Terapkan Perubahan", "Apply Changes")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          className={`${BTN} flex-1 justify-center`}
        >
          {t("Buang", "Discard")}
        </button>
      </div>
    </div>
  );
}



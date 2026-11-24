import { useState } from "react";
import { Check, FileDigit, RotateCcw, Save } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { EmptyState } from "@/components/Ui";

interface NumberingRule {
  id: string;
  doc: string;
  label: { ms: string; en: string };
  prefix: string;
  digits: number;
  nextNo: number;
  resetOn: "never" | "year" | "month";
  sample: string;
}

// Empty until the backend numbering API is wired up.
const INITIAL_RULES: NumberingRule[] = [];

const RESET_LABELS = {
  never: { ms: "Tiada reset", en: "Never" },
  year: { ms: "Reset tahunan", en: "Yearly" },
  month: { ms: "Reset bulanan", en: "Monthly" },
};

type Tone = "neutral" | "info" | "warning";
const TONE_BG: Record<Tone, string> = {
  neutral: "bg-[var(--color-neutral-soft)]",
  info: "bg-[var(--color-info-soft)]",
  warning: "bg-[var(--color-warning-soft)]",
};
const TONE_FG: Record<Tone, string> = {
  neutral: "text-[var(--color-text-secondary)]",
  info: "text-[var(--color-info)]",
  warning: "text-[var(--color-warning)]",
};

export default function DocumentNumbering() {
  const { t } = useLang();
  const [rules, setRules] = useState<NumberingRule[]>(INITIAL_RULES);
  const [saved, setSaved] = useState(false);

  const update = (id: string, patch: Partial<NumberingRule>) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const preview = (r: NumberingRule) => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const n = String(r.nextNo).padStart(r.digits, "0");
    if (r.resetOn === "month") return `${r.prefix}-${year}-${month}-${n}`;
    if (r.resetOn === "year") return `${r.prefix}-${year}-${n}`;
    return `${r.prefix}-${n}`;
  };

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const resetTone: Record<NumberingRule["resetOn"], Tone> = {
    never: "neutral",
    year: "info",
    month: "warning",
  };

  const label = (text: string, htmlFor?: string) => (
    <label htmlFor={htmlFor} className="tv-label">
      {text}
    </label>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Penomboran Dokumen", "Document Numbering")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Tetapkan format nombor rujukan untuk dokumen sistem.",
              "Configure reference number formats for system documents.",
            )}
          </p>
        </div>
        {rules.length > 0 ? (
          <button type="button" onClick={handleSave} className="tv-btn tv-btn--primary" aria-live="polite">
            {saved ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
            {saved ? t("Disimpan!", "Saved!") : t("Simpan Format", "Save Formats")}
          </button>
        ) : null}
      </div>

      {/* Rules */}
      {rules.length === 0 ? (
        <EmptyState
          icon={FileDigit}
          title={t("Belum ada format penomboran", "No numbering formats yet")}
          description={t(
            "Format untuk sebut harga, invois dan resit akan muncul di sini setelah didayakan.",
            "Formats for quotations, invoices and receipts will appear here once enabled.",
          )}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <section key={r.id} className="tv-panel">
              <div className="tv-panel__head">
                <h2 className="tv-panel__title flex items-center gap-2">
                  <span aria-hidden="true" className={`tv-icon-tile ${TONE_BG.info} ${TONE_FG.info}`}>
                    <FileDigit size={16} />
                  </span>
                  {t(r.label.ms, r.label.en)}
                </h2>
                <span className={`tv-pill ${TONE_BG[resetTone[r.resetOn]]} ${TONE_FG[resetTone[r.resetOn]]}`}>
                  {t(RESET_LABELS[r.resetOn].ms, RESET_LABELS[r.resetOn].en)}
                </span>
              </div>
              <div className="flex flex-col gap-4 p-5">
                {/* Live preview */}
                <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 py-3">
                  <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                    {t("Pratonton langsung", "Live preview")}
                  </span>
                  <code className="font-[var(--font-mono)] text-[14px] font-semibold tracking-[0.02em] tabular-nums text-[var(--color-primary)]">
                    {preview(r)}
                  </code>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {label(t("Prefix", "Prefix"), `dn-prefix-${r.id}`)}
                    <input
                      id={`dn-prefix-${r.id}`}
                      value={r.prefix}
                      onChange={(e) => update(r.id, { prefix: e.target.value.toUpperCase() })}
                      className="tv-input font-[var(--font-mono)]"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {label(t("Bilangan Digit", "Digits"), `dn-digits-${r.id}`)}
                    <input
                      id={`dn-digits-${r.id}`}
                      type="number"
                      min={3}
                      max={10}
                      value={r.digits}
                      onChange={(e) => update(r.id, { digits: Number(e.target.value) })}
                      className="tv-input tabular-nums"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {label(t("Nombor Seterusnya", "Next Number"), `dn-next-${r.id}`)}
                    <input
                      id={`dn-next-${r.id}`}
                      type="number"
                      min={1}
                      value={r.nextNo}
                      onChange={(e) => update(r.id, { nextNo: Number(e.target.value) })}
                      className="tv-input font-[var(--font-mono)] tabular-nums"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    {label(t("Reset", "Reset"), `dn-reset-${r.id}`)}
                    <select
                      id={`dn-reset-${r.id}`}
                      value={r.resetOn}
                      onChange={(e) => update(r.id, { resetOn: e.target.value as NumberingRule["resetOn"] })}
                      className="tv-input"
                    >
                      {(Object.keys(RESET_LABELS) as NumberingRule["resetOn"][]).map((k) => (
                        <option key={k} value={k}>
                          {t(RESET_LABELS[k].ms, RESET_LABELS[k].en)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[var(--color-border)] pt-3">
                  <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
                    {t("Contoh tersimpan", "Stored sample")}:{" "}
                    <span className="font-[var(--font-mono)] tabular-nums text-[var(--color-text-secondary)]">{r.sample}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => update(r.id, { nextNo: 1 })}
                    className="tv-btn tv-btn--secondary"
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                    {t("Reset Kaunter", "Reset Counter")}
                  </button>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {rules.length > 0 ? (
        <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
          {t(
            "Nombor seterusnya bertambah automatik setiap dokumen baharu dikeluarkan.",
            "The next number increments automatically each time a new document is issued.",
          )}
        </p>
      ) : null}
    </div>
  );
}

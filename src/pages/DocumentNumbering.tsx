import { useState } from "react";
import { Check, FileDigit, RotateCcw, Save } from "lucide-react";
import { useLang } from "@/lib/i18n";

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

// Mock data — backend numbering API menyusul pada fasa backend.
const STUB_RULES: NumberingRule[] = [
  { id: "nr_booking", doc: "booking", label: { ms: "Tempahan", en: "Booking" }, prefix: "ZQK", digits: 6, nextNo: 118, resetOn: "year", sample: "ZQK-2026-000118" },
  { id: "nr_invoice", doc: "invoice", label: { ms: "Invois", en: "Invoice" }, prefix: "INV", digits: 6, nextNo: 342, resetOn: "year", sample: "INV-2026-000342" },
  { id: "nr_receipt", doc: "receipt", label: { ms: "Resit", en: "Receipt" }, prefix: "RCT", digits: 6, nextNo: 297, resetOn: "year", sample: "RCT-2026-000297" },
  { id: "nr_quote", doc: "quote", label: { ms: "Sebut Harga", en: "Quotation" }, prefix: "QTN", digits: 5, nextNo: 64, resetOn: "month", sample: "QTN-2026-11-00064" },
  { id: "nr_credit_note", doc: "credit_note", label: { ms: "Nota Kredit", en: "Credit Note" }, prefix: "CN", digits: 5, nextNo: 12, resetOn: "never", sample: "CN-00012" },
];

const RESET_LABELS = {
  never: { ms: "Tiada reset", en: "Never" },
  year: { ms: "Reset tahunan", en: "Yearly" },
  month: { ms: "Reset bulanan", en: "Monthly" },
};

const panelStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-panel)",
};

const inputCls =
  "h-[37px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-[11px] text-[13.5px] text-[var(--color-text)] outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:-outline-offset-1";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const btnPrimary: React.CSSProperties = {
  border: "1px solid var(--color-primary)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
};

const btnDanger: React.CSSProperties = {
  border: "1px solid color-mix(in srgb, var(--color-warning) 35%, var(--color-border))",
  background: "var(--color-surface)",
  color: "var(--color-warning)",
};

export default function DocumentNumbering() {
  const { t } = useLang();
  const [rules, setRules] = useState<NumberingRule[]>(STUB_RULES);
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

  const fieldLabel = (label: string) => (
    <label className="text-[12.5px] font-medium text-[var(--color-text-secondary)]">{label}</label>
  );

  const resetTone: Record<NumberingRule["resetOn"], "neutral" | "info" | "warning"> = {
    never: "neutral",
    year: "info",
    month: "warning",
  };

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div style={{ minWidth: 0 }}>
          <h1 className="tvl-title">{t("Penomboran Dokumen", "Document Numbering")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Tetapkan format nombor rujukan untuk dokumen sistem.",
              "Configure reference number formats for system documents.",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          className={btnBase}
          style={
            saved
              ? { border: "1px solid var(--color-success)", background: "var(--color-success)", color: "var(--color-surface)" }
              : btnPrimary
          }
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? t("Disimpan!", "Saved!") : t("Simpan Format", "Save Formats")}
        </button>
      </div>

      {/* Rules */}
      <div className="flex flex-col gap-3">
        {rules.map((r) => (
          <section key={r.id} style={panelStyle}>
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <h2 className="m-0 flex items-center gap-2 text-[14.5px] font-semibold text-[var(--color-text)]">
                <span
                  aria-hidden="true"
                  className="grid h-[30px] w-[30px] place-items-center rounded-[9px]"
                  style={{ background: "var(--color-info-soft)", color: "var(--color-info)" }}
                >
                  <FileDigit size={16} />
                </span>
                {t(r.label.ms, r.label.en)}
              </h2>
              <span
                className="inline-flex items-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11.5px] font-semibold"
                style={{
                  background:
                    resetTone[r.resetOn] === "neutral"
                      ? "var(--color-neutral-soft)"
                      : resetTone[r.resetOn] === "info"
                        ? "var(--color-info-soft)"
                        : "var(--color-warning-soft)",
                  color:
                    resetTone[r.resetOn] === "neutral"
                      ? "var(--color-text-secondary)"
                      : resetTone[r.resetOn] === "info"
                        ? "var(--color-info)"
                        : "var(--color-warning)",
                }}
              >
                {t(RESET_LABELS[r.resetOn].ms, RESET_LABELS[r.resetOn].en)}
              </span>
            </div>
            <div className="flex flex-col gap-4 px-5 py-5">
              {/* Live preview */}
              <div
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] px-4 py-3"
                style={{ border: "1px dashed var(--color-border-strong)", background: "var(--color-surface-raised)" }}
              >
                <span className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                  {t("Pratonton langsung", "Live preview")}
                </span>
                <code
                  className="font-[var(--font-mono)] text-[14px] font-semibold tracking-[0.02em] text-[var(--color-primary)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {preview(r)}
                </code>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5 min-w-0">
                  {fieldLabel(t("Prefix", "Prefix"))}
                  <input
                    value={r.prefix}
                    onChange={(e) => update(r.id, { prefix: e.target.value.toUpperCase() })}
                    className={`${inputCls} font-[var(--font-mono)]`}
                  />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  {fieldLabel(t("Bilangan Digit", "Digits"))}
                  <input
                    type="number"
                    min={3}
                    max={10}
                    value={r.digits}
                    onChange={(e) => update(r.id, { digits: Number(e.target.value) })}
                    className={inputCls}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  {fieldLabel(t("Nombor Seterusnya", "Next Number"))}
                  <input
                    type="number"
                    min={1}
                    value={r.nextNo}
                    onChange={(e) => update(r.id, { nextNo: Number(e.target.value) })}
                    className={`${inputCls} font-[var(--font-mono)]`}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  {fieldLabel(t("Reset", "Reset"))}
                  <select
                    value={r.resetOn}
                    onChange={(e) =>
                      update(r.id, { resetOn: e.target.value as NumberingRule["resetOn"] })
                    }
                    className={inputCls}
                  >
                    {(Object.keys(RESET_LABELS) as NumberingRule["resetOn"][]).map((k) => (
                      <option key={k} value={k}>
                        {t(RESET_LABELS[k].ms, RESET_LABELS[k].en)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1" style={{ borderTop: "1px dashed var(--color-border)" }}>
                <p className="m-0 pt-3 text-[11.5px] text-[var(--color-text-muted)]">
                  {t("Contoh tersimpan", "Stored sample")}:{" "}
                  <span className="font-[var(--font-mono)] text-[var(--color-text-secondary)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {r.sample}
                  </span>
                </p>
                <button type="button" onClick={() => update(r.id, { nextNo: 1 })} className={btnBase} style={btnDanger}>
                  <RotateCcw size={14} />
                  {t("Reset Kaunter", "Reset Counter")}
                </button>
              </div>
            </div>
          </section>
        ))}
      </div>

      <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
        {t(
          "Data olok-olok — penomboran sebenar akan didayakan pada fasa backend.",
          "Mock data — real numbering will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

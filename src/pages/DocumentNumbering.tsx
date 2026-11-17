import { useState } from "react";
import { Check, FileDigit, RotateCcw, Save } from "lucide-react";
import { cn } from "@/lib/utils";
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

  const fieldCls =
    "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Penomboran Dokumen", "Document Numbering")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Tetapkan format nombor rujukan untuk dokumen sistem.",
              "Configure reference number formats for system documents.",
            )}
          </p>
        </div>
        <button
          onClick={handleSave}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90",
            saved && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? t("Disimpan!", "Saved!") : t("Simpan Format", "Save Formats")}
        </button>
      </div>

      {/* Rules */}
      <div className="space-y-3">
        {rules.map((r) => (
          <div key={r.id} className="rounded-lg border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                <FileDigit className="h-4 w-4" />
                {t(r.label.ms, r.label.en)}
              </h2>
              <code className="rounded bg-muted/60 px-2 py-1 text-xs font-mono text-primary">
                {preview(r)}
              </code>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("Prefix", "Prefix")}
                </label>
                <input
                  value={r.prefix}
                  onChange={(e) => update(r.id, { prefix: e.target.value.toUpperCase() })}
                  className={cn(fieldCls, "w-full font-mono")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("Bilangan Digit", "Digits")}
                </label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={r.digits}
                  onChange={(e) => update(r.id, { digits: Number(e.target.value) })}
                  className={cn(fieldCls, "w-full")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("Nombor Seterusnya", "Next Number")}
                </label>
                <input
                  type="number"
                  min={1}
                  value={r.nextNo}
                  onChange={(e) => update(r.id, { nextNo: Number(e.target.value) })}
                  className={cn(fieldCls, "w-full font-mono")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("Reset", "Reset")}
                </label>
                <select
                  value={r.resetOn}
                  onChange={(e) =>
                    update(r.id, { resetOn: e.target.value as NumberingRule["resetOn"] })
                  }
                  className={cn(fieldCls, "w-full bg-white")}
                >
                  {(Object.keys(RESET_LABELS) as NumberingRule["resetOn"][]).map((k) => (
                    <option key={k} value={k}>
                      {t(RESET_LABELS[k].ms, RESET_LABELS[k].en)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <p className="text-xs text-muted-foreground">
                {t("Contoh", "Example")}: <span className="font-mono text-foreground">{r.sample}</span>
              </p>
              <button
                onClick={() => update(r.id, { nextNo: 1 })}
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("Reset Kaunter", "Reset Counter")}
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "Data olok-olok — penomboran sebenar akan didayakan pada fasa backend.",
          "Mock data — real numbering will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

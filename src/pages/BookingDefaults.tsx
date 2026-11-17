import { useState } from "react";
import { CalendarClock, Check, Percent, Save, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";

// Mock state — backend settings API menyusul pada fasa backend.
export default function BookingDefaults() {
  const { t } = useLang();
  const [saved, setSaved] = useState(false);

  // Seat holds
  const [holdMinutes, setHoldMinutes] = useState(30);
  const [autoRelease, setAutoRelease] = useState(true);

  // Payments
  const [depositPercent, setDepositPercent] = useState(30);
  const [fullPaymentDays, setFullPaymentDays] = useState(14);
  const [overdueGraceDays, setOverdueGraceDays] = useState(3);
  const [acceptMethods, setAcceptMethods] = useState<string[]>([
    "bank_transfer",
    "card",
    "tng_ewallet",
    "cash",
  ]);

  // Trips
  const [checkInHours, setCheckInHours] = useState(3);
  const [minPax, setMinPax] = useState(2);

  const METHODS = [
    { id: "bank_transfer", label: { ms: "Pemindahan Bank", en: "Bank Transfer" } },
    { id: "card", label: { ms: "Kad Kredit / Debit", en: "Credit / Debit Card" } },
    { id: "tng_ewallet", label: { ms: "Touch 'n Go eWallet", en: "Touch 'n Go eWallet" } },
    { id: "cash", label: { ms: "Tunai", en: "Cash" } },
  ];

  const toggleMethod = (id: string) =>
    setAcceptMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );

  const handleSave = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  const fieldCls =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const numberField = (
    labelMs: string,
    labelEn: string,
    value: number,
    set: (n: number) => void,
    min: number,
    max: number,
    suffixMs: string,
    suffixEn: string,
    Icon?: typeof Timer,
  ) => (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {t(labelMs, labelEn)}
      </label>
      <div className="relative">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          className={cn(fieldCls, "pr-16")}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {t(suffixMs, suffixEn)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("Lalai Tempahan", "Booking Defaults")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Nilai lalai untuk tempahan, pegangan kerusi dan pembayaran.",
              "Default values for bookings, seat holds and payments.",
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
          {saved ? t("Disimpan!", "Saved!") : t("Simpan", "Save")}
        </button>
      </div>

      {/* Seat holds */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Timer className="h-4 w-4" />
          {t("Pegangan Kerusi", "Seat Holds")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {numberField(
            "Tempoh pegangan kerusi draf",
            "Draft seat hold duration",
            holdMinutes,
            setHoldMinutes,
            5,
            240,
            "minit",
            "minutes",
          )}
          <label className="flex items-center justify-between rounded-md border px-3 py-2">
            <span className="text-sm font-medium">
              {t("Lepaskan kerusi luput automatik", "Auto-release expired holds")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoRelease}
              onClick={() => setAutoRelease(!autoRelease)}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                autoRelease ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                  autoRelease ? "left-[18px]" : "left-0.5",
                )}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Payments */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <Percent className="h-4 w-4" />
          {t("Pembayaran", "Payments")}
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {numberField(
            "Deposit lalai",
            "Default deposit",
            depositPercent,
            setDepositPercent,
            0,
            100,
            "%",
            "%",
          )}
          {numberField(
            "Bayaran penuh sebelum keberangkatan",
            "Full payment before departure",
            fullPaymentDays,
            setFullPaymentDays,
            1,
            60,
            "hari",
            "days",
          )}
          {numberField(
            "Tempoh tangguh bayaran tertunggak",
            "Overdue payment grace period",
            overdueGraceDays,
            setOverdueGraceDays,
            0,
            30,
            "hari",
            "days",
          )}
        </div>
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("Kaedah pembayaran diterima", "Accepted payment methods")}
          </p>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => toggleMethod(m.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  acceptMethods.includes(m.id)
                    ? "border-primary/50 bg-primary/5 text-primary"
                    : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                {acceptMethods.includes(m.id) && <Check className="h-3 w-3" />}
                {t(m.label.ms, m.label.en)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trips */}
      <div className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
          <CalendarClock className="h-4 w-4" />
          {t("Trip", "Trips")}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {numberField(
            "Masa daftar masuk lapangan terbang",
            "Airport check-in before departure",
            checkInHours,
            setCheckInHours,
            1,
            12,
            "jam",
            "hours",
          )}
          {numberField(
            "Pax minimum setiap tempahan",
            "Minimum pax per booking",
            minPax,
            setMinPax,
            1,
            20,
            "pax",
            "pax",
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "Data olok-olok — lalai tempahan sebenar akan didayakan pada fasa backend.",
          "Mock data — real booking defaults will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

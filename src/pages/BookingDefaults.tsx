import { useState } from "react";
import { BadgeCheck, CalendarClock, Check, Percent, Save, Timer, Wallet } from "lucide-react";
import { useLang } from "@/lib/i18n";

const panelStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-panel)",
};

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-3.5 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55";

const btnPrimary: React.CSSProperties = {
  border: "1px solid var(--color-primary)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
};

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

  const numberField = (
    id: string,
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
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={id} className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--color-text-secondary)]">
        {Icon && <Icon size={14} style={{ color: "var(--color-text-muted)" }} />}
        {t(labelMs, labelEn)}
      </label>
      <div className="relative block">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          className="h-[37px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] pl-[11px] pr-[52px] text-[13.5px] text-[var(--color-text)] outline-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:-outline-offset-1"
          style={{ fontVariantNumeric: "tabular-nums" }}
        />
        <span className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2 text-[12px] text-[var(--color-text-muted)]">
          {t(suffixMs, suffixEn)}
        </span>
      </div>
    </div>
  );

  const sectionCard = (
    title: string,
    icon: React.ReactNode,
    children: React.ReactNode,
    subtitle?: string,
  ) => (
    <section style={panelStyle} aria-label={title}>
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h2 className="m-0 flex items-center gap-2 text-[14.5px] font-semibold text-[var(--color-text)]">
          {icon}
          {title}
        </h2>
        {subtitle ? <span className="text-[12px] text-[var(--color-text-muted)]">{subtitle}</span> : null}
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
    </section>
  );

  // Simulation values
  const sampleTotal = 2480;
  const depositAmount = Math.round((sampleTotal * depositPercent) / 100);
  const balanceAmount = sampleTotal - depositAmount;
  const formatNum = (n: number) => `RM ${n.toLocaleString("en-MY")}`;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div style={{ minWidth: 0 }}>
          <h1 className="tvl-title">{t("Lalai Tempahan", "Booking Defaults")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Nilai lalai untuk tempahan, pegangan kerusi dan pembayaran.",
              "Default values for bookings, seat holds and payments.",
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
          {saved ? t("Disimpan!", "Saved!") : t("Simpan", "Save")}
        </button>
      </div>

      {/* Seat holds */}
      {sectionCard(
        t("Pegangan Kerusi", "Seat Holds"),
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center rounded-[9px]"
          style={{ background: "var(--color-info-soft)", color: "var(--color-info)" }}
        >
          <Timer size={16} />
        </span>,
        <div className="grid gap-4 md:grid-cols-2">
          {numberField("bd-hold", "Tempoh pegangan kerusi draf", "Draft seat hold duration", holdMinutes, setHoldMinutes, 5, 240, "minit", "minutes", Timer)}
          <label
            className="flex items-center justify-between rounded-[var(--radius-control)] px-3 py-2"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)" }}
          >
            <span className="text-[13px] font-medium text-[var(--color-text)]">
              {t("Lepaskan kerusi luput automatik", "Auto-release expired holds")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoRelease}
              aria-label={t("Lepaskan kerusi luput automatik", "Auto-release expired holds")}
              onClick={() => setAutoRelease(!autoRelease)}
              className="relative h-5 w-9 rounded-[var(--radius-pill)] transition-colors"
              style={{ background: autoRelease ? "var(--color-primary)" : "var(--color-surface-muted)", border: "1px solid", borderColor: autoRelease ? "var(--color-primary)" : "var(--color-border-strong)" }}
            >
              <span
                className="absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all"
                style={{ left: autoRelease ? 18 : 2 }}
              />
            </button>
          </label>
        </div>,
      )}

      {/* Payments */}
      {sectionCard(
        t("Pembayaran", "Payments"),
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center rounded-[9px]"
          style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}
        >
          <Percent size={16} />
        </span>,
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {numberField("bd-deposit", "Deposit lalai", "Default deposit", depositPercent, setDepositPercent, 0, 100, "%", "%")}
            {numberField("bd-full", "Bayaran penuh sebelum keberangkatan", "Full payment before departure", fullPaymentDays, setFullPaymentDays, 1, 60, "hari", "days")}
            {numberField("bd-grace", "Tempoh tangguh bayaran tertunggak", "Overdue payment grace period", overdueGraceDays, setOverdueGraceDays, 0, 30, "hari", "days")}
          </div>
          <div className="pt-1" style={{ borderTop: "1px dashed var(--color-border)" }}>
            <p className="m-0 pt-3 text-[12.5px] font-medium text-[var(--color-text-secondary)]">
              {t("Kaedah pembayaran diterima", "Accepted payment methods")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {METHODS.map((m) => {
                const active = acceptMethods.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleMethod(m.id)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
                    style={
                      active
                        ? { background: "var(--color-primary-soft)", color: "var(--color-primary)", border: "1px solid color-mix(in srgb, var(--color-primary) 35%, var(--color-border))" }
                        : { background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" }
                    }
                  >
                    {active && <Check size={11} />}
                    {t(m.label.ms, m.label.en)}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
      )}

      {/* Trips */}
      {sectionCard(
        t("Trip", "Trips"),
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center rounded-[9px]"
          style={{ background: "var(--color-warning-soft)", color: "var(--color-warning)" }}
        >
          <CalendarClock size={16} />
        </span>,
        <div className="grid gap-4 md:grid-cols-2">
          {numberField("bd-checkin", "Masa daftar masuk lapangan terbang", "Airport check-in before departure", checkInHours, setCheckInHours, 1, 12, "jam", "hours")}
          {numberField("bd-minpax", "Pax minimum setiap tempahan", "Minimum pax per booking", minPax, setMinPax, 1, 20, "pax", "pax")}
        </div>,
      )}

      {/* Simulation card */}
      {sectionCard(
        t("Simulasi Tempahan", "Booking Simulation"),
        <span
          aria-hidden="true"
          className="grid h-[30px] w-[30px] place-items-center rounded-[9px]"
          style={{ background: "var(--color-neutral-soft)", color: "var(--color-text-secondary)" }}
        >
          <Wallet size={16} />
        </span>,
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t("Jumlah contoh", "Sample total"), value: formatNum(sampleTotal), tone: "neutral" as const },
              { label: t("Deposit ({n}%)", "Deposit ({n}%").replace("{n}", String(depositPercent)), value: formatNum(depositAmount), tone: "success" as const },
              { label: t("Baki selepas deposit", "Balance after deposit"), value: formatNum(balanceAmount), tone: "warning" as const },
              { label: t("Kerusi dipegang", "Seat held"), value: `${holdMinutes} ${t("minit", "min")}`, tone: "info" as const },
            ].map((item) => (
              <div
                key={item.label}
                className="flex flex-col gap-1.5 rounded-[var(--radius-card)] px-4 py-3"
                style={{
                  background:
                    item.tone === "success"
                      ? "var(--color-success-soft)"
                      : item.tone === "warning"
                        ? "var(--color-warning-soft)"
                        : item.tone === "info"
                          ? "var(--color-info-soft)"
                          : "var(--color-neutral-soft)",
                }}
              >
                <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-text-muted)]">
                  <BadgeCheck
                    size={12}
                    style={{
                      color:
                        item.tone === "success"
                          ? "var(--color-success)"
                          : item.tone === "warning"
                            ? "var(--color-warning)"
                            : item.tone === "info"
                              ? "var(--color-info)"
                              : "var(--color-text-muted)",
                    }}
                  />
                  {item.label}
                </span>
                <span
                  className="text-[16px] font-bold text-[var(--color-text)]"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
            {t(
              "Kadar deposit dan tempoh pegangan dikenakan serta-merta pada tempahan baharu.",
              "Deposit rate and hold duration apply immediately to new bookings.",
            )}
          </p>
        </>,
        t("Data contoh", "Sample data"),
      )}

      <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
        {t(
          "Data olok-olok — lalai tempahan sebenar akan didayakan pada fasa backend.",
          "Mock data — real booking defaults will be enabled in the backend phase.",
        )}
      </p>
    </div>
  );
}

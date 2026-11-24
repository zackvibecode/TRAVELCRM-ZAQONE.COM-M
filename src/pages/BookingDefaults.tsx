import { useState, type ReactNode } from "react";
import { BadgeCheck, CalendarClock, Check, Percent, Save, Timer, Wallet } from "lucide-react";
import { useLang } from "@/lib/i18n";

/** Tone warna untuk tile ikon / tile statistik — dipetakan ke token design system. */
type Tone = "primary" | "info" | "success" | "warning" | "neutral";

const TONE_BG: Record<Tone, string> = {
  primary: "bg-[var(--color-primary-soft)]",
  info: "bg-[var(--color-info-soft)]",
  success: "bg-[var(--color-success-soft)]",
  warning: "bg-[var(--color-warning-soft)]",
  neutral: "bg-[var(--color-neutral-soft)]",
};

const TONE_FG: Record<Tone, string> = {
  primary: "text-[var(--color-primary)]",
  info: "text-[var(--color-info)]",
  success: "text-[var(--color-success)]",
  warning: "text-[var(--color-warning)]",
  neutral: "text-[var(--color-text-secondary)]",
};

function IconTile({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span aria-hidden="true" className={`tv-icon-tile ${TONE_BG[tone]} ${TONE_FG[tone]}`}>
      {children}
    </span>
  );
}

function SettingsSection({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tv-panel" aria-label={title}>
      <div className="tv-panel__head">
        <h2 className="tv-panel__title flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle ? <span className="text-[12px] text-[var(--color-text-muted)]">{subtitle}</span> : null}
      </div>
      <div className="flex flex-col gap-4 p-5">{children}</div>
    </section>
  );
}

/** Butang Simpan yang bertukar ke keadaan "Disimpan" sekejap selepas disimpan. */
function SaveButton({ saved, onClick, idleLabel, savedLabel }: { saved: boolean; onClick: () => void; idleLabel: string; savedLabel: string }) {
  return (
    <button type="button" onClick={onClick} className="tv-btn tv-btn--primary" aria-live="polite">
      {saved ? <Check size={15} aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
      {saved ? savedLabel : idleLabel}
    </button>
  );
}

// Nilai lalai — backend settings API menyusul pada fasa backend.
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
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="tv-label flex items-center gap-1.5">
        {Icon && <Icon size={14} className="text-[var(--color-text-muted)]" aria-hidden="true" />}
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
          className="tv-input tabular-nums pl-[11px] pr-[52px]"
        />
        <span className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2 text-[12px] text-[var(--color-text-muted)]">
          {t(suffixMs, suffixEn)}
        </span>
      </div>
    </div>
  );

  // Simulation values
  const sampleTotal = 2480;
  const depositAmount = Math.round((sampleTotal * depositPercent) / 100);
  const balanceAmount = sampleTotal - depositAmount;
  const formatNum = (n: number) => `RM ${n.toLocaleString("en-MY")}`;

  const depositLabel = t("Deposit ({n}%)", "Deposit ({n}%)").replace("{n}", String(depositPercent));

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Lalai Tempahan", "Booking Defaults")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Nilai lalai untuk tempahan, pegangan kerusi dan pembayaran.",
              "Default values for bookings, seat holds and payments.",
            )}
          </p>
        </div>
        <SaveButton
          saved={saved}
          onClick={handleSave}
          idleLabel={t("Simpan", "Save")}
          savedLabel={t("Disimpan!", "Saved!")}
        />
      </div>

      {/* Seat holds */}
      <SettingsSection
        title={t("Pegangan Kerusi", "Seat Holds")}
        icon={
          <IconTile tone="info">
            <Timer size={16} />
          </IconTile>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {numberField("bd-hold", "Tempoh pegangan kerusi draf", "Draft seat hold duration", holdMinutes, setHoldMinutes, 5, 240, "minit", "minutes", Timer)}
          <label className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
            <span className="text-[13px] font-medium text-[var(--color-text)]">
              {t("Lepaskan kerusi luput automatik", "Auto-release expired holds")}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={autoRelease}
              aria-label={t("Lepaskan kerusi luput automatik", "Auto-release expired holds")}
              onClick={() => setAutoRelease(!autoRelease)}
              className={`relative h-5 w-9 rounded-[var(--radius-pill)] border transition-colors ${
                autoRelease
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                  : "border-[var(--color-border-strong)] bg-[var(--color-surface-muted)]"
              }`}
            >
              <span
                className="absolute top-[2px] h-4 w-4 rounded-full bg-white transition-[left] duration-150 ease-out"
                style={{ left: autoRelease ? 18 : 2 }}
              />
            </button>
          </label>
        </div>
      </SettingsSection>

      {/* Payments */}
      <SettingsSection
        title={t("Pembayaran", "Payments")}
        icon={
          <IconTile tone="success">
            <Percent size={16} />
          </IconTile>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {numberField("bd-deposit", "Deposit lalai", "Default deposit", depositPercent, setDepositPercent, 0, 100, "%", "%")}
          {numberField("bd-full", "Bayaran penuh sebelum keberangkatan", "Full payment before departure", fullPaymentDays, setFullPaymentDays, 1, 60, "hari", "days")}
          {numberField("bd-grace", "Tempoh tangguh bayaran tertunggak", "Overdue payment grace period", overdueGraceDays, setOverdueGraceDays, 0, 30, "hari", "days")}
        </div>
        <div className="border-t border-dashed border-[var(--color-border)] pt-3">
          <p className="m-0 text-[12.5px] font-medium text-[var(--color-text-secondary)]">
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
                  className="tv-chip focus-ring"
                >
                  {active ? <Check size={11} aria-hidden="true" /> : null}
                  {t(m.label.ms, m.label.en)}
                </button>
              );
            })}
          </div>
        </div>
      </SettingsSection>

      {/* Trips */}
      <SettingsSection
        title={t("Trip", "Trips")}
        icon={
          <IconTile tone="warning">
            <CalendarClock size={16} />
          </IconTile>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          {numberField("bd-checkin", "Masa daftar masuk lapangan terbang", "Airport check-in before departure", checkInHours, setCheckInHours, 1, 12, "jam", "hours")}
          {numberField("bd-minpax", "Pax minimum setiap tempahan", "Minimum pax per booking", minPax, setMinPax, 1, 20, "pax", "pax")}
        </div>
      </SettingsSection>

      {/* Simulation card */}
      <SettingsSection
        title={t("Simulasi Tempahan", "Booking Simulation")}
        subtitle={t("Data contoh", "Sample data")}
        icon={
          <IconTile tone="neutral">
            <Wallet size={16} />
          </IconTile>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("Jumlah contoh", "Sample total"), value: formatNum(sampleTotal), tone: "neutral" as Tone },
            { label: depositLabel, value: formatNum(depositAmount), tone: "success" as Tone },
            { label: t("Baki selepas deposit", "Balance after deposit"), value: formatNum(balanceAmount), tone: "warning" as Tone },
            { label: t("Kerusi dipegang", "Seat held"), value: `${holdMinutes} ${t("minit", "min")}`, tone: "info" as Tone },
          ].map((item) => (
            <div
              key={item.label}
              className={`flex flex-col gap-1.5 rounded-[var(--radius-card)] px-4 py-3 ${TONE_BG[item.tone]}`}
            >
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-text-muted)]">
                <BadgeCheck size={12} className={TONE_FG[item.tone]} aria-hidden="true" />
                {item.label}
              </span>
              <span className="text-[16px] font-bold tabular-nums text-[var(--color-text)]">{item.value}</span>
            </div>
          ))}
        </div>
        <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
          {t(
            "Kadar deposit dan tempoh pegangan dikenakan serta-merta pada tempahan baharu.",
            "Deposit rate and hold duration apply immediately to new bookings.",
          )}
        </p>
      </SettingsSection>

      <p className="m-0 text-[11.5px] text-[var(--color-text-muted)]">
        {t(
          "Nilai lalai ini digunakan oleh modul tempahan semasa membuat tempahan baharu.",
          "These defaults are used by the bookings module when creating a new booking.",
        )}
      </p>
    </div>
  );
}

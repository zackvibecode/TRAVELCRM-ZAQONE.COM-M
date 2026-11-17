import { useEffect, useMemo, useState } from "react";
import {
  FileDown,
  Plus,
  ArrowUp,
  ExternalLink,
} from "lucide-react";
import { fetchDepartures, fetchPackages } from "@/lib/live-data";
import {
  departureStatusLabels,
  type Departure,
} from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import DepartureDetail from "@/components/DepartureDetail";
import NewDepartureDialog from "@/components/NewDepartureDialog";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const STATUS_TONE: Record<
  Departure["status"],
  { bg: string; fg: string }
> = {
  open: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  almost_full: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  full: { bg: "var(--color-danger-soft)", fg: "var(--color-danger)" },
  closed: {
    bg: "var(--color-neutral-soft)",
    fg: "var(--color-text-secondary)",
  },
};

function allSeats(capacity: number): string[] {
  const rows = Math.ceil(capacity / 6);
  const seats: string[] = [];
  for (let r = 1; r <= rows; r += 1) {
    LETTERS.forEach((letter) => {
      if (seats.length < capacity) seats.push(`${r}${letter}`);
    });
  }
  return seats;
}

function Badge({
  tone,
  children,
}: {
  tone: keyof typeof STATUS_TONE | "info" | "neutral" | "warning";
  children: React.ReactNode;
}) {
  const palette =
    tone === "info"
      ? { bg: "var(--color-info-soft)", fg: "var(--color-info)" }
      : tone === "neutral"
        ? { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" }
        : tone === "warning"
          ? { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" }
          : STATUS_TONE[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {children}
    </span>
  );
}

function CardHead({
  title,
  aside,
}: {
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
      <h2 className="m-0 text-[14.5px] font-semibold">{title}</h2>
      {aside}
    </div>
  );
}

export default function TripsDashboard() {
  const { t } = useLang();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [heldSeats, setHeldSeats] = useState<Record<string, string[]>>({});
  const [selectedDeparture, setSelectedDeparture] =
    useState<Departure | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);

  // Live departures + packages from D1 (falls back to mock in loaders).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [d, p] = await Promise.all([fetchDepartures(), fetchPackages()]);
      if (cancelled) return;
      setDepartures(d.departures);
      setPackages(p.packages.map((item) => ({ id: item.id, name: item.name })));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const packageName = (packageId: string) =>
    packages.find((p) => p.id === packageId)?.name ?? "—";

  const active = useMemo(
    () => departures.find((d) => d.id === activeId) ?? departures[0],
    [departures, activeId],
  );
  const seats = useMemo(
    () => (active ? allSeats(active.seatCapacity) : []),
    [active],
  );
  const used = active ? active.seatsBooked + active.seatsHeld : 0;
  const occupancy = active
    ? Math.round((used / active.seatCapacity) * 100)
    : 0;
  const available = active ? active.seatCapacity - used : 0;

  const heldFor = (id: string) => heldSeats[id] ?? [];
  const seatState = (seat: string): "booked" | "held" | "open" => {
    if (!active) return "open";
    // First N seats by index are treated as booked from the live count.
    const idx = seats.indexOf(seat);
    if (idx >= 0 && idx < active.seatsBooked) return "booked";
    if (idx >= active.seatsBooked && idx < active.seatsBooked + active.seatsHeld)
      return "held";
    if (heldFor(active.id).includes(seat)) return "held";
    return "open";
  };

  const toggleSeat = (seat: string) => {
    if (!active) return;
    if (seatState(seat) === "booked") return;
    setPicked(seat);
    setHeldSeats((prev) => {
      const current = prev[active.id] ?? [];
      const isHeld = current.includes(seat);
      return {
        ...prev,
        [active.id]: isHeld
          ? current.filter((s) => s !== seat)
          : [...current, seat],
      };
    });
  };

  const ringgit = (v: number) => `RM ${v.toLocaleString("en-MY")}`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Page head */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 font-display text-2xl font-bold leading-tight tracking-tight">
            {t("Trip & Kerusi", "Trips & Seats")}
          </h1>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            {t(
              "Rancang keberangkatan, jejak ketersediaan kerusi, sediakan penumpang dan lihat keuntungan trip.",
              "Plan departures, track seat availability, prepare passengers, and see trip profit.",
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-semibold hover:bg-[var(--color-surface-muted)]"
          >
            <FileDown className="h-3.5 w-3.5" />
            {t("Manifest", "Manifest")}
          </button>
          <button
            type="button"
            onClick={() => setShowNewDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("Keberangkatan Baharu", "New Departure")}
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* Left column: departure list + seat map */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="min-w-0 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <CardHead
              title={t("Keberangkatan Akan Datang", "Upcoming departures")}
              aside={
                <Badge tone="neutral">
                  {departures.length} {t("akan datang", "upcoming")}
                </Badge>
              }
            />
            <div role="group" aria-label={t("Pilih keberangkatan", "Select a departure")}>
              {departures.length === 0 && (
                <p className="px-5 py-6 text-center text-[13px] text-muted-foreground">
                  {t("Tiada keberangkatan.", "No departures yet.")}
                </p>
              )}
              {departures.map((d) => {
                const usedCount = d.seatsBooked + d.seatsHeld;
                const pct = Math.round((usedCount / d.seatCapacity) * 100);
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={active?.id === d.id}
                    onClick={() => {
                      setActiveId(d.id);
                      setPicked(null);
                    }}
                    className="grid w-full grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(110px,0.9fr)_auto] items-center gap-3 border-t border-[var(--color-border)] border-l-[3px] border-l-transparent px-5 py-3 text-left font-inherit transition-colors first:border-t-0 hover:bg-[var(--color-surface-raised)] aria-pressed:border-l-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)] max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-y-2"
                  >
                    <div className="min-w-0 max-md:col-span-2">
                      <div className="truncate text-[13px] font-semibold">
                        {packageName(d.packageId)}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {d.id}
                      </div>
                    </div>
                    <div className="min-w-0 text-[12px] text-[var(--color-text-secondary)] max-md:col-span-2 max-md:row-start-2">
                      <div>{formatDate(d.departureDate)}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {d.tourLeader ?? "—"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          {usedCount}/{d.seatCapacity}
                        </span>
                        <span className="[font-variant-numeric:tabular-nums]">
                          {pct}%
                        </span>
                      </div>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background:
                              pct >= 85
                                ? "var(--color-warning)"
                                : "var(--color-primary)",
                          }}
                        />
                      </span>
                    </div>
                    <Badge tone={d.status}>
                      {departureStatusLabels[d.status]}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Seat map */}
          {active && (
            <section className="min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <CardHead
                title={`${t("Peta Kerusi", "Seat map")} · ${active.id}`}
                aside={
                  <Badge tone={occupancy >= 85 ? "warning" : "info"}>
                    {occupancy}% {t("penuh", "filled")}
                  </Badge>
                }
              />
              <div className="px-5 pb-5 pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
                  <span>
                    {ringgit(active.adultPrice)} · {t("dewasa", "adult")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ArrowUp className="h-3.5 w-3.5" /> Cockpit
                  </span>
                </div>
                <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                  <ul className="grid min-w-0 grid-cols-6 gap-2 p-0">
                    {seats.map((seat) => {
                      const status = seatState(seat);
                      return (
                        <li key={seat} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleSeat(seat)}
                            aria-pressed={picked === seat}
                            aria-label={
                              status === "booked"
                                ? `${seat} ${t("diduduki", "occupied")}`
                                : status === "held"
                                  ? `${seat} ${t("ditahan", "on hold")}`
                                  : `${seat} ${t("tersedia", "available")}`
                            }
                            className={`grid aspect-square min-h-[34px] w-full place-items-center rounded-lg border text-[11px] font-semibold transition-colors ${
                              status === "booked"
                                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                                : status === "held"
                                  ? "border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]"
                                  : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                            }`}
                          >
                            {seat}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded border border-[var(--color-border-strong)] bg-[var(--color-surface)]" />{" "}
                    {t("Tersedia", "Available")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-[var(--color-primary)]" />{" "}
                    {t("Diduduki", "Occupied")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded border border-[var(--color-warning)] bg-[var(--color-warning-soft)]" />{" "}
                    {t("Ditahan", "On hold")}
                  </span>
                </div>
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
                  {t(
                    "Pilih kerusi terbuka untuk ditahan, pilih sekali lagi untuk melepaskannya. Kerusi diduduki tidak boleh diubah.",
                    "Select an open seat to place it on hold, select it again to release. Occupied seats are locked.",
                  )}
                </p>
                <div
                  className="mt-4 min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-[12.5px]"
                  aria-live="polite"
                >
                  {picked ? (
                    <span className="text-[var(--color-text-secondary)]">
                      <strong>{picked}</strong>{" "}
                      {seatState(picked) === "held"
                        ? t("ditahan dan boleh dilepaskan.", "is on hold and can be released.")
                        : t("kini ditahan buat sementara.", "is now on a temporary hold.")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t(
                        "Pilih kerusi untuk melihat penumpang atau menahannya.",
                        "Select a seat to see the passenger or place it on hold.",
                      )}
                    </span>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Right column: summary */}
        <div className="flex min-w-0 flex-col gap-4">
          {active && (
            <section className="min-w-0 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <CardHead
                title={t("Ringkasan Trip", "Trip summary")}
                aside={<Badge tone={active.status}>{departureStatusLabels[active.status]}</Badge>}
              />
              <div className="flex flex-col gap-4 p-5">
                <dl className="m-0 grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
                  <dt className="text-muted-foreground">{t("Pakej", "Package")}</dt>
                  <dd className="m-0 font-medium">{packageName(active.packageId)}</dd>
                  <dt className="text-muted-foreground">{t("Tarikh", "Date")}</dt>
                  <dd className="m-0 font-medium">{formatDate(active.departureDate)}</dd>
                  <dt className="text-muted-foreground">{t("Ketua Tour", "Tour leader")}</dt>
                  <dd className="m-0 font-medium">{active.tourLeader ?? "—"}</dd>
                </dl>
                <div className="grid grid-cols-3 gap-3">
                  <div className="min-w-0 rounded-xl bg-[var(--color-primary-soft)] p-3">
                    <div className="text-[11px] text-[var(--color-text-secondary)]">
                      {t("Diduduki", "Occupied")}
                    </div>
                    <strong className="text-[18px] [font-variant-numeric:tabular-nums]">
                      {active.seatsBooked}
                    </strong>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[var(--color-warning-soft)] p-3">
                    <div className="text-[11px] text-[var(--color-text-secondary)]">
                      {t("Ditahan", "On hold")}
                    </div>
                    <strong className="text-[18px] [font-variant-numeric:tabular-nums]">
                      {active.seatsHeld + heldFor(active.id).length}
                    </strong>
                  </div>
                  <div className="min-w-0 rounded-xl bg-[var(--color-surface-muted)] p-3">
                    <div className="text-[11px] text-[var(--color-text-secondary)]">
                      {t("Tersedia", "Available")}
                    </div>
                    <strong className="text-[18px] [font-variant-numeric:tabular-nums]">
                      {available}
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDeparture(active)}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[12.5px] font-semibold hover:bg-[var(--color-surface-muted)]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("Butiran Keberangkatan", "Departure details")}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>

      <DepartureDetail
        departure={selectedDeparture}
        open={selectedDeparture !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDeparture(null);
        }}
      />
      <NewDepartureDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreate={(departure) => {
          setDepartures((prev) => [departure, ...prev]);
          setActiveId(departure.id);
        }}
      />
    </div>
  );
}

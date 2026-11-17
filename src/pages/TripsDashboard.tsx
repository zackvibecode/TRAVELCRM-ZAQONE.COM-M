import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, ExternalLink, FileDown, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import NewDepartureDialog from "@/components/NewDepartureDialog";
import type { Departure } from "@/lib/types";

// ---------------------------------------------------------------- constants

const LETTERS = ["A", "B", "C", "D", "E", "F"];

type Tone = "success" | "warning" | "info" | "neutral";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  warning: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  info: { bg: "var(--color-info-soft)", fg: "var(--color-info)" },
  neutral: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
};

interface PrototypeTrip {
  id: string;
  pkg: string;
  route: string;
  date: string;
  leader: string;
  capacity: number;
  aircraft: string;
  booked: string[];
  held: string[];
  status: string;
  tone: Tone;
}

const TRIPS: PrototypeTrip[] = [
  {
    id: "DP-4471",
    pkg: "Japan Sakura 8D7N",
    route: "KUL → HND",
    date: "12 Dec 2025",
    leader: "Rina Pratiwi",
    capacity: 18,
    aircraft: "Airbus A320",
    booked: ["1A", "1B", "1C", "2A", "2C", "2D", "3A", "3B", "3D", "4A", "4B", "4C", "5A"],
    held: ["1D", "2B"],
    status: "Almost full",
    tone: "warning",
  },
  {
    id: "DP-4482",
    pkg: "Turkey Istanbul 9D8N",
    route: "KUL → IST",
    date: "18 Dec 2025",
    leader: "Bagas Santoso",
    capacity: 18,
    aircraft: "Boeing 777",
    booked: ["1A", "1B", "2A", "2B", "2C", "3A", "3C", "4A", "4B", "5C"],
    held: ["3B"],
    status: "On track",
    tone: "success",
  },
  {
    id: "DP-4490",
    pkg: "Korea Autumn 6D5N",
    route: "KUL → ICN",
    date: "23 Dec 2025",
    leader: "Dewi Lestari",
    capacity: 18,
    aircraft: "Airbus A330",
    booked: ["1A", "1B", "1C", "1D", "2A", "2C", "2D", "3A", "3B", "3C", "4A", "4C", "5A", "5B", "5C"],
    held: ["2B", "4B"],
    status: "Almost full",
    tone: "warning",
  },
  {
    id: "DP-4501",
    pkg: "Bali Premium 4D3N",
    route: "KUL → DPS",
    date: "28 Dec 2025",
    leader: "Yoga Aditya",
    capacity: 18,
    aircraft: "Boeing 737",
    booked: ["1A", "1B", "2A", "2C", "3A"],
    held: [],
    status: "On track",
    tone: "success",
  },
];

interface Passenger {
  seat: string;
  name: string;
  booking: string;
}

const PASSENGERS: Record<string, Passenger[]> = {
  "DP-4471": [
    { seat: "1A", name: "Hendra Wijaya", booking: "TRV-2025-0481" },
    { seat: "1B", name: "Laras Wijaya", booking: "TRV-2025-0481" },
    { seat: "2A", name: "Rani Puspita", booking: "TRV-2025-0477" },
    { seat: "2B", name: "Dimas Saputra", booking: "TRV-2025-0477" },
    { seat: "4A", name: "Siti Nurhaliza", booking: "TRV-2025-0464" },
  ],
  "DP-4482": [
    { seat: "1A", name: "Siti Nurhaliza", booking: "TRV-2025-0480" },
    { seat: "2A", name: "Bambang Sutrisno", booking: "TRV-2025-0475" },
    { seat: "2B", name: "Sri Sutrisno", booking: "TRV-2025-0475" },
    { seat: "3A", name: "Aditya Nugroho", booking: "TRV-2025-0461" },
  ],
  "DP-4490": [
    { seat: "3A", name: "Kel. Gunawan", booking: "TRV-2025-0479" },
    { seat: "1A", name: "Melati Kusuma", booking: "TRV-2025-0468" },
    { seat: "1B", name: "Yusuf Kusuma", booking: "TRV-2025-0468" },
    { seat: "2A", name: "Tegar Priambodo", booking: "TRV-2025-0459" },
  ],
  "DP-4501": [
    { seat: "1A", name: "Andi Pratama", booking: "TRV-2025-0478" },
    { seat: "2A", name: "Dewi Anggraini", booking: "TRV-2025-0467" },
    { seat: "3A", name: "Fajar Ramadhan", booking: "TRV-2025-0452" },
  ],
};

// ---------------------------------------------------------------- helpers

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

function initials(name: string): string {
  const parts = name.replace("Kel. ", "").split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

// ---------------------------------------------------------------- ui atoms

function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  const palette = TONE[tone] ?? TONE.neutral;
  return (
    <span
      className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-w-0 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-[var(--radius-panel)]">
      {children}
    </section>
  );
}

function CardHead({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
      <h2 className="m-0 text-[14.5px] font-semibold">{title}</h2>
      {aside}
    </div>
  );
}

// ---------------------------------------------------------------- page

export default function TripsDashboard() {
  const { t } = useLang();
  const [activeId, setActiveId] = useState<string>("DP-4471");
  const [picked, setPicked] = useState<string | null>(null);
  const [seatStateMap, setSeatStateMap] = useState<Record<string, { booked: string[]; held: string[] }>>(() =>
    Object.fromEntries(TRIPS.map((trip) => [trip.id, { booked: trip.booked, held: trip.held }])),
  );
  const [liveDepartures, setLiveDepartures] = useState<Departure[]>([]);
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Live departures from D1 (falls back to mock in loader). Seat-map,
  // leader and passenger details are static prototype data.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchDepartures } = await import("@/lib/live-data");
        const res = await fetchDepartures();
        if (!cancelled) setLiveDepartures(res.departures);
      } catch {
        /* live data unavailable — static prototype data remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge live counts into the prototype trips (when a departure with the
  // same id exists in D1, its seat counts override the static ones).
  const trips: PrototypeTrip[] = useMemo(
    () =>
      TRIPS.map((trip) => {
        const live = liveDepartures.find((d) => d.id === trip.id);
        if (!live) return trip;
        const capacity = live.seatCapacity || trip.capacity;
        const used = Math.min(live.seatsBooked + live.seatsHeld, capacity);
        const bookedFromIndex = Math.min(live.seatsBooked, used);
        const seats = allSeats(capacity);
        return {
          ...trip,
          capacity,
          date: formatDate(live.departureDate),
          leader: live.tourLeader ?? trip.leader,
          booked: seats.slice(0, bookedFromIndex),
          held: seats.slice(bookedFromIndex, used),
          status: live.status === "open" ? "On track" : "Almost full",
          tone: (live.status === "open" ? "success" : "warning") as Tone,
        };
      }),
    [liveDepartures],
  );

  const active = trips.find((trip) => trip.id === activeId) ?? trips[0];
  const tripState = seatStateMap[active.id] ?? { booked: active.booked, held: active.held };
  const seats = useMemo(() => allSeats(active.capacity), [active.capacity]);
  const passengerFor = (seat: string) => (PASSENGERS[active.id] ?? []).find((person) => person.seat === seat);
  const taken = tripState.booked.length + tripState.held.length;
  const occupancy = Math.round((taken / active.capacity) * 100);
  const pickedPerson = picked ? passengerFor(picked) : null;

  const toggleSeat = (seat: string) => {
    setPicked(seat);
    if (tripState.booked.includes(seat)) return;
    setSeatStateMap((prev) => {
      const current = prev[active.id] ?? { booked: active.booked, held: active.held };
      const isHeld = current.held.includes(seat);
      return {
        ...prev,
        [active.id]: {
          booked: current.booked,
          held: isHeld ? current.held.filter((item) => item !== seat) : [...current.held, seat],
        },
      };
    });
  };

  const seatState = (seat: string): "booked" | "held" | "open" => {
    if (tripState.booked.includes(seat)) return "booked";
    if (tripState.held.includes(seat)) return "held";
    return "open";
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 text-[var(--color-text)]">
      {/* Page head */}
      <div className="tvl-pagehead">
        <div className="min-w-0">
          <h1 className="tvl-title">{t("Trip & Kerusi", "Trips & Seats")}</h1>
          <p className="tvl-subtitle">
            {t(
              "Jejak okupansi keberangkatan dan peruntukan kerusi penumpang",
              "Track departure occupancy and passenger seat allocation",
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-semibold hover:bg-[var(--color-surface-muted)]"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
            {t("Manifest", "Manifest")}
          </button>
          <button
            type="button"
            onClick={() => setShowNewDialog(true)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-2 text-[12.5px] font-semibold text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("Keberangkatan Baharu", "New departure")}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid min-w-0 items-start grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHead
              title={t("Keberangkatan Akan Datang", "Upcoming departures")}
              aside={
                <Badge tone="neutral">
                  {trips.length} {t("akan datang", "upcoming")}
                </Badge>
              }
            />
            <div className="flex min-w-0 flex-col" role="group" aria-label={t("Pilih keberangkatan", "Select a departure")}>
              {trips.map((trip) => {
                const tripInfo = seatStateMap[trip.id] ?? { booked: trip.booked, held: trip.held };
                const usedCount = tripInfo.booked.length + tripInfo.held.length;
                const pct = Math.round((usedCount / trip.capacity) * 100);
                return (
                  <button
                    key={trip.id}
                    type="button"
                    aria-pressed={activeId === trip.id}
                    onClick={() => {
                      setActiveId(trip.id);
                      setPicked(null);
                    }}
                    className="grid w-full grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(110px,0.9fr)_auto] items-center gap-3 border-0 border-r-0 border-b-0 border-t border-t-[var(--color-border)] border-l-[3px] border-l-transparent bg-transparent px-5 py-3 text-left font-inherit text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] first:border-t-0 aria-pressed:border-l-[var(--color-primary)] aria-pressed:bg-[var(--color-primary-soft)] max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-y-2 max-md:[&>:nth-child(1)]:col-span-2 max-md:[&>:nth-child(2)]:col-span-2 max-md:[&>:nth-child(2)]:row-start-2 max-md:[&>:nth-child(3)]:col-start-1 max-md:[&>:nth-child(3)]:row-start-3 max-md:[&>:nth-child(4)]:col-start-2 max-md:[&>:nth-child(4)]:row-start-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold">{trip.pkg}</div>
                      <div className="text-[11.5px] text-[var(--color-text-muted)]">
                        {trip.id} · {trip.route}
                      </div>
                    </div>
                    <div className="min-w-0 text-[12px] text-[var(--color-text-secondary)]">
                      <div>{trip.date}</div>
                      <div className="text-[11.5px] text-[var(--color-text-muted)]">{trip.leader}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex justify-between text-[11px] text-[var(--color-text-muted)]">
                        <span>
                          {usedCount}/{trip.capacity}
                        </span>
                        <span className="[font-variant-numeric:tabular-nums]">{pct}%</span>
                      </div>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: pct >= 85 ? "var(--color-warning)" : "var(--color-primary)",
                          }}
                        />
                      </span>
                    </div>
                    <Badge tone={trip.tone}>{trip.status}</Badge>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Seat map */}
          <Card>
            <CardHead
              title={`${t("Peta Kerusi", "Seat map")} · ${active.id}`}
              aside={
                <Badge tone={occupancy >= 85 ? "warning" : "info"}>
                  {occupancy}% {t("penuh", "filled")}
                </Badge>
              }
            />
            <div className="px-5 pb-5 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-[var(--color-text-muted)]">
                <span>
                  {active.aircraft} · {active.route}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> {t("Kokpit", "Cockpit")}
                </span>
              </div>
              <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <ul
                  className="m-0 grid min-w-0 list-none grid-cols-6 gap-2 p-0"
                  aria-label={`${t("Kerusi untuk", "Seats for")} ${active.id}`}
                >
                  {seats.map((seat) => {
                    const status = seatState(seat);
                    const person = passengerFor(seat);
                    const label =
                      status === "booked"
                        ? `${t("Kerusi", "Seat")} ${seat}, ${person ? person.name : t("diduduki", "occupied")}`
                        : status === "held"
                          ? `${t("Kerusi", "Seat")} ${seat}, ${t("ditahan", "on hold")}`
                          : `${t("Kerusi", "Seat")} ${seat}, ${t("tersedia", "available")}`;
                    return (
                      <li key={seat} className="min-w-0">
                        <button
                          type="button"
                          data-state={status}
                          aria-pressed={picked === seat}
                          aria-label={label}
                          onClick={() => toggleSeat(seat)}
                          className="grid aspect-square min-h-[34px] w-full cursor-pointer place-items-center rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-0 font-inherit text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] aria-pressed:shadow-[0_0_0_2px_var(--color-text)] data-[state=booked]:border-[var(--color-primary)] data-[state=booked]:bg-[var(--color-primary)] data-[state=booked]:text-[var(--color-on-primary)] data-[state=held]:border-[var(--color-warning)] data-[state=held]:bg-[var(--color-warning-soft)] data-[state=held]:text-[var(--color-warning)]"
                        >
                          {seat}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded border border-[var(--color-border-strong)] bg-[var(--color-surface)]" />
                  {t("Tersedia", "Available")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ background: "var(--color-primary)", borderColor: "var(--color-primary)" }}
                  />
                  {t("Diduduki", "Occupied")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ background: "var(--color-warning-soft)", borderColor: "var(--color-warning)" }}
                  />
                  {t("Ditahan", "On hold")}
                </span>
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--color-text-muted)]">
                {t(
                  "Pilih kerusi terbuka untuk ditahan, pilih sekali lagi untuk melepaskannya. Kerusi diduduki tidak boleh diubah.",
                  "Select an open seat to place it on hold, select it again to release. Occupied seats are locked.",
                )}
              </p>
              <div
                className="mt-4 min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] px-3.5 py-3 text-[12.5px]"
                style={{
                  background: pickedPerson ? "var(--color-surface-raised)" : "var(--color-surface)",
                }}
                aria-live="polite"
              >
                {picked ? (
                  pickedPerson ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--color-surface-muted)] text-[10.5px] font-bold text-[var(--color-text-secondary)]"
                        aria-hidden="true"
                      >
                        {initials(pickedPerson.name)}
                      </span>
                      <div className="min-w-0">
                        <strong className="block">{pickedPerson.name}</strong>
                        <span className="text-[var(--color-text-muted)]">
                          {t("Kerusi", "Seat")} {pickedPerson.seat} · {pickedPerson.booking}
                        </span>
                      </div>
                      <Link
                        to={`/bookings?ref=${pickedPerson.booking}`}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[12.5px] font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                        style={{ textDecoration: "none" }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("Lihat Tempahan", "View booking")}
                      </Link>
                    </div>
                  ) : (
                    <span className="text-[var(--color-text-secondary)]">
                      {t("Kerusi", "Seat")} <strong>{picked}</strong>{" "}
                      {tripState.held.includes(picked)
                        ? t("ditahan dan boleh dilepaskan.", "is on hold and can be released.")
                        : t("kini ditahan buat sementara. Pilih sekali lagi untuk melepaskan.", "is now on a temporary hold. Select it again to release.")}
                    </span>
                  )
                ) : (
                  <span className="text-[var(--color-text-muted)]">
                    {t(
                      "Pilih kerusi untuk melihat penumpang atau menahannya.",
                      "Select a seat to see the passenger or place it on hold.",
                    )}
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHead
              title={t("Ringkasan Trip", "Trip summary")}
              aside={<Badge tone={active.tone}>{active.status}</Badge>}
            />
            <div className="flex flex-col gap-4 p-5">
              <dl className="m-0 grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12.5px]">
                <dt className="text-[var(--color-text-muted)]">{t("Pakej", "Package")}</dt>
                <dd className="m-0 break-words font-medium">{active.pkg}</dd>
                <dt className="text-[var(--color-text-muted)]">{t("Laluan", "Route")}</dt>
                <dd className="m-0 break-words font-medium">{active.route}</dd>
                <dt className="text-[var(--color-text-muted)]">{t("Tarikh", "Date")}</dt>
                <dd className="m-0 break-words font-medium">{active.date}</dd>
                <dt className="text-[var(--color-text-muted)]">{t("Ketua Tour", "Tour leader")}</dt>
                <dd className="m-0 break-words font-medium">{active.leader}</dd>
              </dl>
              <div className="grid grid-cols-3 gap-3">
                <div className="min-w-0 rounded-[var(--radius-card)] bg-[var(--color-primary-soft)] px-3 py-2.5">
                  <div className="text-[11px] text-[var(--color-text-secondary)]">{t("Diduduki", "Occupied")}</div>
                  <strong className="text-[18px] [font-variant-numeric:tabular-nums]">{tripState.booked.length}</strong>
                </div>
                <div className="min-w-0 rounded-[var(--radius-card)] bg-[var(--color-warning-soft)] px-3 py-2.5">
                  <div className="text-[11px] text-[var(--color-text-secondary)]">{t("Ditahan", "On hold")}</div>
                  <strong className="text-[18px] [font-variant-numeric:tabular-nums]">{tripState.held.length}</strong>
                </div>
                <div className="min-w-0 rounded-[var(--radius-card)] bg-[var(--color-surface-muted)] px-3 py-2.5">
                  <div className="text-[11px] text-[var(--color-text-secondary)]">{t("Tersedia", "Available")}</div>
                  <strong className="text-[18px] [font-variant-numeric:tabular-nums]">{active.capacity - taken}</strong>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead
              title={t("Penumpang", "Passengers")}
              aside={<Badge tone="neutral">{(PASSENGERS[active.id] ?? []).length}</Badge>}
            />
            <ul className="m-0 list-none p-0">
              {(PASSENGERS[active.id] ?? []).map((person) => (
                <li
                  key={`${person.booking}-${person.seat}`}
                  className="flex items-center gap-2.5 border-t border-[var(--color-border)] px-5 py-2.5 first:border-t-0"
                >
                  <span
                    className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--color-surface-muted)] text-[10.5px] font-bold text-[var(--color-text-secondary)]"
                    aria-hidden="true"
                  >
                    {initials(person.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{person.name}</div>
                    <div className="text-[11.5px] text-[var(--color-text-muted)]">{person.booking}</div>
                  </div>
                  <span className="ml-auto whitespace-nowrap rounded-[5px] bg-[var(--color-surface-muted)] px-[7px] py-0.5 font-mono text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    {person.seat}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <NewDepartureDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreate={(departure) => {
          setLiveDepartures((prev) => [departure, ...prev]);
          setActiveId(departure.id);
        }}
      />
    </div>
  );
}

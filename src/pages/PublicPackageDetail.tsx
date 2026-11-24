import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Users,
} from "lucide-react";
import type { Departure, TravelPackage } from "@/lib/types";
import { formatRinggit } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { useBranding, whatsappUrl } from "@/lib/useBranding";
import { apiFetch } from "@/lib/api";

const COVER =
  "https://images.unsplash.com/photo-1493780474015-ba834fd0ce2f?auto=format&fit=crop&w=1400&q=72";

const IMG_BY_DEST: Record<string, string> = {
  Japan: COVER,
  Korea: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=1400&q=72",
  Lombok: "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?auto=format&fit=crop&w=1400&q=72",
  Bromo: "https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1400&q=72",
  "Raja Ampat": "https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format&fit=crop&w=1400&q=72",
  Bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1400&q=72",
  Turkey: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1400&q=72",
};

const STATIC_PRICE = { adult: 0, child: 0, infant: 0 };

function ringgit(value: number): string {
  return formatRinggit(value);
}

function seatInfo(dep: Departure): { bg: string; fg: string; label: string } {
  if (dep.status === "full" || seatsLeft(dep) === 0)
    return {
      bg: "var(--color-neutral-soft)",
      fg: "var(--color-text-secondary)",
      label: "Full",
    };
  const seats = seatsLeft(dep);
  if (seats <= 3)
    return { bg: "var(--color-danger-soft)", fg: "var(--color-danger)", label: `${seats} seats left` };
  if (seats <= 8)
    return { bg: "var(--color-warning-soft)", fg: "var(--color-warning)", label: `${seats} seats left` };
  return { bg: "var(--color-success-soft)", fg: "var(--color-success)", label: `${seats} seats left` };
}

function seatsLeft(dep: Departure): number {
  return Math.max(0, dep.seatCapacity - dep.seatsBooked - dep.seatsHeld);
}

function fmtDate(value: string, locale: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-label-md font-semibold text-[var(--color-text-secondary)]">
        {label}
      </label>
      {children}
      {error ? (
        <p className="m-0 text-caption text-[var(--color-danger)]">{error}</p>
      ) : null}
    </div>
  );
}

export default function PublicPackageDetail() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const branding = useBranding();
  const waUrl = whatsappUrl(branding);
  const locale = lang === "ms" ? "ms-MY" : "en-GB";

  const [pkg, setPkg] = useState<TravelPackage | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDep, setSelectedDep] = useState("");
  const [openDays, setOpenDays] = useState<number[]>([0]);
  const [pax, setPax] = useState({ adult: 2, child: 0, infant: 0 });
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lead, setLead] = useState<{ ref: string; dep: string; pax: number } | null>(null);
  const [sending, setSending] = useState(false);

  // Live package + departures from D1.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchPackage, fetchDepartures } = await import("@/lib/live-data");
        const [found, d] = await Promise.all([
          id ? fetchPackage(id) : Promise.resolve(null),
          fetchDepartures(),
        ]);
        if (cancelled) return;
        setPkg(found);
        const rows = d.departures
          .filter((dep) => !found || dep.packageId === found.id)
          .slice(0, 6);
        setDepartures(rows);
        setSelectedDep(rows.find((row) => seatsLeft(row) > 0)?.id ?? rows[0]?.id ?? "");
      } catch {
        /* live data unavailable — show empty state */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dep = departures.find((item) => item.id === selectedDep) ?? departures[0];
  const prices = {
    adult: dep?.adultPrice || pkg?.adultPrice || STATIC_PRICE.adult,
    child: dep?.childPrice || pkg?.childPrice || STATIC_PRICE.child,
    infant: pkg?.infantPrice || STATIC_PRICE.infant,
  };
  const totalPax = pax.adult + pax.child + pax.infant;
  const subtotal = pax.adult * prices.adult + pax.child * prices.child + pax.infant * prices.infant;
  const deposit = Math.round(subtotal * 0.3);
  const availableSeats = dep ? seatsLeft(dep) : null;
  const exceedsSeats = availableSeats !== null && totalPax > availableSeats;

  const itinerary = pkg?.itinerary?.length
    ? pkg.itinerary.map((d) => ({
        title: d.title,
        body: d.description,
        tags: d.meals ?? [],
      }))
    : [];

  const highlights = pkg?.highlights?.length ? pkg.highlights : [];
  const inclusions = pkg?.inclusions?.length ? pkg.inclusions : [];
  const exclusions = pkg?.exclusions?.length ? pkg.exclusions : [];
  const name = pkg?.name ?? "Japan Sakura 7D6N";
  const destination = pkg?.destination ?? "Japan";
  const durationDays = pkg?.durationDays ?? 7;
  const cover = pkg?.images?.[0] ?? IMG_BY_DEST[destination] ?? COVER;

  function toggleDay(index: number) {
    setOpenDays((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index],
    );
  }

  function ubahPax(key: keyof typeof pax, delta: number) {
    setPax((current) => {
      const min = key === "adult" ? 1 : 0;
      return { ...current, [key]: Math.max(min, current[key] + delta) };
    });
  }

  function ubahField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function kirim(event: React.FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 3)
      next.name = t("Sila masukkan sekurang-kurangnya 3 aksara.", "Please enter at least 3 characters.");
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 9)
      next.phone = t(
        "Masukkan nombor WhatsApp yang boleh dihubungi.",
        "Enter a WhatsApp number we can reach you on.",
      );
    if (form.email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = t("Alamat emel tidak sah.", "That email address is not valid.");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    // Send the real enquiry to the CRM as a Website lead (PRD req #9).
    setSending(true);
    try {
      const res = await apiFetch<{ lead?: { id?: string } }>(
        "/website/enquiries",
        {
          method: "POST",
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim() || undefined,
            packageName: name,
            pax: totalPax,
            message: [
              form.note.trim(),
              `Departure: ${dep ? fmtDate(dep.departureDate, locale) : "—"}`,
              `Est. total: ${ringgit(subtotal)}`,
            ]
              .filter(Boolean)
              .join(" · "),
          }),
        },
      );
      setLead({
        ref: res.lead?.id ?? "—",
        dep: dep ? fmtDate(dep.departureDate, locale) : "—",
        pax: totalPax,
      });
      setForm({ name: "", phone: "", email: "", note: "" });
    } catch {
      setErrors((prev) => ({
        ...prev,
        name: t(
          "Gagal menghantar pertanyaan. Sila cuba lagi atau hubungi kami di WhatsApp.",
          "Failed to send the enquiry. Please try again or reach us on WhatsApp.",
        ),
      }));
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-[var(--color-surface)]">
        <div className="mx-auto max-w-site px-4 md:px-6 py-24 text-center text-sm text-[var(--color-text-muted)]">
          {t("Sedang memuatkan pakej…", "Loading package…")}
        </div>
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="bg-[var(--color-surface)]">
        <div className="mx-auto max-w-site px-4 md:px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-bold">
            {t("Pakej tidak dijumpai", "Package not found")}
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {t(
              "Pakej ini mungkin telah ditarik balik daripada laman awam.",
              "This package may have been unpublished from the public site.",
            )}
          </p>
          <Link
            to="/site/packages"
            className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            {t("Lihat pakej lain", "Browse other packages")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface)]">
      <div className="mx-auto max-w-site px-4 md:px-6">
        <div className="flex flex-col gap-[var(--space-9)] py-[var(--space-9)]">
          {/* Header */}
          <header className="flex flex-col gap-3 min-w-0">
            <nav className="dtl-crumb text-caption flex flex-wrap items-center gap-1.5 text-[var(--color-text-muted)]" aria-label="Breadcrumb">
              <Link to="/site" className="text-inherit no-underline hover:text-[var(--color-primary)] focus-ring rounded">
                {t("Utama", "Home")}
              </Link>
              <span aria-hidden="true">/</span>
              <Link
                to="/site/packages"
                className="text-inherit no-underline hover:text-[var(--color-primary)] focus-ring rounded"
              >
                {t("Katalog pakej pelancongan", "Package catalogue")}
              </Link>
              <span aria-hidden="true">/</span>
              <span className="text-[var(--color-text)]">{name}</span>
            </nav>
            <div className="flex flex-wrap items-end justify-between gap-4 min-w-0">
              <div className="min-w-0 flex-1 basis-[320px]">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-[13px] font-medium text-[var(--color-text-secondary)]">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {destination}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-[13px] font-medium text-[var(--color-text-secondary)]">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {durationDays} {t("hari", "days")} {Math.max(0, durationDays - 1)} {t("malam", "nights")}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-[13px] font-medium text-[var(--color-text-secondary)]">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("Maks", "Max")} {dep?.seatCapacity ?? "—"} pax
                  </span>
                </div>
                <h1 className="dtl-title m-0 mt-2 text-balance font-display text-[clamp(26px,3.4vw,38px)] font-extrabold leading-[1.12] tracking-[-0.02em]">
                  {name}
                </h1>
                <p className="dtl-note text-body-lg m-0 mt-2 max-w-[60ch] text-[var(--color-text-secondary)]">
                  {pkg.description ?? t(
                    "Terokai destinasi menarik bersama pasukan pelancongan kami.",
                    "Explore memorable destinations with our travel team.",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-auto items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] no-underline transition-colors hover:border-[var(--color-text)] focus-ring"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  WhatsApp
                </a>
                <a
                  href="#detail-enquiry"
                  className="inline-flex h-auto items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
                >
                  {t("Bertanya tentang trip ini", "Enquire about this trip")}
                </a>
              </div>
            </div>
          </header>

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            {/* Main column */}
            <div className="flex min-w-0 flex-col gap-8">
              <figure className="dtl-cover relative m-0 overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-surface-muted)] [aspect-ratio:16/9]">
                <img
                  src={cover}
                  alt={t(
                    "Bunga sakura di tepi tasik dengan Gunung Fuji di latar belakang",
                    "Cherry blossoms beside a lake with Mount Fuji in the background",
                  )}
                  width={1400}
                  height={788}
                  loading="eager"
                  className="block h-full w-full object-cover"
                />
              </figure>

              {/* Highlights */}
              <section aria-labelledby="detail-hl-title" className="flex flex-col gap-4">
                <h2 id="detail-hl-title" className="dtl-h2 m-0 font-display text-[26px] font-bold tracking-[var(--tracking-tight)]">
                  {t("Tarikan utama trip", "Trip highlights")}
                </h2>
                <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
                  {highlights.map((item) => (
                    <li
                      key={item}
                      className="flex min-w-0 items-start gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                    >
                      <Check
                        className="mt-0.5 flex-none text-[var(--color-success)]"
                        aria-hidden="true"
                      />
                      <span className="text-body-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Itinerary */}
              <section aria-labelledby="detail-itin-title" className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="detail-itin-title" className="dtl-h2 m-0 font-display text-[26px] font-bold tracking-[var(--tracking-tight)]">
                    {t("Itinerary hari demi hari", "Day-by-day itinerary")}
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDays(openDays.length === itinerary.length ? [] : itinerary.map((_, i) => i))
                    }
                    className="cursor-pointer border-0 bg-transparent p-0 text-label-md font-semibold text-[var(--color-primary)] focus-ring"
                  >
                    {openDays.length === itinerary.length
                      ? t("Kuncupkan semua", "Collapse all")
                      : t("Buka semua", "Expand all")}
                  </button>
                </div>
                <div>
                  {itinerary.map((item, index) => {
                    const open = openDays.includes(index);
                    return (
                      <div
                        key={`${item.title}-${index}`}
                        className="dtl-day overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] [&+.dtl-day]:mt-2"
                        data-open={String(open)}
                      >
                        <button
                          type="button"
                          className="dtl-day__btn flex w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-3 px-4 text-left font-inherit text-inherit hover:bg-[var(--color-surface-raised)] focus-ring"
                          aria-expanded={open}
                          aria-controls={`detail-day-${index}`}
                          onClick={() => toggleDay(index)}
                        >
                          <span
                            aria-hidden="true"
                            className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[var(--radius-control)] bg-[var(--color-neutral-soft)] text-xs font-bold tabular-nums text-[var(--color-text-secondary)]"
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="text-caption block text-[var(--color-text-muted)]">
                              {t("Hari", "Day")} {index + 1}
                            </span>
                            <span className="text-body-md block font-semibold">{item.title}</span>
                          </span>
                          <ChevronDown
                            className="dtl-day__chev ml-auto h-4 w-4 flex-none text-[var(--color-text-muted)]"
                            aria-hidden="true"
                          />
                        </button>
                        <div
                          className="dtl-day__body pb-4 pl-[calc(30px+var(--space-3)+var(--space-4))] pr-4 max-sm:pl-4"
                          id={`detail-day-${index}`}
                          hidden={!open}
                        >
                          <p className="dtl-note text-body-sm m-0 mb-2 text-[var(--color-text-secondary)]">
                            {item.body}
                          </p>
                          {item.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-2.5 py-1 text-[13px] font-medium text-[var(--color-text-secondary)]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Price per traveller */}
              <section aria-labelledby="detail-price-title" className="flex flex-col gap-4">
                <h2 id="detail-price-title" className="dtl-h2 m-0 font-display text-[26px] font-bold tracking-[var(--tracking-tight)]">
                  {t("Harga setiap pengembara", "Price per traveller")}
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <span className="text-caption text-[var(--color-text-muted)]">
                      {t("Dewasa (12+)", "Adult (12+)")}
                    </span>
                    <strong className="mt-1 block text-[20px] font-bold tabular-nums">{ringgit(prices.adult)}</strong>
                    <span className="text-caption text-[var(--color-text-muted)]">
                      {t("bilik berkongsi", "twin sharing")}
                    </span>
                  </div>
                  <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <span className="text-caption text-[var(--color-text-muted)]">
                      {t("Kanak-kanak (2–11)", "Child (2–11)")}
                    </span>
                    <strong className="mt-1 block text-[20px] font-bold tabular-nums">{ringgit(prices.child)}</strong>
                    <span className="text-caption text-[var(--color-text-muted)]">
                      {t("dengan katil tambahan", "with extra bed")}
                    </span>
                  </div>
                  <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <span className="text-caption text-[var(--color-text-muted)]">
                      {t("Bayi (bawah 2)", "Infant (under 2)")}
                    </span>
                    <strong className="mt-1 block text-[20px] font-bold tabular-nums">{ringgit(prices.infant)}</strong>
                    <span className="text-caption text-[var(--color-text-muted)]">
                      {t("tiada tempat duduk pesawat", "no airplane seat")}
                    </span>
                  </div>
                </div>
              </section>

              {/* Departure dates */}
              <section aria-labelledby="detail-dep-title" className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="detail-dep-title" className="dtl-h2 m-0 font-display text-[26px] font-bold tracking-[var(--tracking-tight)]">
                    {t("Tarikh keberangkatan", "Departure dates")}
                  </h2>
                  <span className="text-caption text-[var(--color-text-muted)]">
                    {t("Kerusi dikemas kini secara automatik", "Seats remaining update automatically")}
                  </span>
                </div>
                <div className="dtl-tablewrap overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <table className="dtl-table w-full border-collapse text-sm">
                    <caption className="sr-only">
                      {t(`Pilih tarikh keberangkatan untuk ${name}`, `Choose a departure date for ${name}`)}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5 text-left text-caption font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                          {t("Pilih", "Select")}
                        </th>
                        <th scope="col" className="whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5 text-left text-caption font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                          {t("Berangkat", "Departs")}
                        </th>
                        <th scope="col" className="whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5 text-left text-caption font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)] max-sm:hidden">
                          {t("Ketua rombongan", "Tour leader")}
                        </th>
                        <th scope="col" className="whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5 text-left text-caption font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                          {t("Kerusi", "Seats")}
                        </th>
                        <th scope="col" className="whitespace-nowrap border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-3 py-2.5 text-left text-caption font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                          {t("Status", "Status")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {departures.map((item) => {
                        const info = seatInfo(item);
                        const disabled = seatsLeft(item) === 0;
                        return (
                          <tr
                            key={item.id}
                            data-selected={String(selectedDep === item.id)}
                            className="[&:last-child_td]:border-b-0 data-[selected=true]:bg-[var(--color-primary-soft)]"
                          >
                            <td className="border-b border-[var(--color-border)] px-3 py-2.5 align-middle">
                              <span className="inline-flex h-5 w-5 items-center justify-center">
                                <input
                                  type="radio"
                                  name="keberangkatan"
                                  value={item.id}
                                  checked={selectedDep === item.id}
                                  disabled={disabled}
                                  onChange={() => setSelectedDep(item.id)}
                                  aria-label={t(
                                    `Pilih keberangkatan ${fmtDate(item.departureDate, locale)}`,
                                    `Select departure ${fmtDate(item.departureDate, locale)}`,
                                  )}
                                  className="m-0 h-4 w-4 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed focus-ring"
                                />
                              </span>
                            </td>
                            <td className="border-b border-[var(--color-border)] px-3 py-2.5 align-middle">
                              <span className="dtl-num block font-semibold tabular-nums whitespace-nowrap">
                                {fmtDate(item.departureDate, locale)}
                              </span>
                              <span className="text-caption dtl-num block tabular-nums text-[var(--color-text-muted)]">
                                {t("kembali", "returns")} {fmtDate(item.returnDate, locale)}
                              </span>
                            </td>
                            <td className="text-body-sm max-sm:hidden border-b border-[var(--color-border)] px-3 py-2.5 align-middle">
                              {item.tourLeader ?? "—"}
                            </td>
                            <td className="text-body-sm dtl-num border-b border-[var(--color-border)] px-3 py-2.5 tabular-nums whitespace-nowrap align-middle">
                              {item.seatsBooked + item.seatsHeld}/{item.seatCapacity}
                            </td>
                            <td className="border-b border-[var(--color-border)] px-3 py-2.5 align-middle">
                              <span
                                className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-[var(--radius-pill)] px-[9px] py-[3px] text-xs font-semibold"
                                style={{ background: info.bg, color: info.fg }}
                              >
                                {info.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {departures.length === 0 && !loading ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
                            {t("Tiada jadual keberangkatan.", "No departure dates scheduled.")}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Included & excluded */}
              <section aria-labelledby="detail-inc-title" className="flex flex-col gap-4">
                <h2 id="detail-inc-title" className="dtl-h2 m-0 font-display text-[26px] font-bold tracking-[var(--tracking-tight)]">
                  {t("Termasuk & tidak termasuk", "What’s included & excluded")}
                </h2>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
                    <h3 className="text-label-md m-0 mb-3 text-[var(--color-success)]">
                      {t("Termasuk", "Included")}
                    </h3>
                    <ul className="dtl-list text-body-sm m-0 flex list-none flex-col gap-2.5 p-0">
                      {inclusions.map((item) => (
                        <li key={item} className="flex min-w-0 items-start gap-2">
                          <Check
                            className="mt-0.5 flex-none text-[var(--color-success)]"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] p-4">
                    <h3 className="text-label-md m-0 mb-3 text-[var(--color-text-muted)]">
                      {t("Tidak termasuk", "Not included")}
                    </h3>
                    <ul className="dtl-list text-body-sm m-0 flex list-none flex-col gap-2.5 p-0">
                      {exclusions.map((item) => (
                        <li key={item} className="flex min-w-0 items-start gap-2">
                          <Minus
                            className="mt-0.5 flex-none text-[var(--color-text-muted)]"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </div>

            {/* Aside — pricing & enquiry */}
            <aside className="dtl-aside flex min-w-0 flex-col gap-3" aria-label={t("Harga dan tempahan", "Pricing and booking")}>
              <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_1px_2px_rgba(20,23,31,0.06)]">
                <span className="text-caption text-[var(--color-text-muted)]">
                  {t("Mula dari", "From")}
                </span>
                <p className="dtl-num m-0 mb-3 mt-0.5 font-display text-[32px] font-bold tracking-[var(--tracking-tight)] tabular-nums">
                  {ringgit(prices.adult)}
                  <span className="text-body-sm font-normal text-[var(--color-text-muted)]">
                    {" "}
                    /pax
                  </span>
                </p>
                <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
                  <div className="text-body-sm flex justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">
                      {t("Keberangkatan dipilih", "Selected departure")}
                    </span>
                    <span className="dtl-num text-right font-semibold tabular-nums">
                      {dep ? fmtDate(dep.departureDate, locale) : "—"}
                    </span>
                  </div>
                  <div className="text-body-sm flex justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">
                      {t("Kerusi tinggal", "Seats left")}
                    </span>
                    <span className="dtl-num font-semibold tabular-nums">
                      {availableSeats === null
                        ? "—"
                        : `${availableSeats} ${t("daripada", "of")} ${dep?.seatCapacity ?? "—"}`}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {(
                    [
                      { key: "adult", label: t("Dewasa", "Adults"), hint: t("12 ke atas", "12 and above") },
                      { key: "child", label: t("Kanak-kanak", "Children"), hint: t("2–11 tahun", "2–11 years") },
                      { key: "infant", label: t("Bayi", "Infants"), hint: t("bawah 2 tahun", "under 2 years") },
                    ] as const
                  ).map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="text-body-sm block font-medium">{row.label}</span>
                        <span className="text-caption block text-[var(--color-text-muted)]">{row.hint}</span>
                      </span>
                      <span className="dtl-stepper inline-flex items-center gap-0.5 overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border-strong)]">
                        <button
                          type="button"
                          aria-label={t(`Kurangkan satu ${row.label}`, `Remove one ${row.label}`)}
                          disabled={row.key === "adult" ? pax.adult <= 1 : pax[row.key] <= 0}
                          onClick={() => ubahPax(row.key, -1)}
                          className="grid h-8 w-8 cursor-pointer place-items-center border-0 bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--color-border-strong)] focus-ring"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <output aria-live="polite" className="min-w-[34px] text-center text-sm font-semibold tabular-nums">
                          {pax[row.key]}
                        </output>
                        <button
                          type="button"
                          aria-label={t(`Tambah satu ${row.label}`, `Add one ${row.label}`)}
                          disabled={availableSeats !== null && totalPax >= availableSeats}
                          onClick={() => ubahPax(row.key, 1)}
                          className="grid h-8 w-8 cursor-pointer place-items-center border-0 bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:cursor-not-allowed disabled:text-[var(--color-border-strong)] focus-ring"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-col gap-1.5 border-t border-[var(--color-border)] pt-3">
                  <div className="dtl-sum text-body-sm flex items-baseline justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">
                      {totalPax} {t("pengembara", "travellers")}
                    </span>
                    <span className="dtl-num tabular-nums">{ringgit(subtotal)}</span>
                  </div>
                  <div className="dtl-sum text-body-sm flex items-baseline justify-between gap-2">
                    <span className="text-[var(--color-text-secondary)]">
                      {t("Deposit 30%", "Deposit 30%")}
                    </span>
                    <span className="dtl-num tabular-nums">{ringgit(deposit)}</span>
                  </div>
                  <div className="dtl-sum flex items-baseline justify-between gap-2 border-t border-dashed border-[var(--color-border)] pt-1.5">
                    <span className="text-body-sm font-semibold">
                      {t("Anggaran jumlah", "Estimated total")}
                    </span>
                    <span className="dtl-num text-[20px] font-bold tabular-nums">{ringgit(subtotal)}</span>
                  </div>
                </div>
                {exceedsSeats ? (
                  <p role="alert" className="dtl-err m-0 mt-2 text-caption text-[var(--color-danger)]">
                    {t(
                      "Bilangan pengembara melebihi kerusi yang tinggal pada tarikh ini. Sila pilih tarikh lain.",
                      "That is more travellers than the seats left on this date. Please choose another date.",
                    )}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href="#detail-enquiry"
                    className="dtl-btn inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-3 text-[15px] font-semibold text-[var(--color-on-primary)] no-underline transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring"
                  >
                    {t("Hantar pertanyaan", "Send an enquiry")}
                  </a>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="dtl-btn inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-[15px] font-semibold text-[var(--color-text)] no-underline transition-colors hover:border-[var(--color-text)] focus-ring"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    {t("Chat di WhatsApp", "Chat on WhatsApp")}
                  </a>
                </div>
                <p className="text-caption m-0 mt-3 leading-[var(--leading-normal)] text-[var(--color-text-muted)]">
                  {t(
                    "Kerusi dipegang selama 24 jam selepas deposit diterima. Pembatalan lebih 30 hari sebelum keberangkatan dikenakan yuran pentadbiran.",
                    "Seats are held for 24 hours once the deposit is received. Cancellations more than 30 days before departure carry an admin fee.",
                  )}
                </p>
              </div>

              {/* Enquiry form */}
              <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5" id="detail-enquiry">
                <h2 className="text-heading-sm m-0 font-display font-bold">
                  {t("Bertanya tentang trip ini", "Enquire about this trip")}
                </h2>
                <p className="text-caption m-0 mb-4 mt-1 text-[var(--color-text-muted)]">
                  {t(
                    "Pertanyaan anda terus masuk ke CRM sebagai lead dan diserahkan kepada jualan.",
                    "Your enquiry goes straight into the CRM as a lead and is passed to sales.",
                  )}
                </p>
                {lead ? (
                  <div className="dtl-ok flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-success)] bg-[var(--color-success-soft)] p-4" role="status">
                    <CheckCircle2 className="h-5 w-5 flex-none text-[var(--color-success)]" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-body-md m-0 font-semibold">
                        {t("Pertanyaan dihantar", "Enquiry sent")}
                      </p>
                      <p className="text-body-sm m-0 mt-1 text-[var(--color-text-secondary)]">
                        {t("Rujukan lead", "Lead reference")} <strong>{lead.ref}</strong> · {lead.pax}{" "}
                        {t("pengembara", "travellers")} untuk {lead.dep}. {t("Jualan akan menghubungi anda di WhatsApp.", "Sales will contact you on WhatsApp.")}
                      </p>
                      <button
                        type="button"
                        onClick={() => setLead(null)}
                        className="dtl-btn mt-3 inline-flex h-auto w-auto items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] no-underline transition-colors hover:border-[var(--color-text)] focus-ring"
                      >
                        {t("Hantar pertanyaan lagi", "Send another enquiry")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={kirim} noValidate className="flex flex-col gap-3">
                    <Field id="dtl-name" label={t("Nama penuh", "Full name")} error={errors.name}>
                      <input
                        id="dtl-name"
                        className="dtl-input h-[42px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-text)] focus:border-[var(--color-primary)] focus-ring aria-[invalid=true]:border-[var(--color-danger)]"
                        type="text"
                        value={form.name}
                        onChange={(event) => ubahField("name", event.target.value)}
                        autoComplete="name"
                        aria-invalid={errors.name ? "true" : undefined}
                      />
                    </Field>
                    <Field id="dtl-phone" label={t("Nombor WhatsApp", "WhatsApp number")} error={errors.phone}>
                      <input
                        id="dtl-phone"
                        className="dtl-input h-[42px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-text)] focus:border-[var(--color-primary)] focus-ring aria-[invalid=true]:border-[var(--color-danger)]"
                        type="tel"
                        inputMode="tel"
                        value={form.phone}
                        onChange={(event) => ubahField("phone", event.target.value)}
                        autoComplete="tel"
                        placeholder="012 388 0030"
                        aria-invalid={errors.phone ? "true" : undefined}
                      />
                    </Field>
                    <Field id="dtl-email" label={t("Emel (pilihan)", "Email (optional)")} error={errors.email}>
                      <input
                        id="dtl-email"
                        className="dtl-input h-[42px] w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 text-[15px] text-[var(--color-text)] focus:border-[var(--color-primary)] focus-ring aria-[invalid=true]:border-[var(--color-danger)]"
                        type="email"
                        value={form.email}
                        onChange={(event) => ubahField("email", event.target.value)}
                        autoComplete="email"
                        aria-invalid={errors.email ? "true" : undefined}
                      />
                    </Field>
                    <Field id="dtl-note" label={t("Nota (pilihan)", "Notes (optional)")}>
                      <textarea
                        id="dtl-note"
                        className="dtl-input min-h-[76px] w-full resize-y rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-2.5 text-[15px] leading-normal text-[var(--color-text)] focus:border-[var(--color-primary)] focus-ring"
                        value={form.note}
                        onChange={(event) => ubahField("note", event.target.value)}
                        placeholder={t("cth. perlukan bilik triple, alahan makanan laut", "e.g. need a triple room, seafood allergy")}
                      />
                    </Field>
                    <p className="text-caption m-0 text-[var(--color-text-muted)]">
                      {t("Ringkasan dihantar bersama pertanyaan", "Summary sent with your enquiry")}:{" "}
                      {dep ? fmtDate(dep.departureDate, locale) : "—"} · {totalPax}{" "}
                      {t("pengembara", "travellers")} · {ringgit(subtotal)}
                    </p>
                    <button
                      type="submit"
                      disabled={sending}
                      className="dtl-btn dtl-btn--primary inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-3 text-[15px] font-semibold text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] hover:border-[var(--color-primary-hover)] focus-ring disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sending
                        ? t("Sedang menghantar…", "Sending…")
                        : t("Hantar pertanyaan", "Send enquiry")}
                    </button>
                  </form>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

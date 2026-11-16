import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, Clock, ArrowRight, CalendarDays, Flame } from "lucide-react";
import { mockDepartures, mockPackages } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { applySeo } from "@/lib/site-config";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PublicPackages() {
  const { t, lang } = useLang();
  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState<string>("all");

  useEffect(() => {
    applySeo("packages");
    return () => {
      document.title = "ZAQONE TRAVEL CRM";
    };
  }, []);

  const destinations = useMemo(() => {
    const set = new Set(
      mockPackages
        .filter((p) => p.status !== "archived")
        .map((p) => p.destination),
    );
    return ["all", ...[...set].sort()];
  }, []);

  const packages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mockPackages.filter((p) => {
      if (p.status === "archived") return false;
      if (p.published === false) return false;
      if (destination !== "all" && p.destination !== destination) return false;
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !p.destination.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [search, destination]);

  const today = new Date().toISOString().slice(0, 10);
  const nextDeparture = (packageId: string) =>
    mockDepartures
      .filter((d) => d.packageId === packageId && d.status !== "closed")
      .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
      .find((d) => d.departureDate >= today) ??
    mockDepartures
      .filter((d) => d.packageId === packageId && d.status !== "closed")
      .sort((a, b) => b.departureDate.localeCompare(a.departureDate))[0];

  const seatsLeft = (d: (typeof mockDepartures)[number]) =>
    d.seatCapacity - d.seatsBooked - d.seatsHeld;

  return (
    <>
      {/* Header */}
      <section className="bg-gradient-to-b from-red-50/70 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("Pakej Pelancongan", "Tour Packages")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            {t(
              "Semua pakej open trip dan private tour daripada ZAQONE TRAVEL — harga telus per pax, itinerary jelas, keberangkatan berjadual.",
              "All open trip and private tour packages from ZAQONE TRAVEL — transparent per-pax pricing, clear itineraries, scheduled departures.",
            )}
          </p>

          {/* Search & filter */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Cari pakej atau destinasi…", "Search packages or destinations…")}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {destinations.map((dest) => (
                <button
                  key={dest}
                  onClick={() => setDestination(dest)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    destination === dest
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-stone-200 bg-white text-stone-600 hover:border-stone-300",
                  )}
                >
                  {dest === "all" ? t("Semua", "All") : dest}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="mb-4 text-sm text-stone-500">
            {packages.length} {t("pakej dijumpai", "packages found")}
          </p>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md"
              >
                {/* Banner */}
                <div className="relative flex h-32 items-end bg-gradient-to-br from-stone-200 via-stone-100 to-red-50 p-4">
                  <Badge
                    variant="outline"
                    className="border-white/60 bg-white/90 text-stone-700"
                  >
                    <MapPin className="mr-1 h-3 w-3" />
                    {pkg.destination}
                  </Badge>
                </div>

                <CardContent className="flex flex-1 flex-col p-5">
                  <h3 className="text-base font-bold">{pkg.name}</h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                    <Clock className="h-3 w-3" />
                    {pkg.durationDays} {t("hari", "days")}{" "}
                    {(pkg.durationDays ?? 1) - 1} {t("malam", "nights")}
                  </p>

                  {/* Availability */}
                  {(() => {
                    const next = nextDeparture(pkg.id);
                    if (!next) {
                      return (
                        <p className="mt-2 flex items-center gap-1 text-xs text-stone-400">
                          <CalendarDays className="h-3 w-3" />
                          {t(
                            "Jadual menyusul — private trip tersedia",
                            "Schedule coming soon — private trips available",
                          )}
                        </p>
                      );
                    }
                    const left = seatsLeft(next);
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="flex items-center gap-1 text-xs text-stone-600">
                          <CalendarDays className="h-3 w-3" />
                          {new Date(next.departureDate).toLocaleDateString(
                            lang === "ms" ? "ms-MY" : "en-GB",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </span>
                        {left <= 0 || next.status === "full" ? (
                          <Badge
                            variant="outline"
                            className="border-red-200 bg-red-50 text-red-700"
                          >
                            {t("Habis", "Sold Out")}
                          </Badge>
                        ) : left <= 5 ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700"
                          >
                            <Flame className="mr-0.5 h-3 w-3" />
                            {t("Baki", "Only")} {left} {t("seat", "seats")}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700"
                          >
                            {left} {t("seat tersedia", "seats available")}
                          </Badge>
                        )}
                      </div>
                    );
                  })()}

                  {/* Highlights */}
                  {pkg.highlights && pkg.highlights.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {pkg.highlights.slice(0, 3).map((h) => (
                        <li
                          key={h}
                          className="flex items-start gap-1.5 text-xs text-stone-600"
                        >
                          <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-4">
                    <div className="flex items-end justify-between border-t pt-3">
                      <div>
                        <p className="text-[10px] text-stone-500">
                          {t("mula dari / pax", "from / pax")}
                        </p>
                        <p className="text-lg font-bold text-red-600">
                          {formatRupiah(pkg.adultPrice)}
                        </p>
                      </div>
                      <Button asChild size="sm">
                        <Link to={`/site/packages/${pkg.id}`}>
                          {t("Lihat Butiran", "View Details")}
                          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {packages.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Search className="h-8 w-8 text-stone-300" />
              <p className="text-sm font-medium">
                {t("Tiada pakej dijumpai", "No packages found")}
              </p>
              <p className="text-xs text-stone-500">
                {t(
                  "Cuba kata kunci lain atau set semula penapis destinasi.",
                  "Try other keywords or reset the destination filter.",
                )}
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

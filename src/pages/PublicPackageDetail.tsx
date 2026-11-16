import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  MapPin,
  Clock,
  Check,
  X,
  CalendarDays,
  ArrowLeft,
  ArrowRight,
  Users,
} from "lucide-react";
import { mockDepartures, mockPackages } from "@/lib/mock-data";
import { useLang } from "@/lib/i18n";
import { formatRinggit } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatRupiah(value: number): string {
  return formatRinggit(value);
}

export default function PublicPackageDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const pkg = useMemo(
    () => mockPackages.find((p) => p.id === id),
    [id],
  );

  const departures = useMemo(
    () =>
      mockDepartures
        .filter((d) => d.packageId === id && d.status !== "closed")
        .sort((a, b) => a.departureDate.localeCompare(b.departureDate)),
    [id],
  );

  if (!pkg) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">
          {t("Pakej tidak dijumpai", "Package not found")}
        </h1>
        <p className="text-sm text-stone-600">
          {t(
            "Pakej yang anda cari mungkin sudah tidak tersedia.",
            "The package you're looking for may no longer be available.",
          )}
        </p>
        <Button asChild variant="outline">
          <Link to="/site/packages">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("Kembali ke Katalog", "Back to Catalog")}
          </Link>
        </Button>
      </div>
    );
  }

  const seatsLeft = (d: (typeof departures)[number]) =>
    d.seatCapacity - d.seatsBooked - d.seatsHeld;

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-stone-100 to-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <Link
            to="/site/packages"
            className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-red-600"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("Semua Pakej", "All Packages")}
          </Link>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Main info */}
            <div className="lg:col-span-2">
              <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                <MapPin className="mr-1 h-3 w-3" />
                {pkg.destination}
              </Badge>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                {pkg.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-stone-600">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-red-600" />
                  {pkg.durationDays} {t("hari", "days")} {(pkg.durationDays ?? 1) - 1} {t("malam", "nights")}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-red-600" />
                  {t("Open trip & kumpulan persendirian", "Open trip & private group")}
                </span>
              </div>

              {/* Highlights */}
              {pkg.highlights && pkg.highlights.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
                    {t("Sorotan Perjalanan", "Trip Highlights")}
                  </h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {pkg.highlights.map((h) => (
                      <div
                        key={h}
                        className="flex items-start gap-2 rounded-lg border bg-white p-3 text-sm"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        {h}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Itinerary */}
              {pkg.itinerary && pkg.itinerary.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
                    Itinerary
                  </h2>
                  <div className="mt-3 space-y-3">
                    {pkg.itinerary.map((day) => (
                      <div key={day.day} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                            {day.day}
                          </div>
                          {day.day !== pkg.itinerary!.length && (
                            <div className="w-px flex-1 bg-stone-200" />
                          )}
                        </div>
                        <div className="pb-6">
                          <p className="text-sm font-semibold">
                            {t("Hari", "Day")} {day.day}: {day.title}
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-stone-600">
                            {day.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inclusions / exclusions */}
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {t("Harga Termasuk", "Price Includes")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pkg.inclusions.map((inc) => (
                      <p
                        key={inc}
                        className="flex items-start gap-2 text-xs text-stone-700"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        {inc}
                      </p>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {t("Harga Tidak Termasuk", "Price Excludes")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(pkg.exclusions ?? ["—"]).map((exc) => (
                      <p
                        key={exc}
                        className="flex items-start gap-2 text-xs text-stone-700"
                      >
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                        {exc}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Sidebar: pricing + departures */}
            <div className="space-y-4">
              <Card className="sticky top-24">
                <CardContent className="p-5">
                  <p className="text-xs text-stone-500">{t("mula dari / pax", "from / pax")}</p>
                  <p className="text-3xl font-bold text-red-600">
                    {formatRupiah(pkg.adultPrice)}
                  </p>

                  <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-600">{t("Dewasa", "Adult")}</span>
                      <span className="font-semibold">
                        {formatRupiah(pkg.adultPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">{t("Kanak-kanak (2–11 th)", "Child (2–11 yrs)")}</span>
                      <span className="font-semibold">
                        {formatRupiah(pkg.childPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">{t("Bayi (bawah 2 th)", "Infant (under 2 yrs)")}</span>
                      <span className="font-semibold">
                        {formatRupiah(pkg.infantPrice)}
                      </span>
                    </div>
                  </div>

                  <Button asChild className="mt-5 w-full" size="lg">
                    <Link to="/site/contact">
                      {t("Tempahkan Sekarang", "Book Now")}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <p className="mt-2 text-center text-[11px] text-stone-500">
                    {t(
                      "Konsultasi percuma • Deposit 30% untuk tempah seat",
                      "Free consultation • 30% deposit to lock your seat",
                    )}
                  </p>
                </CardContent>
              </Card>

              {/* Departures */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-sm">
                    <CalendarDays className="h-4 w-4 text-red-600" />
                    {t("Jadual Keberangkatan", "Departure Schedule")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {departures.length === 0 && (
                    <p className="text-xs text-stone-500">
                      {t(
                        "Jadual akan diumumkan — hubungi kami untuk private trip.",
                        "Schedule to be announced — contact us for a private trip.",
                      )}
                    </p>
                  )}
                  {departures.map((d) => {
                    const left = seatsLeft(d);
                    return (
                      <div
                        key={d.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {new Date(d.departureDate).toLocaleDateString(
                              lang === "ms" ? "ms-MY" : "en-GB",
                              {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              },
                            )}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {d.seatsBooked}/{d.seatCapacity} {t("seat terisi", "seats filled")}
                            {d.tourLeader ? ` • TL: ${d.tourLeader}` : ""}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            d.status === "full"
                              ? "border-red-200 bg-red-50 text-red-700"
                              : d.status === "almost_full"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }
                        >
                          {d.status === "full"
                            ? t("Penuh", "Full")
                            : `${left} ${t("seat", "seats")}`}
                        </Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

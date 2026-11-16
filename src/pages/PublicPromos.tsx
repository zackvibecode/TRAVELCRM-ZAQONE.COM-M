import { Link } from "react-router-dom";
import {
  Flame,
  Clock,
  ArrowRight,
  BadgePercent,
  Sparkles,
} from "lucide-react";
import { mockPackages, mockDepartures } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

/** Illustrative promotions derived from published packages — replaced by the
 *  promos table from the Website Manager backend phase. */
const PROMO_TYPES = [
  {
    id: "flash-sale",
    label: "Flash Sale",
    icon: Flame,
    badgeClass: "border-orange-200 bg-orange-50 text-orange-700",
    iconClass: "bg-orange-50 text-orange-600",
    discountPct: 20,
    blurb: "Diskon terbatas untuk keberangkatan terdekat — kuota seat terbatas!",
  },
  {
    id: "early-bird",
    label: "Early Bird",
    icon: Clock,
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
    iconClass: "bg-blue-50 text-blue-600",
    discountPct: 15,
    blurb: "Booking jauh hari lebih murah — berlaku untuk jadwal 3 bulan ke depan.",
  },
  {
    id: "group-deal",
    label: "Group Deal",
    icon: BadgePercent,
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
    iconClass: "bg-violet-50 text-violet-600",
    discountPct: 10,
    blurb: "Ajak 6+ teman pergi bersama, semua dapat potongan harga grup.",
  },
];

export default function PublicPromos() {
  const published = mockPackages.filter(
    (p) => p.status !== "archived" && p.published !== false,
  );
  const today = new Date().toISOString().slice(0, 10);
  const upcomingDepartures = mockDepartures
    .filter((d) => d.departureDate >= today)
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate));

  return (
    <>
      {/* Page header */}
      <section className="bg-gradient-to-b from-red-50/70 to-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Badge variant="outline" className="mb-3 border-red-200 bg-red-50 text-red-700">
            <Sparkles className="mr-1 h-3 w-3" />
            Penawaran spesial
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Promo & Penawaran Spesial
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
            Diskon flash sale, harga early bird, dan penawaran grup untuk
            paket pilihan. Cepat diambil — kuota dan periode promo terbatas.
          </p>
        </div>
      </section>

      {/* Promo categories */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-4 lg:grid-cols-3">
            {PROMO_TYPES.map((promo) => {
              // Attach a package + departure to each promo for realism.
              const pkg =
                published.find((_, idx) => idx === PROMO_TYPES.indexOf(promo)) ??
                published[0];
              const departure = upcomingDepartures.find(
                (d) => d.packageId === pkg?.id,
              );
              const discountPrice = pkg
                ? Math.round((pkg.adultPrice * (100 - promo.discountPct)) / 100)
                : 0;

              return (
                <Card
                  key={promo.id}
                  className="relative overflow-hidden"
                >
                  {/* Corner ribbon */}
                  <div
                    className={cn(
                      "absolute right-0 top-0 rounded-bl-xl px-3 py-1 text-xs font-bold text-white",
                      promo.id === "flash-sale"
                        ? "bg-orange-500"
                        : promo.id === "early-bird"
                          ? "bg-blue-500"
                          : "bg-violet-500",
                    )}
                  >
                    -{promo.discountPct}%
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2">
                      <div className={cn("rounded-lg p-2", promo.iconClass)}>
                        <promo.icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-bold">{promo.label}</span>
                    </div>

                    {pkg && (
                      <>
                        <h3 className="mt-3 text-lg font-bold">{pkg.name}</h3>
                        <p className="mt-1 text-xs text-stone-600">
                          {pkg.durationDays} hari • {pkg.destination}
                        </p>
                        {departure && (
                          <p className="mt-1 text-xs font-medium text-red-600">
                            Berangkat{" "}
                            {new Date(departure.departureDate).toLocaleDateString(
                              "id-ID",
                              { day: "numeric", month: "long", year: "numeric" },
                            )}
                          </p>
                        )}

                        <div className="mt-4 flex items-baseline gap-2">
                          <span className="text-xs text-stone-400 line-through">
                            {formatRupiah(pkg.adultPrice)}
                          </span>
                          <span className="text-xl font-bold text-red-600">
                            {formatRupiah(discountPrice)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-stone-500">
                          per pax dewasa
                        </p>
                      </>
                    )}

                    <p className="mt-3 text-xs leading-relaxed text-stone-600">
                      {promo.blurb}
                    </p>

                    <Button asChild className="mt-4 w-full" size="sm">
                      <Link to="/site/contact">
                        Ambil Promo Ini
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Terms */}
      <section className="border-t bg-stone-50/60">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
            Syarat & Ketentuan
          </h2>
          <ul className="mt-3 grid gap-2 text-xs leading-relaxed text-stone-600 sm:grid-cols-2">
            <li>• Promo berlaku untuk pendaftaran baru selama periode berjalan.</li>
            <li>• Harga promo tidak dapat digabung dengan diskon lainnya.</li>
            <li>• Kuota seat promo terbatas dan dapat berakhir sewaktu-waktu.</li>
            <li>• Pembayaran deposit minimal 30% untuk mengunci harga promo.</li>
            <li>• Perubahan jadwal setelah konfirmasi dikenakan biaya administrasi.</li>
            <li>• Keputusan TravelOS bersifat final dalam hal sengketa promo.</li>
          </ul>
        </div>
      </section>
    </>
  );
}

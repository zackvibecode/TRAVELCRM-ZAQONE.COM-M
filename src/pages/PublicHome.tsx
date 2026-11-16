import { Link } from "react-router-dom";
import { useMemo } from "react";
import { ArrowRight, MapPin, CalendarDays, Users, ShieldCheck, Headset, Sparkles } from "lucide-react";
import { mockPackages } from "@/lib/mock-data";
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

const HERO_STATS = [
  { label: "Tujuan", value: "20+" },
  { label: "Traveler puas", value: "12.000+" },
  { label: "Rating", value: "4.9/5" },
  { label: "Pengalaman", value: "8 tahun" },
];

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: "Aman & Terpercaya",
    desc: "Legalitas resmi, pembayaran terlindungi, dan tim operasional berpengalaman.",
  },
  {
    icon: CalendarDays,
    title: "Jadwal Fleksibel",
    desc: "Keberangkatan rutin setiap bulan dan grup privat sesuai permintaan.",
  },
  {
    icon: Headset,
    title: "Dampingi 24/7",
    desc: "Tour leader lokal dan support darurat sepanjang perjalanan.",
  },
  {
    icon: Sparkles,
    title: "Itinerary Kurasi",
    desc: "Rute dirancang tim in-house — bukan template massal.",
  },
];

export default function PublicHome() {
  const featured = mockPackages.filter((p) => p.published).slice(0, 3);

  const destinations = useMemo(() => {
    const byDest = new Map<string, number>();
    for (const p of mockPackages) {
      if (p.published === false) continue;
      byDest.set(p.destination, (byDest.get(p.destination) ?? 0) + 1);
    }
    const list = [...byDest.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return list.map((d, i) => ({ ...d, featured: i === 0 }));
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-red-50/70 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="outline" className="mb-4 border-red-200 bg-red-50 text-red-700">
              Open Trip & Private Tour 2026
            </Badge>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Jelajahi Dunia,
              <br />
              <span className="text-red-600">Tanpa Ribet.</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-stone-600">
              Paket wisata domestik dan internasional dengan itinerary
              terkurasi, harga transparan, dan pendampingan penuh dari tim
              TravelOS — dari booking sampai pulang dengan selamat.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/site/packages">
                  Lihat Paket Wisata
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/site/contact">Konsultasi Gratis</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {HERO_STATS.map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-stone-900">
                    {stat.value}
                  </p>
                  <p className="text-xs text-stone-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Featured package collage */}
          <div className="grid gap-4">
            {featured.slice(0, 2).map((pkg, idx) => (
              <Link
                key={pkg.id}
                to="/site/packages"
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-shadow hover:shadow-lg",
                  idx === 0
                    ? "from-stone-100 to-stone-50"
                    : "from-red-50 to-orange-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="flex items-center gap-1 text-xs font-medium text-stone-500">
                      <MapPin className="h-3 w-3" />
                      {pkg.destination}
                    </span>
                    <h3 className="mt-1 text-lg font-bold">{pkg.name}</h3>
                    <p className="mt-1 text-sm text-stone-600">
                      {pkg.durationDays} hari • {pkg.highlights?.length ?? 0} highlight
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500">mulai dari</p>
                    <p className="text-lg font-bold text-red-600">
                      {formatRupiah(pkg.adultPrice)}
                    </p>
                  </div>
                </div>
                <ArrowRight className="absolute bottom-4 right-4 h-4 w-4 text-stone-400 transition-transform group-hover:translate-x-1 group-hover:text-red-600" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t bg-stone-50/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            Kenapa Travel<span className="text-red-600">OS</span>?
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map((prop) => (
              <Card key={prop.title} className="border-stone-200">
                <CardContent className="p-5">
                  <div className="w-fit rounded-lg bg-red-50 p-2.5">
                    <prop.icon className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{prop.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                    {prop.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured packages */}
      <section>
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Paket Populer
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                Dipilih traveler, dijadwalkan rutin setiap bulan.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/site/packages">
                Semua paket
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((pkg) => (
              <Link key={pkg.id} to="/site/packages">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-5">
                    <span className="flex items-center gap-1 text-xs font-medium text-stone-500">
                      <MapPin className="h-3 w-3" />
                      {pkg.destination}
                    </span>
                    <h3 className="mt-1.5 text-base font-bold">{pkg.name}</h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-stone-600">
                      {pkg.highlights?.slice(0, 2).join(" • ") ??
                        `Paket ${pkg.durationDays} hari ke ${pkg.destination}`}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <span className="flex items-center gap-1 text-[11px] text-stone-500">
                        <Users className="h-3 w-3" />
                        {pkg.durationDays} hari
                      </span>
                      <div className="text-right">
                        <p className="text-[10px] text-stone-500">mulai</p>
                        <p className="text-sm font-bold text-red-600">
                          {formatRupiah(pkg.adultPrice)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular destinations */}
      <section className="border-t bg-stone-50/60">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight">
            Destinasi Populer
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Tempat favorit traveler tahun ini.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {destinations.map((dest) => (
              <Link
                key={dest.name}
                to="/site/packages"
                className={cn(
                  "group relative overflow-hidden rounded-xl border p-4 transition-shadow hover:shadow-md",
                  dest.featured
                    ? "bg-gradient-to-br from-red-500 to-red-600 text-white"
                    : "bg-white",
                )}
              >
                <MapPin
                  className={cn(
                    "h-4 w-4",
                    dest.featured ? "text-white" : "text-red-600",
                  )}
                />
                <p
                  className={cn(
                    "mt-2 text-sm font-bold",
                    dest.featured ? "text-white" : "text-stone-900",
                  )}
                >
                  {dest.name}
                </p>
                <p
                  className={cn(
                    "text-[11px]",
                    dest.featured ? "text-red-100" : "text-stone-500",
                  )}
                >
                  {dest.count} paket
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-stone-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-14 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Rencanakan trip impian Anda hari ini
          </h2>
          <p className="max-w-xl text-sm text-stone-400">
            Tim kami siap membantu memilih destinasi, menyesuaikan itinerary,
            dan mengatur anggaran — gratis, tanpa komitmen.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/site/contact">Hubungi Kami</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-stone-700 bg-transparent text-white hover:bg-stone-800 hover:text-white"
            >
              <Link to="/site/packages">Jelajahi Paket</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

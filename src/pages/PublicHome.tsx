import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { MapPin, CalendarDays, Users, ShieldCheck, Headset, Sparkles, ArrowRight, Megaphone } from "lucide-react";
import { mockPackages } from "@/lib/mock-data";
import { cn , formatRinggit } from "@/lib/utils";
import { activeBanners, applySeo } from "@/lib/site-config";
import { useLang, useLocalePath } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

function formatRupiah(value: number): string {
  return formatRinggit(value);
}

const HERO_STATS = [
  { labelMs: "Destinasi", labelEn: "Destinations", valueMs: "20+", valueEn: "20+" },
  { labelMs: "Pelancong berpuas hati", labelEn: "Happy travellers", valueMs: "12,000+", valueEn: "12,000+" },
  { labelMs: "Penilaian", labelEn: "Rating", valueMs: "4.9/5", valueEn: "4.9/5" },
  { labelMs: "Pengalaman", labelEn: "Experience", valueMs: "8 tahun", valueEn: "8 years" },
];


const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    titleMs: "Selamat & Dipercaya",
    titleEn: "Safe & Trusted",
    descMs: "Kedudukan sah, pembayaran terlindungi, dan pasukan operasi berpengalaman.",
    descEn: "Fully licensed, protected payments, and an experienced operations team.",
  },
  {
    icon: CalendarDays,
    titleMs: "Jadual Fleksibel",
    titleEn: "Flexible Schedule",
    descMs: "Keberangkatan rutin setiap bulan dan kumpulan persendirian mengikut permintaan.",
    descEn: "Regular monthly departures and private groups on request.",
  },
  {
    icon: Headset,
    titleMs: "Dibantu 24/7",
    titleEn: "Supported 24/7",
    descMs: "Pemandu pelancongan tempatan dan sokongan kecemasan sepanjang perjalanan.",
    descEn: "Local tour leaders and emergency support throughout your journey.",
  },
  {
    icon: Sparkles,
    titleMs: "Itinerary Terkurasi",
    titleEn: "Curated Itineraries",
    descMs: "Laluan direka oleh pasukan dalaman kami — bukan templat umum.",
    descEn: "Routes designed by our in-house team — not mass templates.",
  },
];

export default function PublicHome() {
  const { t, lang } = useLang();
  const lp = useLocalePath();

  useEffect(() => {
    applySeo("home", lang);
    return () => {
      document.title = "ZAQONE TRAVEL CRM";
    };
  }, []);

  const banners = useMemo(() => activeBanners(), []);

  const featured = mockPackages
    .filter((p) => p.status !== "archived" && p.published !== false)
    .slice(0, 3);

  const destinations = useMemo(() => {
    const byDest = new Map<string, number>();
    for (const p of mockPackages) {
      if (p.status === "archived" || p.published === false) continue;
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
      {/* Active promo banners (from Banner Manager) */}
      {banners.length > 0 && (
        <div className="bg-red-600 text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 text-xs sm:text-sm">
            {banners.slice(0, 1).map((banner) => (
              <div
                key={banner.id}
                className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1"
              >
                <Megaphone className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">{banner.title}</span>
                <span className="hidden text-red-100 sm:inline">
                  {banner.subtitle}
                </span>
                <Link
                  to={banner.ctaHref}
                  className="ml-auto shrink-0 rounded-full bg-white/15 px-3 py-0.5 font-semibold transition-colors hover:bg-white/25"
                >
                  {banner.ctaLabel} →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-red-50/70 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <Badge variant="outline" className="mb-4 border-red-200 bg-red-50 text-red-700">
              {t("Open Trip & Private Tour 2026", "Open Trip & Private Tour 2026")}
            </Badge>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t("Terokai Dunia,", "Explore the World,")}
              <br />
              <span className="text-red-600">{t("Tanpa Ribet.", "Hassle-Free.")}</span>
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-stone-600">
              {t(
                "Pakej pelancongan domestik dan antarabangsa dengan itinerary terkurasi, harga telus, dan pendampingan penuh daripada pasukan ZAQONE TRAVEL — daripada tempahan sehingga pulang dengan selamat.",
                "Domestic and international tour packages with curated itineraries, transparent pricing, and full support from the ZAQONE TRAVEL team — from booking until you return home safely.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={lp("/site/packages")}>
                  {t("Lihat Pakej Pelancongan", "View Tour Packages")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={lp("/site/contact")}>{t("Konsultasi Percuma", "Free Consultation")}</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {HERO_STATS.map((stat) => (
                <div key={stat.labelEn}>
                  <p className="text-2xl font-bold text-stone-900">
                    {t(stat.valueMs, stat.valueEn)}
                  </p>
                  <p className="text-xs text-stone-500">
                    {t(stat.labelMs, stat.labelEn)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Featured package collage */}
          <div className="grid gap-4">
            {featured.slice(0, 2).map((pkg, idx) => (
              <Link
                key={pkg.id}
                to={lp("/site/packages")}
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
                      {pkg.durationDays} {t("hari", "days")} • {pkg.highlights?.length ?? 0} highlight
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-stone-500">{t("mula dari", "from")}</p>
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
            {t("Kenapa ZAQONE", "Why ZAQONE")} <span className="text-red-600">TRAVEL</span>?
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map((prop) => (
              <Card key={prop.titleEn} className="border-stone-200">
                <CardContent className="p-5">
                  <div className="w-fit rounded-lg bg-red-50 p-2.5">
                    <prop.icon className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">
                    {t(prop.titleMs, prop.titleEn)}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                    {t(prop.descMs, prop.descEn)}
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
                {t("Pakej Popular", "Popular Packages")}
              </h2>
              <p className="mt-1 text-sm text-stone-600">
                {t(
                  "Pilihan pelancong, dijadualkan secara rutin setiap bulan.",
                  "Traveller favourites, scheduled regularly every month.",
                )}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to={lp("/site/packages")}>
                {t("Semua pakej", "All packages")}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((pkg) => (
              <Link key={pkg.id} to={lp("/site/packages")}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-5">
                    <span className="flex items-center gap-1 text-xs font-medium text-stone-500">
                      <MapPin className="h-3 w-3" />
                      {pkg.destination}
                    </span>
                    <h3 className="mt-1.5 text-base font-bold">{pkg.name}</h3>
                    <p className="mt-2 line-clamp-2 flex-1 text-xs leading-relaxed text-stone-600">
                      {pkg.highlights?.slice(0, 2).join(" • ") ??
                        t(
                          `Pakej ${pkg.durationDays} hari ke ${pkg.destination}`,
                          `${pkg.durationDays}-day package to ${pkg.destination}`,
                        )}
                    </p>
                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <span className="flex items-center gap-1 text-[11px] text-stone-500">
                        <Users className="h-3 w-3" />
                        {pkg.durationDays} {t("hari", "days")}
                      </span>
                      <div className="text-right">
                        <p className="text-[10px] text-stone-500">{t("mula", "from")}</p>
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
            {t("Destinasi Popular", "Popular Destinations")}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {t(
              "Tempat kegemaran pelancong tahun ini.",
              "Traveller favourites this year.",
            )}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {destinations.map((dest) => (
              <Link
                key={dest.name}
                to={lp("/site/packages")}
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
                  {dest.count} {t("pakej", "packages")}
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
            {t(
              "Rancang trip impian anda hari ini",
              "Plan your dream trip today",
            )}
          </h2>
          <p className="max-w-xl text-sm text-stone-400">
            {t(
              "Pasukan kami sedia membantu memilih destinasi, menyesuaikan itinerary, dan mengurus bajet — percuma, tanpa komitmen.",
              "Our team is ready to help you pick a destination, tailor the itinerary, and manage your budget — free, no commitment.",
            )}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={lp("/site/contact")}>{t("Hubungi Kami", "Contact Us")}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-stone-700 bg-transparent text-white hover:bg-stone-800 hover:text-white"
            >
              <Link to={lp("/site/packages")}>{t("Terokai Pakej", "Explore Packages")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

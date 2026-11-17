import { useMemo, useState } from "react";
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  LayoutDashboard,
  Save,
  X,
  Inbox,
  MessageCircle,
  ArrowRight,
  Search,
  Megaphone,
} from "lucide-react";
import { mockPackages } from "@/lib/mock-data";
import { cn, waLink } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageStatus = "draft" | "published";

interface SitePage {
  id: string;
  slug: string;
  title: string;
  content: string;
  status: PageStatus;
  updatedAt: string;
  /** ISO date — when set and in the future, the page auto-publishes at that time. */
  scheduledAt?: string;
}

const INITIAL_PAGES: SitePage[] = [
  {
    id: "page-home",
    slug: "home",
    title: "Homepage",
    content:
      "Hero: Jelajahi Dunia, Tanpa Ribet.\n\nHighlight: paket domestik & internasional, itinerary terkurasi, pendampingan penuh.",
    status: "published",
    updatedAt: "2026-11-10 09:30",
  },
  {
    id: "page-promos",
    slug: "promos",
    title: "Promo & Penawaran",
    content:
      "Kartu promo aktif: Flash Sale (-20%), Early Bird (-15%), Group Deal (-10%).",
    status: "published",
    updatedAt: "2026-11-12 14:15",
  },
  {
    id: "page-about",
    slug: "about",
    title: "Tentang Kami",
    content:
      "ZAQONE TRAVEL ialah agensi pelancongan dengan 8 tahun pengalaman melayani 12,000+ pelancong.",
    status: "draft",
    updatedAt: "2026-11-08 16:45",
  },
  {
    id: "page-contact",
    slug: "contact",
    title: "Kontak",
    content:
      "Pejabat: Jalan Sultan Ismail, Kuala Lumpur. Telefon: +60 3 5555 0123. Emel: hello@zaqonetravel.com.",
    status: "published",
    updatedAt: "2026-11-05 11:20",
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface WebsiteEnquiry {
  id: string;
  name: string;
  phone: string;
  packageName: string;
  pax: number;
  message: string;
  receivedAt: string;
  status: "new" | "contacted";
}

const INITIAL_ENQUIRIES: WebsiteEnquiry[] = [
  {
    id: "enq-1",
    name: "Siti Rahma",
    phone: "081298765432",
    packageName: "Bali Family Retreat",
    pax: 2,
    message: "Mau tanya harga untuk family trip bulan Juni.",
    receivedAt: "2026-11-16 14:22",
    status: "new",
  },
  {
    id: "enq-2",
    name: "Andi Kurniawan",
    phone: "081377788899",
    packageName: "Japan Sakura Tour",
    pax: 4,
    message: "Apakah masih ada slot untuk keberangkatan April?",
    receivedAt: "2026-11-16 10:05",
    status: "new",
  },
  {
    id: "enq-3",
    name: "Maya Sari",
    phone: "085612349876",
    packageName: "Belum tahu — minta rekomendasi",
    pax: 2,
    message: "Honeymoon budget 20 juta, destinasi mana yang cocok?",
    receivedAt: "2026-11-15 19:40",
    status: "contacted",
  },
];

interface SeoSettings {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
}

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  /** ISO dates — banner only shows on the public site between these dates. */
  startAt: string;
  endAt: string;
  active: boolean;
}

const INITIAL_BANNERS: Banner[] = [
  {
    id: "ban-1",
    title: "Sakura Season 2027 — Early Bird 15%",
    subtitle: "Booking sebelum Desember untuk keberangkatan Maret–April.",
    ctaLabel: "Lihat Paket Jepang",
    ctaHref: "/site/packages",
    startAt: "2026-11-01",
    endAt: "2026-12-31",
    active: true,
  },
  {
    id: "ban-2",
    title: "Weekend Getaway Bali & Lombok",
    subtitle: "Open trip tiap Jumat malam — cocok untuk pekerja kantoran.",
    ctaLabel: "Cek Jadwal",
    ctaHref: "/site/packages",
    startAt: "2026-11-10",
    endAt: "2027-01-15",
    active: true,
  },
];

const INITIAL_SEO: Record<string, SeoSettings> = {
  home: {
    metaTitle: "ZAQONE TRAVEL — Paket Wisata Domestik & Internasional",
    metaDescription:
      "Travel agency all-in-one: open trip, private tour, dan corporate travel dengan itinerary terkurasi dan harga transparan. Booking mudah, pendampingan penuh.",
    keywords: "paket wisata, open trip, tour travel jakarta, travel murah",
  },
  promos: {
    metaTitle: "Promo & Penawaran Spesial — ZAQONE TRAVEL",
    metaDescription:
      "Diskon flash sale, harga early bird, dan penawaran grup untuk paket wisata pilihan. Kuota terbatas!",
    keywords: "promo wisata, diskon tiket tour, flash sale travel",
  },
  packages: {
    metaTitle: "Paket Wisata Lengkap — ZAQONE TRAVEL",
    metaDescription:
      "Jelajahi semua paket wisata ZAQONE TRAVEL: Jepang, Korea, Bali, Lombok, Singapore, hingga Eropa. Harga per pax jelas, keberangkatan terjadwal.",
    keywords: "paket tour jepang, wisata bali, tour korea, paket eropa",
  },
};

export default function WebsiteManager() {
  const { t } = useLang();
  const [pages, setPages] = useState<SitePage[]>(INITIAL_PAGES);
  const [editing, setEditing] = useState<SitePage | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [enquiries, setEnquiries] = useState<WebsiteEnquiry[]>(INITIAL_ENQUIRIES);
  const [seo, setSeo] = useState<Record<string, SeoSettings>>(INITIAL_SEO);
  const [seoPage, setSeoPage] = useState<string>("home");
  const [seoSaved, setSeoSaved] = useState(false);
  const [banners, setBanners] = useState<Banner[]>(INITIAL_BANNERS);
  const [bannerEditing, setBannerEditing] = useState<Banner | null>(null);
  const [bannerIsNew, setBannerIsNew] = useState(false);

  const seoFor = seo[seoPage] ?? {
    metaTitle: "",
    metaDescription: "",
    keywords: "",
  };

  const setSeoField = (key: keyof SeoSettings, value: string) => {
    setSeo((prev) => ({
      ...prev,
      [seoPage]: { ...seoFor, [key]: value },
    }));
    setSeoSaved(false);
  };

  const publishedCount = pages.filter((p) => p.status === "published").length;

  const publishedPackages = useMemo(
    () =>
      mockPackages.filter(
        (p) => p.status !== "archived" && p.published !== false,
      ),
    [],
  );

  const handleSave = () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.slug.trim()) return;

    const now = new Date();
    const stamp = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
    const updated = { ...editing, updatedAt: stamp };

    setPages((prev) =>
      isNew
        ? [...prev, updated]
        : prev.map((p) => (p.id === updated.id ? updated : p)),
    );
    setEditing(null);
    setIsNew(false);
  };

  const togglePublish = (id: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: p.status === "published" ? "draft" : "published",
              updatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
            }
          : p,
      ),
    );
  };

  const handleDelete = (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
  };

  const startNew = () => {
    setEditing({
      id: `page-${crypto.randomUUID().slice(0, 8)}`,
      slug: "",
      title: "",
      content: "",
      status: "draft",
      updatedAt: "",
    });
    setIsNew(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("Pengurus Laman Web", "Website Manager")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "Urus laman web awam",
              "Manage the public website",
            )}
            {" — "}
            {publishedCount} / {pages.length}{" "}
            {t("halaman tayang.", "pages are live.")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/site" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              {t("Lihat Laman", "View Site")}
            </a>
          </Button>
          <Button size="sm" onClick={startNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("Halaman Baharu", "New Page")}
          </Button>
        </div>
      </div>

      {/* Site health summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-emerald-50 p-2">
              <Globe className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">
                {publishedCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("Halaman tayang", "Live pages")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-50 p-2">
              <LayoutDashboard className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">
                {publishedPackages.length}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("Pakej tayang", "Live packages")}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-50 p-2">
              <EyeOff className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">
                {pages.length - publishedCount}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("Draf tersembunyi", "Hidden drafts")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Banner manager */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-red-600" />
            <CardTitle className="text-base">
              {t("Bendera Promosi", "Promo Banners")}
            </CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setBannerEditing({
                id: `ban-${crypto.randomUUID().slice(0, 6)}`,
                title: "",
                subtitle: "",
                ctaLabel: "Lihat Detail",
                ctaHref: "/site/packages",
                startAt: new Date().toISOString().slice(0, 10),
                endAt: new Date(Date.now() + 30 * 864e5)
                  .toISOString()
                  .slice(0, 10),
                active: true,
              });
              setBannerIsNew(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {t("Bendera Baharu", "New Banner")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {banners.map((banner) => {
            const today = new Date().toISOString().slice(0, 10);
            const inWindow =
              banner.active &&
              banner.startAt <= today &&
              banner.endAt >= today;
            return (
              <div
                key={banner.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {banner.title || "(tanpa judul)"}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        inWindow
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : banner.active
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-stone-200 bg-stone-50 text-stone-600",
                      )}
                    >
                      {inWindow
                        ? t("Tayang", "Live")
                        : banner.active
                          ? t("Dijadualkan", "Scheduled")
                          : t("Nyahaktif", "Inactive")}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {banner.startAt} → {banner.endAt} • CTA: {banner.ctaLabel}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBannerEditing(banner);
                      setBannerIsNew(false);
                    }}
                    title={t("Sunting", "Edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setBanners((prev) =>
                        prev.map((b) =>
                          b.id === banner.id
                            ? { ...b, active: !b.active }
                            : b,
                        ),
                      )
                    }
                    title={banner.active ? t("Nyahaktifkan", "Deactivate") : t("Aktifkan", "Activate")}
                  >
                    {banner.active ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() =>
                      setBanners((prev) =>
                        prev.filter((b) => b.id !== banner.id),
                      )
                    }
                    title={t("Padam", "Delete")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {banners.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("Belum ada bendera.", "No banners yet.")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Banner editor overlay */}
      {bannerEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">
                {bannerIsNew ? t("Bendera Baharu", "New Banner") : t("Sunting Bendera", "Edit Banner")}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBannerEditing(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t("Tajuk", "Title")}</label>
                <Input
                  value={bannerEditing.title}
                  onChange={(e) =>
                    setBannerEditing({
                      ...bannerEditing,
                      title: e.target.value,
                    })
                  }
                  placeholder={t("cth: Promosi Hujung Tahun — Diskaun 20%", "e.g. Year-End Promo — 20% Off")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t("Subtajuk", "Subtitle")}</label>
                <Textarea
                  value={bannerEditing.subtitle}
                  onChange={(e) =>
                    setBannerEditing({
                      ...bannerEditing,
                      subtitle: e.target.value,
                    })
                  }
                  rows={2}
                  placeholder={t("Ayat sokongan ringkas", "Short supporting sentence")}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t("Label CTA", "CTA Label")}</label>
                  <Input
                    value={bannerEditing.ctaLabel}
                    onChange={(e) =>
                      setBannerEditing({
                        ...bannerEditing,
                        ctaLabel: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t("Pautan CTA", "CTA Link")}</label>
                  <Input
                    value={bannerEditing.ctaHref}
                    onChange={(e) =>
                      setBannerEditing({
                        ...bannerEditing,
                        ctaHref: e.target.value,
                      })
                    }
                    placeholder="/site/packages"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t("Tayang dari", "Live from")}</label>
                  <Input
                    type="date"
                    value={bannerEditing.startAt}
                    onChange={(e) =>
                      setBannerEditing({
                        ...bannerEditing,
                        startAt: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t("Hingga", "Until")}</label>
                  <Input
                    type="date"
                    value={bannerEditing.endAt}
                    onChange={(e) =>
                      setBannerEditing({
                        ...bannerEditing,
                        endAt: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={bannerEditing.active}
                    onChange={(e) =>
                      setBannerEditing({
                        ...bannerEditing,
                        active: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded"
                  />
                  {t("Aktif", "Active")}
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setBannerEditing(null)}
                  >
                    {t("Batal", "Cancel")}
                  </Button>
                  <Button
                    onClick={() => {
                      if (!bannerEditing.title.trim()) return;
                      setBanners((prev) =>
                        bannerIsNew
                          ? [...prev, bannerEditing]
                          : prev.map((b) =>
                              b.id === bannerEditing.id ? bannerEditing : b,
                            ),
                      );
                      setBannerEditing(null);
                      setBannerIsNew(false);
                    }}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {t("Simpan", "Save")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SEO settings */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-red-600" />
            <CardTitle className="text-base">
              {t("Tetapan SEO", "SEO Settings")}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={seoPage}
              onChange={(e) => {
                setSeoPage(e.target.value);
                setSeoSaved(false);
              }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm"
            >
              <option value="home">{t("Utama", "Home")} (/)</option>
              <option value="packages">{t("Pakej", "Packages")} (/packages)</option>
              <option value="promos">{t("Promosi", "Promos")} (/promos)</option>
            </select>
            <Button
              size="sm"
              onClick={() => {
                setSeoSaved(true);
                setTimeout(() => setSeoSaved(false), 2000);
              }}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {seoSaved ? t("Tersimpan!", "Saved!") : t("Simpan SEO", "Save SEO")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          {/* Inputs */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">
                  Meta Title
                </label>
                <span
                  className={cn(
                    "text-[10px]",
                    seoFor.metaTitle.length > 60
                      ? "text-red-600"
                      : "text-muted-foreground",
                  )}
                >
                  {seoFor.metaTitle.length}/60
                </span>
              </div>
              <Input
                value={seoFor.metaTitle}
                onChange={(e) => setSeoField("metaTitle", e.target.value)}
                placeholder={t("Tajuk dalam hasil carian", "Title in search results")}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">
                  Meta Description
                </label>
                <span
                  className={cn(
                    "text-[10px]",
                    seoFor.metaDescription.length > 160
                      ? "text-red-600"
                      : "text-muted-foreground",
                  )}
                >
                  {seoFor.metaDescription.length}/160
                </span>
              </div>
              <Textarea
                value={seoFor.metaDescription}
                onChange={(e) => setSeoField("metaDescription", e.target.value)}
                rows={3}
                placeholder={t("Penerangan ringkas yang muncul di Google", "Short description shown on Google")}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">
                {t("Kata kunci (asingkan dengan koma)", "Keywords (comma separated)")}
              </label>
              <Input
                value={seoFor.keywords}
                onChange={(e) => setSeoField("keywords", e.target.value)}
                placeholder={t("pakej pelancongan, open trip, …", "tour packages, open trip, …")}
              />
            </div>
          </div>

          {/* SERP preview */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("Pratonton Hasil Carian Google", "Google Search Preview")}
            </p>
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                  T
                </div>
                <div>
                  <p className="text-xs leading-tight text-stone-800">
                    ZAQONE TRAVEL
                  </p>
                  <p className="text-[11px] leading-tight text-stone-500">
                    zaqonetravel.com{seoPage === "home" ? "" : `/${seoPage}`}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-lg leading-snug text-[#1a0dab]">
                {seoFor.metaTitle || t("Tajuk halaman akan muncul di sini", "Page title will appear here")}
              </p>
              <p className="mt-1 text-sm leading-snug text-stone-600">
                {seoFor.metaDescription ||
                  t(
                    "Penerangan meta halaman akan muncul di sini. Tulis 120–160 aksara yang menerangkan kandungan halaman.",
                    "The page meta description will appear here. Write 120–160 characters describing the page.",
                  )}
              </p>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t(
                "Tips: meta title ideal 50–60 aksara, meta description 120–160 aksara. Tajuk melebihi had akan terpotong dalam hasil carian.",
                "Tips: ideal meta title is 50–60 characters, meta description 120–160. Longer titles get truncated in search results.",
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Website enquiries → leads preview */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-red-600" />
            <CardTitle className="text-base">
              {t("Lead dari Laman Web", "Website Leads")}
            </CardTitle>
            <Badge
              variant="outline"
              className="border-red-200 bg-red-50 text-red-700"
            >
              {enquiries.filter((e) => e.status === "new").length} {t("baharu", "new")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {enquiries.map((enq) => (
            <div
              key={enq.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{enq.name}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      enq.status === "new"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-stone-200 bg-stone-50 text-stone-600",
                    )}
                  >
                    {enq.status === "new"
                      ? t("Baharu", "New")
                      : t("Dihubungi", "Contacted")}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {enq.packageName} • {enq.pax} pax • {t("masuk", "received")} {enq.receivedAt}
                </p>
                {enq.message && (
                  <p className="mt-1 line-clamp-2 rounded-md bg-muted/40 px-2 py-1 text-xs italic text-muted-foreground">
                    “{enq.message}”
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={waLink(enq.phone)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                </Button>
                {enq.status === "new" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setEnquiries((prev) =>
                        prev.map((e) =>
                          e.id === enq.id
                            ? { ...e, status: "contacted" }
                            : e,
                        ),
                      )
                    }
                    title={t("Tandai sudah dihubungi", "Mark as contacted")}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {enquiries.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(
                "Belum ada pertanyaan masuk dari laman web.",
                "No website enquiries yet.",
              )}
            </p>
          )}
          <p className="pt-1 text-xs text-muted-foreground">
            {t(
              "Pertanyaan daripada borang awam disegerakkan secara automatik ke saluran Leads apabila backend aktif.",
              "Enquiries from the public form sync automatically to the Leads pipeline once the backend is live.",
            )}
          </p>
        </CardContent>
      </Card>

      {/* Pages table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t("Halaman", "Pages")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{page.title}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      page.status === "published"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : page.scheduledAt &&
                            page.scheduledAt > new Date().toISOString()
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-stone-200 bg-stone-50 text-stone-600",
                    )}
                  >
                    {page.status === "published"
                      ? t("Tayang", "Live")
                      : page.scheduledAt &&
                          page.scheduledAt > new Date().toISOString()
                        ? t("Dijadualkan", "Scheduled")
                        : t("Draf", "Draft")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  /site/{page.slug === "home" ? "" : page.slug} • {t("diubah", "updated")}{" "}
                  {page.updatedAt}
                  {page.scheduledAt &&
                    ` • ${t("dijadualkan", "scheduled")} ${page.scheduledAt.replace("T", " ")}`}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewSlug(page.slug)}
                  title={t("Pratonton", "Preview")}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(page);
                    setIsNew(false);
                  }}
                  title={t("Sunting", "Edit")}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePublish(page.id)}
                  title={page.status === "published" ? t("Tarik", "Unpublish") : t("Terbitkan", "Publish")}
                >
                  {page.status === "published" ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(page.id)}
                  title={t("Padam", "Delete")}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {pages.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("Belum ada halaman.", "No pages yet.")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Editor overlay */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">
                {isNew
                  ? t("Halaman Baharu", "New Page")
                  : `${t("Sunting", "Edit")}: ${editing.title}`}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t("Tajuk", "Title")}</label>
                  <Input
                    value={editing.title}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        title: e.target.value,
                        slug: isNew
                          ? slugify(e.target.value)
                          : editing.slug,
                      })
                    }
                    placeholder={t("cth: Syarat & Ketentuan", "e.g. Terms & Conditions")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">{t("Slug URL", "URL Slug")}</label>
                  <Input
                    value={editing.slug}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        slug: slugify(e.target.value),
                      })
                    }
                    placeholder={t("syarat-ketentuan", "terms-and-conditions")}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t("Kandungan", "Content")}</label>
                <Textarea
                  value={editing.content}
                  onChange={(e) =>
                    setEditing({ ...editing, content: e.target.value })
                  }
                  rows={6}
                  placeholder={t("Isi halaman…", "Page content…")}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={editing.status === "published"}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          status: e.target.checked ? "published" : "draft",
                          scheduledAt: e.target.checked
                            ? undefined
                            : editing.scheduledAt,
                        })
                      }
                      className="h-4 w-4 rounded"
                    />
                    {t("Terbitkan segera", "Publish immediately")}
                  </label>
                  {editing.status !== "published" && (
                    <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
                      <input
                        type="checkbox"
                        checked={Boolean(editing.scheduledAt)}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            scheduledAt: e.target.checked
                              ? new Date(
                                  Date.now() + 24 * 60 * 60 * 1000,
                                )
                                  .toISOString()
                                  .slice(0, 16)
                              : undefined,
                          })
                        }
                        className="h-4 w-4 rounded"
                      />
                      {t("Jadualkan terbit", "Schedule publish")}
                    </label>
                  )}
                  {editing.status !== "published" && editing.scheduledAt && (
                    <Input
                      type="datetime-local"
                      value={editing.scheduledAt}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          scheduledAt: e.target.value,
                        })
                      }
                      className="h-8 w-56 text-xs"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    {t("Batal", "Cancel")}
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {t("Simpan", "Save")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Preview overlay */}
      {previewSlug && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreviewSlug(null)}
        >
          <Card
            className="w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">
                {t("Pratonton", "Preview")}: /site/{previewSlug}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewSlug(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed">
                <p className="font-semibold">
                  {pages.find((p) => p.slug === previewSlug)?.title}
                </p>
                <p className="mt-2 whitespace-pre-line text-muted-foreground">
                  {pages.find((p) => p.slug === previewSlug)?.content}
                </p>
              </div>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {t(
                  "Pratonton statik — klik di mana-mana untuk menutup.",
                  "Static preview — click anywhere to close.",
                )}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

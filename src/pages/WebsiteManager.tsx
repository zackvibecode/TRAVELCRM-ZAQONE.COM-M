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
} from "lucide-react";
import { mockPackages } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
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
      "TravelOS adalah travel agency dengan 8 tahun pengalaman melayani 12.000+ traveler.",
    status: "draft",
    updatedAt: "2026-11-08 16:45",
  },
  {
    id: "page-contact",
    slug: "contact",
    title: "Kontak",
    content:
      "Kantor: Jl. Sudirman Kav. 52, Jakarta. Telepon: +62 21 5555 0123. Email: hello@travelos.id.",
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

export default function WebsiteManager() {
  const [pages, setPages] = useState<SitePage[]>(INITIAL_PAGES);
  const [editing, setEditing] = useState<SitePage | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

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
          <h1 className="text-2xl font-bold tracking-tight">Website Manager</h1>
          <p className="text-sm text-muted-foreground">
            Kelola halaman website publik — {publishedCount} dari {pages.length}{" "}
            halaman tayang.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/site" target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Lihat Situs
            </a>
          </Button>
          <Button size="sm" onClick={startNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Halaman Baru
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
              <p className="text-xs text-muted-foreground">Halaman tayang</p>
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
              <p className="text-xs text-muted-foreground">Paket tayang</p>
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
              <p className="text-xs text-muted-foreground">Draft tersembunyi</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pages table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Halaman</CardTitle>
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
                        : "border-stone-200 bg-stone-50 text-stone-600",
                    )}
                  >
                    {page.status === "published" ? "Tayang" : "Draft"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  /site/{page.slug === "home" ? "" : page.slug} • diubah{" "}
                  {page.updatedAt}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewSlug(page.slug)}
                  title="Pratinjau"
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
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => togglePublish(page.id)}
                  title={page.status === "published" ? "Tarik" : "Terbitkan"}
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
                  title="Hapus"
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {pages.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Belum ada halaman.
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
                {isNew ? "Halaman Baru" : `Edit: ${editing.title}`}
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
                  <label className="text-xs font-medium">Judul</label>
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
                    placeholder="cth: Syarat & Ketentuan"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Slug URL</label>
                  <Input
                    value={editing.slug}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        slug: slugify(e.target.value),
                      })
                    }
                    placeholder="syarat-ketentuan"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Konten</label>
                <Textarea
                  value={editing.content}
                  onChange={(e) =>
                    setEditing({ ...editing, content: e.target.value })
                  }
                  rows={6}
                  placeholder="Isi halaman…"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={editing.status === "published"}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        status: e.target.checked ? "published" : "draft",
                      })
                    }
                    className="h-4 w-4 rounded"
                  />
                  Terbitkan segera
                </label>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditing(null)}>
                    Batal
                  </Button>
                  <Button onClick={handleSave}>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Simpan
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
                Pratinjau: /site/{previewSlug}
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
                Pratinjau statis — klik di mana saja untuk menutup.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

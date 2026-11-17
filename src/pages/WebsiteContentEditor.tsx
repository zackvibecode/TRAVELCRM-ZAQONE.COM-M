import { useEffect, useRef, useState } from "react";
import {
  AlignLeft,
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  ChevronRight,
  Circle,
  Eye,
  EyeOff,
  Heading,
  Image,
  Layers,
  Link2,
  List,
  MousePointerClick,
  Plus,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BlockKind = "heading" | "text" | "hero" | "list" | "cta";

interface Block {
  id: string;
  kind: BlockKind;
  value: string;
}

const KIND_META: Record<BlockKind, { ms: string; en: string; icon: typeof Heading }> = {
  heading: { ms: "Tajuk Seksyen", en: "Section heading", icon: Heading },
  text: { ms: "Perenggan", en: "Paragraph", icon: AlignLeft },
  hero: { ms: "Imej Hero", en: "Hero image", icon: Image },
  list: { ms: "Senarai Sorotan", en: "Highlight list", icon: List },
  cta: { ms: "Butang Tindakan", en: "Call-to-action button", icon: MousePointerClick },
};

const INITIAL_BLOCKS: Block[] = [
  { id: "blk-1", kind: "heading", value: "Four days in Langkawi" },
  { id: "blk-2", kind: "text", value: "This package covers three nights in a beachfront resort, airport transfers and a sunset mangrove cruise with an English-speaking guide." },
  { id: "blk-3", kind: "hero", value: "langkawi-hero.jpg" },
  { id: "blk-4", kind: "list", value: "Beachfront resort near Pantai Cenang|Daily breakfast for two|Return airport transfers" },
  { id: "blk-5", kind: "cta", value: "Book now" },
];

const DEFAULTS: Record<BlockKind, string> = {
  heading: "New section heading",
  text: "",
  hero: "new-image.jpg",
  list: "First point|Second point",
  cta: "Book now",
};

let nextBlockId = 6;

export default function WebsiteContentEditor() {
  const { t } = useLang();
  const [title, setTitle] = useState("Langkawi 4D3N promo");
  const [slug, setSlug] = useState("promo/langkawi-4d3n");
  const [type, setType] = useState("Promo page");
  const [summary, setSummary] = useState("Save 18% on March–April 2025 departures, limited to 24 travellers.");
  const [blocks, setBlocks] = useState(INITIAL_BLOCKS);
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [status, setStatus] = useState<"Draft" | "Published">("Draft");
  const [visible, setVisible] = useState(true);
  const [showInMenu, setShowInMenu] = useState(true);
  const [savedAt, setSavedAt] = useState(t("Semalam 16:40", "Yesterday 16:40"));
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [publishOpen, setPublishOpen] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function showNotice(message: string) {
    window.clearTimeout(toastTimer.current);
    setNotice(message);
    toastTimer.current = window.setTimeout(() => setNotice(""), 4000);
  }

  function touch() {
    setDirty(true);
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = t("Tajuk halaman wajib diisi", "Page title is required.");
    if (!slug.trim()) next.slug = t("Slug wajib diisi", "Slug is required.");
    else if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(slug.trim()))
      next.slug = t("Guna huruf kecil, nombor, hyphen atau slash", "Use lowercase letters, numbers, hyphens or slashes.");
    if (metaTitle.length > 60) next.metaTitle = t("Meta title tidak lebih 60 aksara", "Meta title should be 60 characters or fewer.");
    if (metaDesc.length > 160) next.metaDesc = t("Meta description tidak lebih 160 aksara", "Meta description should be 160 characters or fewer.");
    return next;
  }

  function saveDraft(e?: React.FormEvent) {
    e?.preventDefault?.();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = document.getElementById(
        found.title ? "wce-title" : found.slug || found.metaTitle ? "wce-slug" : "wce-meta-desc",
      );
      first?.focus();
      return;
    }
    setSavedAt(t("Baru saja", "Just now"));
    setDirty(false);
    showNotice(t("Draf disimpan — belum tayang di laman", "Draft saved — not live on the site yet"));
  }

  function openPublish() {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setPublishOpen(true);
  }

  function confirmPublish() {
    setStatus("Published");
    setSavedAt(t("Baru saja", "Just now"));
    setDirty(false);
    setPublishOpen(false);
    showNotice(t(`"${title.trim()}" diterbitkan ke zaqone.my`, `"${title.trim()}" published to zaqone.my`));
  }

  function updateBlock(id: string, value: string) {
    setBlocks((current) => current.map((b) => (b.id === id ? { ...b, value } : b)));
    touch();
  }

  function moveBlock(id: string, direction: number) {
    setBlocks((current) => {
      const index = current.findIndex((b) => b.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
    touch();
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((b) => b.id !== id));
    touch();
  }

  function addBlock(kind: BlockKind) {
    nextBlockId += 1;
    setBlocks((current) => [...current, { id: `blk-${nextBlockId}`, kind, value: DEFAULTS[kind] }]);
    touch();
  }

  const previewTitle = metaTitle.trim() || title.trim() || t("Tajuk halaman tidak ditetapkan", "Page title not set");
  const previewDesc = metaDesc.trim() || summary.trim() || t("Tiada meta description lagi", "No meta description for this page yet.");
  const previewUrl = `zaqone.my/${slug.trim().replace(/^\/+/, "")}`;

  const inputCls =
    "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const textareaCls =
    "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
  const btnCls = "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-semibold hover:bg-muted/50";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
        <a href="/website" className="font-semibold text-muted-foreground hover:text-foreground" style={{ textDecoration: "none" }}>
          {t("Pengurus Laman Web", "Website Manager")}
        </a>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{t("Editor Kandungan", "Content editor")}</span>
      </div>

      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight">{title.trim() || t("Halaman tanpa tajuk", "Untitled page")}</h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold",
                status === "Published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
              )}
            >
              {status === "Published" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              {status === "Published" ? t("Diterbitkan", "Published") : t("Draf", "Draft")}
            </span>
          </div>
          <p className="mt-2 flex flex-wrap gap-2 text-[12.5px] text-muted-foreground">
            <span>{t("Disimpan", "Saved")} {savedAt}</span>
            {dirty && <span className="font-semibold text-amber-600">· {t("perubahan belum disimpan", "unsaved changes")}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/website" className={btnCls} style={{ textDecoration: "none" }}>
            <ArrowLeft className="h-4 w-4" />
            {t("Kembali", "Back")}
          </a>
          <button type="button" onClick={() => showNotice(t("Pratonton halaman dengan kandungan semasa", "Page preview rendered with the current content"))} className={btnCls}>
            <Eye className="h-4 w-4" />
            {t("Pratonton", "Preview")}
          </button>
          <button type="button" onClick={() => saveDraft()} className={btnCls}>
            <Save className="h-4 w-4" />
            {t("Simpan Draf", "Save draft")}
          </button>
          <button type="button" onClick={openPublish} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-white hover:bg-primary/90">
            <UploadCloud className="h-4 w-4" />
            {t("Terbitkan", "Publish")}
          </button>
        </div>
      </header>

      {/* Layout */}
      <form onSubmit={saveDraft} noValidate className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] items-start">
        {/* Left column */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Page details */}
          <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="border-b px-5 py-3.5">
              <h2 className="font-display text-[15px] font-bold">{t("Butiran Halaman", "Page details")}</h2>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="wce-title" className="flex items-center justify-between text-[12.5px] font-semibold text-muted-foreground">
                  {t("Tajuk Halaman", "Page title")}
                  <span className="font-normal [font-variant-numeric:tabular-nums]">{title.length}/70</span>
                </label>
                <input
                  id="wce-title"
                  value={title}
                  aria-invalid={!!errors.title}
                  onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: "" })); touch(); }}
                  className={cn(inputCls, errors.title && "border-red-400")}
                />
                {errors.title && <p className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" />{errors.title}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wce-slug" className="text-[12.5px] font-semibold text-muted-foreground">{t("Slug URL", "Slug URL")}</label>
                  <div className="flex items-center rounded-md border border-input bg-muted/40 pl-2 shadow-sm focus-within:ring-1 focus-within:ring-ring">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">zaqone.my/</span>
                    <input
                      id="wce-slug"
                      value={slug}
                      aria-invalid={!!errors.slug}
                      onChange={(e) => { setSlug(e.target.value); setErrors((p) => ({ ...p, slug: "" })); touch(); }}
                      className="h-9 min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none"
                    />
                  </div>
                  {errors.slug && <p className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" />{errors.slug}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wce-type" className="text-[12.5px] font-semibold text-muted-foreground">{t("Jenis Halaman", "Page type")}</label>
                  <select
                    id="wce-type"
                    value={type}
                    onChange={(e) => { setType(e.target.value); touch(); }}
                    className={cn(inputCls, "bg-white")}
                  >
                    {["Promo page", "Landing page", "Catalogue", "Static page"].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="wce-summary" className="flex items-center justify-between text-[12.5px] font-semibold text-muted-foreground">
                  {t("Ringkasan Pendek", "Short summary")}
                  <span className="font-normal [font-variant-numeric:tabular-nums]">{summary.length}/160</span>
                </label>
                <textarea
                  id="wce-summary"
                  value={summary}
                  onChange={(e) => { setSummary(e.target.value); touch(); }}
                  rows={3}
                  className={textareaCls}
                />
                <span className="text-xs text-muted-foreground">
                  {t("Dipaparkan pada kad promo dan petikan carian laman.", "Shown on promo cards and in site search snippets.")}
                </span>
              </div>
            </div>
          </section>

          {/* Content blocks */}
          <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h2 className="font-display text-[15px] font-bold">{t("Kandungan", "Content")}</h2>
              <span className="text-xs text-muted-foreground [font-variant-numeric:tabular-nums]">{blocks.length} {t("blok", "blocks")}</span>
            </div>
            {blocks.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="font-semibold">{t("Halaman ini belum ada kandungan", "This page has no content yet")}</p>
                <p className="mt-1.5 text-[13px] text-muted-foreground">{t("Tambah blok pertama di bawah untuk mula membina kandungan.", "Add the first block below to start building the content.")}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3 p-5">
                {blocks.map((block, index) => {
                  const meta = KIND_META[block.kind];
                  const Icon = meta.icon;
                  const fieldId = `wce-block-${block.id}`;
                  return (
                    <li key={block.id} className="overflow-hidden rounded-lg border">
                      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2">
                        <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                          {t(meta.ms, meta.en)}
                        </span>
                        <div className="ml-auto flex gap-1">
                          <button type="button" aria-label={`${t("Alih blok", "Move block")} ${index + 1} ${t("atas", "up")}`} disabled={index === 0} onClick={() => moveBlock(block.id, -1)} className="grid h-7 w-7 place-items-center rounded border bg-white hover:bg-muted disabled:opacity-40">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" aria-label={`${t("Alih blok", "Move block")} ${index + 1} ${t("bawah", "down")}`} disabled={index === blocks.length - 1} onClick={() => moveBlock(block.id, 1)} className="grid h-7 w-7 place-items-center rounded border bg-white hover:bg-muted disabled:opacity-40">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" aria-label={`${t("Padam blok", "Delete block")} ${index + 1}`} onClick={() => removeBlock(block.id)} className="grid h-7 w-7 place-items-center rounded border border-red-200 bg-white text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 p-3">
                        {block.kind === "hero" ? (
                          <>
                            <div className="flex h-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/30 text-xs text-muted-foreground">
                              <Image className="h-5 w-5" />
                              {t("Imej Hero 1600×900", "Hero image 1600×900")}
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <label htmlFor={fieldId} className="text-[12.5px] font-semibold text-muted-foreground">{t("Nama Fail", "File name")}</label>
                              <input id={fieldId} value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} className={inputCls} />
                            </div>
                          </>
                        ) : block.kind === "list" ? (
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor={fieldId} className="flex items-center justify-between text-[12.5px] font-semibold text-muted-foreground">
                              {t("Titik Sorotan", "Highlight points")}
                              <span className="font-normal">{t("satu titik setiap baris", "one point per line")}</span>
                            </label>
                            <textarea
                              id={fieldId}
                              value={block.value.split("|").join(" | ")}
                              onChange={(e) => updateBlock(block.id, e.target.value.split(" | ").join("|"))}
                              rows={3}
                              className={textareaCls}
                            />
                          </div>
                        ) : block.kind === "text" ? (
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor={fieldId} className="text-[12.5px] font-semibold text-muted-foreground">{t("Teks Perenggan", "Paragraph text")}</label>
                            <textarea id={fieldId} value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} rows={3} className={textareaCls} />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <label htmlFor={fieldId} className="text-[12.5px] font-semibold text-muted-foreground">
                              {block.kind === "cta" ? t("Label Butang", "Button label") : t("Tajuk Seksyen", "Section heading")}
                            </label>
                            <input id={fieldId} value={block.value} onChange={(e) => updateBlock(block.id, e.target.value)} className={inputCls} />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 border-t p-4">
              {(Object.keys(KIND_META) as BlockKind[]).map((kind) => (
                  <button key={kind} type="button" onClick={() => addBlock(kind)} className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/50">
                    <Plus className="h-3.5 w-3.5" />
                    {t(KIND_META[kind].ms, KIND_META[kind].en)}
                  </button>
                ))}
            </div>
          </section>
        </div>

        {/* Right column */}
        <aside className="flex min-w-0 flex-col gap-4">
          {/* SEO */}
          <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h2 className="font-display text-[15px] font-bold">SEO</h2>
              <span className={cn("text-xs font-semibold", errors.metaTitle || errors.metaDesc ? "text-red-600" : "text-muted-foreground")}>
                {errors.metaTitle || errors.metaDesc
                  ? t("Perlu dibaiki", "Needs adjusting")
                  : metaTitle && metaDesc
                    ? t("Lengkap", "Complete")
                    : t("Belum lengkap", "Incomplete")}
              </span>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="wce-meta-title" className="flex items-center justify-between text-[12.5px] font-semibold text-muted-foreground">
                  {t("Meta Title", "Meta title")}
                  <span className={cn("font-normal [font-variant-numeric:tabular-nums]", metaTitle.length > 60 && "text-red-600")}>{metaTitle.length}/60</span>
                </label>
                <input
                  id="wce-meta-title"
                  value={metaTitle}
                  placeholder={title || t("Meta title halaman", "Page meta title")}
                  aria-invalid={!!errors.metaTitle}
                  onChange={(e) => { setMetaTitle(e.target.value); setErrors((p) => ({ ...p, metaTitle: "" })); touch(); }}
                  className={cn(inputCls, errors.metaTitle && "border-red-400")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="wce-meta-desc" className="flex items-center justify-between text-[12.5px] font-semibold text-muted-foreground">
                  {t("Meta Description", "Meta description")}
                  <span className={cn("font-normal [font-variant-numeric:tabular-nums]", metaDesc.length > 160 && "text-red-600")}>{metaDesc.length}/160</span>
                </label>
                <textarea
                  id="wce-meta-desc"
                  value={metaDesc}
                  placeholder={summary || t("Ringkasan untuk hasil carian", "Summary for search results")}
                  aria-invalid={!!errors.metaDesc}
                  onChange={(e) => { setMetaDesc(e.target.value); setErrors((p) => ({ ...p, metaDesc: "" })); touch(); }}
                  rows={3}
                  className={cn(textareaCls, errors.metaDesc && "border-red-400")}
                />
                {(errors.metaTitle || errors.metaDesc) && <p className="flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle className="h-3.5 w-3.5" />{errors.metaTitle || errors.metaDesc}</p>}
              </div>
              <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 p-3" aria-live="polite">
                <span className="text-[11px] text-emerald-700">{previewUrl}</span>
                <span className={cn("text-[13px] font-medium", metaTitle.trim() ? "text-sky-700" : "text-muted-foreground")}>{previewTitle}</span>
                <span className={cn("text-[11.5px] leading-snug", metaDesc.trim() || summary.trim() ? "text-muted-foreground" : "italic text-muted-foreground")}>{previewDesc}</span>
              </div>
            </div>
          </section>

          {/* Visibility */}
          <section className="overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--color-surface)]">
            <div className="border-b px-5 py-3.5">
              <h2 className="font-display text-[15px] font-bold">{t("Keterlihatan", "Visibility")}</h2>
            </div>
            <div className="flex flex-col gap-3 p-5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={visible} onChange={(e) => { setVisible(e.target.checked); touch(); }} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
                <span className="min-w-0">
                  <strong className="block text-[13px]">{t("Tayang di laman awam", "Show on the public site")}</strong>
                  <span className="text-xs text-muted-foreground">
                    {visible ? t("Pengunjung boleh membuka halaman ini.", "Visitors can open this page.") : t("Halaman disembunyikan daripada pengunjung.", "Page is hidden from visitors.")}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input type="checkbox" checked={showInMenu} onChange={(e) => { setShowInMenu(e.target.checked); touch(); }} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
                <span className="min-w-0">
                  <strong className="block text-[13px]">{t("Pautan dalam menu navigasi", "Link in the navigation menu")}</strong>
                  <span className="text-xs text-muted-foreground">
                    {showInMenu ? t("Dipaparkan dalam menu utama laman.", "Appears in the main site menu.") : t("Boleh dicapai melalui pautan terus sahaja.", "Reachable only through a direct link.")}
                  </span>
                </span>
              </label>
              <ul className="mt-2 flex flex-col gap-1.5 border-t pt-3 text-xs">
                <li className="flex items-center gap-1.5">
                  {title.trim() ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Circle className="h-3.5 w-3.5 text-muted-foreground" />}
                  {t("Tajuk halaman", "Page title")}
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {t("Meta title guna tajuk halaman jika kosong", "Meta title falls back to the page title when empty")}
                </li>
                <li className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {t("Meta description guna ringkasan jika kosong", "Meta description falls back to the summary when empty")}
                </li>
              </ul>
            </div>
          </section>
        </aside>
      </form>

      {/* Publish dialog */}
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Terbitkan halaman ini?", "Publish this page?")}</DialogTitle>
            <DialogDescription>
              {t("Perubahan terus tayang di zaqone.my dan boleh dilihat pengunjung.", "Changes go live on zaqone.my straight away and visitors can see them.")}
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2 text-[13px]">
            <li className="flex items-center gap-2"><Link2 className="h-4 w-4 text-muted-foreground" />{previewUrl}</li>
            <li className="flex items-center gap-2"><Layers className="h-4 w-4 text-muted-foreground" />{blocks.length} {t("blok kandungan", "content blocks")}</li>
            <li className="flex items-center gap-2">
              {visible ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              {visible ? t("Ditayang di laman awam", "Shown on the public site") : t("Disembunyikan daripada pengunjung", "Hidden from visitors")}
            </li>
          </ul>
          <DialogFooter>
            <button onClick={() => setPublishOpen(false)} className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
              {t("Batal", "Cancel")}
            </button>
            <button onClick={confirmPublish} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90">
              <UploadCloud className="h-4 w-4" />
              {t("Terbitkan Sekarang", "Publish now")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {notice && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-[80] flex max-w-[340px] items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-text)] px-4 py-3 text-[13px] text-[var(--color-surface)] shadow-2xl">
          <CheckCircle2 className="h-4 w-4 flex-none text-emerald-300" />
          <span className="min-w-0 flex-1">{notice}</span>
          <button aria-label={t("Tutup notifikasi", "Dismiss notification")} onClick={() => { window.clearTimeout(toastTimer.current); setNotice(""); }} className="grid h-6 w-6 flex-none place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

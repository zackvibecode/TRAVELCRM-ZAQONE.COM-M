import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export type PublicBlockKind =
  | "heading"
  | "text"
  | "hero"
  | "list"
  | "cta"
  | "itinerary"
  | "pricing"
  | "gallery"
  | "notice";

export interface PublicBlock {
  id: string;
  kind: PublicBlockKind;
  value: string;
  /** Optional structured payload (itinerary days, price rows, images). */
  data?: Record<string, unknown>;
}

interface PagePayload {
  title: string;
  summary?: string;
  blocks?: PublicBlock[];
}

interface ItineraryDay {
  dayNumber: number;
  title: string;
  description: string;
  mealIncluded: string[];
}

interface PriceRow {
  label: string;
  amount: string;
  note?: string;
}

/**
 * Public CMS page — renders a published site_pages row from D1.
 * Content may be JSON ({ title, summary, blocks }) written by the Website
 * Content Editor, or legacy plain text. JSON renders as structured sections;
 * plain text falls back to simple paragraphs.
 *
 * `/site/p/:slug` renders the published page.
 * `/site/preview/:slug` renders a draft for staff (via /website/preview/*).
 */
export default function PublicCmsPage() {
  const { t } = useLang();
  const [page, setPage] = useState<PagePayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [openDays, setOpenDays] = useState<number[]>([0]);

  const route = useMemo(() => {
    const path = window.location.pathname;
    const preview = path.match(/^\/site(?:\/(?:ms|en))?\/preview\//);
    if (preview) {
      return { isPreview: true, slug: path.slice(path.indexOf("/preview/") + "/preview/".length) };
    }
    const normal = path.match(/^\/site(?:\/(?:ms|en))?\/p\//);
    if (normal) {
      return { isPreview: false, slug: path.slice(path.indexOf("/p/") + "/p/".length) };
    }
    return { isPreview: false, slug: "" };
  }, []);

  useEffect(() => {
    const slug = decodeURIComponent(route.slug).replace(/^\/+|\/+$/g, "");
    if (!slug) {
      setStatus("missing");
      return;
    }
    (async () => {
      try {
        const endpoint = route.isPreview
          ? `/website/preview/${slug.split("/").map(encodeURIComponent).join("/")}`
          : `/website/pages/${slug.split("/").map(encodeURIComponent).join("/")}`;
        const res = await apiFetch<{ page?: { title: string; content: string; status?: string } }>(
          endpoint,
        );
        const raw = res.page?.content ?? "";
        let payload: PagePayload;
        try {
          const parsed = JSON.parse(raw) as PagePayload;
          payload = {
            title: parsed.title || res.page?.title || slug,
            summary: parsed.summary,
            blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
          };
        } catch {
          payload = { title: res.page?.title || slug };
          // Legacy plain-text content — expose via synthetic text block.
          if (raw.trim()) {
            payload.blocks = [{ id: "txt-1", kind: "text", value: raw }];
          }
        }
        setPage(payload);
        setStatus("ready");
      } catch {
        setStatus("missing");
      }
    })();
  }, [route.isPreview, route.slug]);

  function toggleDay(index: number) {
    setOpenDays((current) =>
      current.includes(index) ? current.filter((i) => i !== index) : [...current, index],
    );
  }

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
        {t("Sedang memuatkan…", "Loading…")}
      </div>
    );
  }

  if (status === "missing" || !page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">
          {t("Halaman tidak dijumpai", "Page not found")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "Halaman ini belum diterbitkan atau telah dipadam.",
            "This page is not published yet or has been removed.",
          )}
        </p>
        <Button variant="outline" className="mt-6" asChild>
          <a href="/site">{t("Kembali ke Utama", "Back to Home")}</a>
        </Button>
      </div>
    );
  }

  const blocks = page.blocks ?? [];
  const hero = blocks.find((b) => b.kind === "hero" && b.value);

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Hero */}
      {hero && (
        <img
          src={hero.value}
          alt={page.title}
          className="mb-8 aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover"
        />
      )}

      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{page.title}</h1>
        {page.summary && (
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">{page.summary}</p>
        )}
      </header>

      {/* Structured blocks */}
      <div className="flex flex-col gap-6">
        {blocks
          .filter((b) => b.kind !== "hero")
          .map((b) => {            if (b.kind === "heading") {
              return (
                <h2 key={b.id} className="font-display text-xl font-bold tracking-tight">
                  {b.value}
                </h2>
              );
            }
            if (b.kind === "text") {
              return (
                <p key={b.id} className="whitespace-pre-line text-[15px] leading-relaxed">
                  {b.value}
                </p>
              );
            }
            if (b.kind === "list") {
              const items = b.value.split("|").map((s) => s.trim()).filter(Boolean);
              return (
                <ul key={b.id} className="flex flex-col gap-2">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[15px]">
                      <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              );
            }
            if (b.kind === "itinerary") {
              const days = (Array.isArray(b.data?.days) ? b.data?.days : []) as ItineraryDay[];
              if (days.length === 0) return null;
              return (
                <section key={b.id} className="flex flex-col gap-3">
                  {b.value && (
                    <h2 className="font-display text-xl font-bold tracking-tight">{b.value}</h2>
                  )}
                  <div className="flex flex-col gap-2">
                    {days.map((day, index) => {
                      const open = openDays.includes(index);
                      return (
                        <div
                          key={`${b.id}-${day.dayNumber}-${index}`}
                          className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
                        >
                          <button
                            type="button"
                            onClick={() => toggleDay(index)}
                            aria-expanded={open}
                            aria-controls={`cms-day-${b.id}-${index}`}
                            className="flex w-full items-center gap-3 p-3 px-4 text-left hover:bg-[var(--color-surface-raised)]"
                          >
                            <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--color-primary-soft)] text-[12px] font-bold text-[var(--color-primary)]">
                              {day.dayNumber}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold">
                                {day.title || `Hari ${day.dayNumber}`}
                              </span>
                              {day.mealIncluded?.length ? (
                                <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">
                                  {day.mealIncluded.join(" · ")}
                                </span>
                              ) : null}
                            </span>
                            <ChevronDown
                              className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                            />
                          </button>
                          {open && (
                            <div
                              id={`cms-day-${b.id}-${index}`}
                              className="border-t px-4 pb-4 pt-3"
                            >
                              {day.description && (
                                <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-muted-foreground">
                                  {day.description}
                                </p>
                              )}
                              {day.mealIncluded?.length ? (
                                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                                  {day.mealIncluded.map((meal) => (
                                    <li
                                      key={meal}
                                      className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                                    >
                                      {meal}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            }
            if (b.kind === "pricing") {
              const rows = (Array.isArray(b.data?.rows) ? b.data?.rows : []) as PriceRow[];
              if (rows.length === 0) return null;
              return (
                <section key={b.id} className="flex flex-col gap-3">
                  {b.value && (
                    <h2 className="font-display text-xl font-bold tracking-tight">{b.value}</h2>
                  )}
                  <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)]">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b bg-[var(--color-surface-muted)]">
                          <th className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                            {t("Kategori", "Category")}
                          </th>
                          <th className="px-4 py-2.5 text-right text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                            {t("Harga", "Price")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr key={`${b.id}-row-${i}`} className="border-b last:border-0">
                            <td className="px-4 py-3 text-[14px] font-medium">
                              {row.label}
                              {row.note ? (
                                <span className="mt-0.5 block text-[12px] text-muted-foreground">
                                  {row.note}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right text-[14px] font-bold text-[var(--color-primary)]">
                              {row.amount}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            }
            if (b.kind === "gallery") {
              const images = (Array.isArray(b.data?.images) ? b.data?.images : []) as string[];
              if (images.length === 0) return null;
              return (
                <section key={b.id} className="flex flex-col gap-3">
                  {b.value && (
                    <h2 className="font-display text-xl font-bold tracking-tight">{b.value}</h2>
                  )}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {images.map((src, i) => (
                      <img
                        key={`${b.id}-img-${i}`}
                        src={src}
                        alt=""
                        loading="lazy"
                        className="aspect-[4/3] w-full rounded-[var(--radius-card)] object-cover"
                      />
                    ))}
                  </div>
                </section>
              );
            }
            if (b.kind === "notice") {
              return (
                <div
                  key={b.id}
                  className="flex items-start gap-2.5 rounded-[var(--radius-card)] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-4 text-[13.5px]"
                >
                  <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--color-primary)] text-white">
                    <X className="h-3 w-3 rotate-45" />
                  </span>
                  <span className="whitespace-pre-line">{b.value}</span>
                </div>
              );
            }
            if (b.kind === "cta" && b.value.trim()) {
              return (
                <div key={b.id} className="rounded-[var(--radius-card)] border bg-[var(--color-surface-muted)] p-6 text-center">
                  <p className="font-display text-lg font-bold">{b.value}</p>
                  <Button className="mt-4" asChild>
                    <a href="/site/packages">
                      {t("Tempah Sekarang", "Book Now")}
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              );
            }
            return null;
          })}
      </div>
    </article>
  );
}

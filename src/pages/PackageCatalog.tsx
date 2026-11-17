import { useEffect, useMemo, useState } from "react";
import {
  Search,
  CalendarDays,
  UsersRound,
  ArrowRight,
  Pencil,
  Plus,
} from "lucide-react";
import { fetchPackages } from "@/lib/live-data";
import type { TravelPackage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import PackageForm from "@/components/PackageForm";

type PkgStatus = "published" | "draft" | "archived";

function statusOf(p: TravelPackage): PkgStatus {
  if (p.status === "archived") return "archived";
  if (p.published === false) return "draft";
  return "published";
}

const STATUS_PILL: Record<
  PkgStatus,
  { label: string; bg: string; fg: string }
> = {
  published: {
    label: "Published",
    bg: "var(--color-success-soft)",
    fg: "var(--color-success)",
  },
  draft: {
    label: "Draft",
    bg: "var(--color-warning-soft)",
    fg: "var(--color-warning)",
  },
  archived: {
    label: "Archived",
    bg: "var(--color-neutral-soft)",
    fg: "var(--color-text-secondary)",
  },
};

const CATEGORIES = ["All", "Beach", "Islands", "Culture", "Mountains", "Nature"];

function categoryOf(p: TravelPackage): string {
  // The live schema has no category field; derive one from the destination for filtering.
  const d = p.destination.toLowerCase();
  if (/langkawi|penang|bali|beach|pantai/.test(d)) return "Beach";
  if (/perhentian|redang|tioman|island|pulau|maldives/.test(d)) return "Islands";
  if (/japan|korea|turkey|istanbul|heritage|kota|city/.test(d)) return "Culture";
  if (/bromo|mount|gunung|alpine/.test(d)) return "Mountains";
  if (/borneo|rainforest|safari|nature|hutan/.test(d)) return "Nature";
  return "Culture";
}

function StatusPill({ status }: { status: PkgStatus }) {
  const tone = STATUS_PILL[status];
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {tone.label}
    </span>
  );
}

export default function PackageCatalog() {
  const { t } = useLang();
  const [allPackages, setAllPackages] = useState<TravelPackage[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TravelPackage | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchPackages();
      if (cancelled) return;
      setAllPackages(res.packages);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const overview = useMemo(() => {
    const published = allPackages.filter((p) => statusOf(p) === "published").length;
    const draft = allPackages.filter((p) => statusOf(p) === "draft").length;
    return { published, draft, total: allPackages.length };
  }, [allPackages]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allPackages.filter((p) => {
      const matchCategory = category === "All" || categoryOf(p) === category;
      const matchTerm =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.destination.toLowerCase().includes(term);
      return matchCategory && matchTerm;
    });
  }, [allPackages, category, search]);

  const selected =
    allPackages.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  const ringgit = (v: number) => `RM ${v.toLocaleString("en-MY")}`;

  function setStatus(pkg: TravelPackage, status: PkgStatus) {
    setAllPackages((prev) =>
      prev.map((p) =>
        p.id === pkg.id
          ? {
              ...p,
              status: status === "archived" ? "archived" : "active",
              published: status === "published",
            }
          : p,
      ),
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      {/* Toolbar */}
      <section className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label={t("Tapis pakej mengikut kategori", "Filter packages by category")}>
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={cn(
                "rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-strong)] hover:text-foreground",
                category === item &&
                  "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-surface)]",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="ml-auto flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 sm:max-w-[280px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Cari pakej", "Search packages")}
            aria-label={t("Cari pakej", "Search packages")}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 font-inherit text-[13px] text-foreground outline-none focus:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("Pakej Baharu", "New Package")}
        </button>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Cards */}
        <section className="min-w-0">
          {filtered.length === 0 ? (
            <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-12 text-center text-muted-foreground">
              <p className="m-0 text-[13.5px]">
                {t("Tiada pakej sepadan dengan carian ini.", "No packages match this search.")}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
                className="mt-3 rounded-lg border border-[var(--color-border)] px-4 py-2 text-[12.5px] font-medium hover:bg-[var(--color-surface-muted)]"
              >
                {t("Set semula penapis", "Reset filters")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => {
                const price = p.adultPrice;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected?.id === p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "flex min-w-0 flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left font-inherit transition-all hover:border-[var(--color-border-strong)]",
                      selected?.id === p.id &&
                        "border-[var(--color-primary)] shadow-[0_0_0_1px_var(--color-primary)]",
                    )}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[11.5px] text-muted-foreground">
                          {categoryOf(p)} · {p.durationDays}{t(" hari", " days")}
                        </span>
                        <span className="mt-0.5 block text-[14px] font-semibold leading-tight">
                          {p.name}
                        </span>
                      </span>
                      <StatusPill status={statusOf(p)} />
                    </div>
                    <p className="m-0 line-clamp-2 text-[12.5px] text-[var(--color-text-secondary)]">
                      {p.destination}
                    </p>
                    <div className="flex w-full items-baseline justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                      <span className="whitespace-nowrap text-[13.5px] font-semibold [font-variant-numeric:tabular-nums]">
                        {ringgit(price)}
                      </span>
                      <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
                        {t("seorang", "per pax")}
                      </span>
                    </div>
                    <div className="flex w-full flex-wrap gap-2">
                      {p.inclusions.slice(0, 2).map((inc) => (
                        <span
                          key={inc}
                          className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10.5px] text-[var(--color-text-secondary)]"
                        >
                          {inc}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Detail / summary */}
        <aside className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div>
            <h2 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("Ringkasan Katalog", "Catalog summary")}
            </h2>
            <dl className="m-0 mt-3 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <dt className="text-[11.5px] text-muted-foreground">Published</dt>
                <dd className="m-0 text-[18px] font-semibold [font-variant-numeric:tabular-nums]">
                  {overview.published}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11.5px] text-muted-foreground">Draft</dt>
                <dd className="m-0 text-[18px] font-semibold [font-variant-numeric:tabular-nums]">
                  {overview.draft}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[11.5px] text-muted-foreground">
                  {t("Jumlah Pakej", "Total packages")}
                </dt>
                <dd className="m-0 text-[18px] font-semibold [font-variant-numeric:tabular-nums]">
                  {overview.total}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            {selected ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="m-0 min-w-0 text-[14px] font-semibold">
                    {selected.name}
                  </h3>
                  <StatusPill status={statusOf(selected)} />
                </div>
                <p className="m-0 text-[12.5px] text-[var(--color-text-secondary)]">
                  {selected.destination}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-[11.5px] text-[var(--color-text-secondary)]">
                    <CalendarDays className="h-3 w-3" /> {selected.durationDays}{t(" hari", " days")}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-[11.5px] text-[var(--color-text-secondary)]">
                    <UsersRound className="h-3 w-3" /> {ringgit(selected.adultPrice)}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(selected);
                        setFormOpen(true);
                      }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[12.5px] font-medium hover:bg-[var(--color-surface-muted)]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      {t("Sunting", "Edit")}
                    </button>
                    {statusOf(selected) === "published" ? (
                      <button
                        type="button"
                        onClick={() => setStatus(selected, "draft")}
                        className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[12.5px] font-medium hover:bg-[var(--color-surface-muted)]"
                      >
                        {t("Tarik Terbit", "Unpublish")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStatus(selected, "published")}
                        className="flex-1 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[var(--color-primary-hover)]"
                      >
                        {t("Terbitkan", "Publish")}
                      </button>
                    )}
                  </div>
                  <a
                    href="#/trips-seats"
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--color-primary)] no-underline"
                  >
                    {t("Lihat jadual keberangkatan", "View departure schedule")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ) : (
              <p className="m-0 text-[12.5px] text-muted-foreground">
                {t("Pilih pakej untuk melihat butiran.", "Select a package to see its details.")}
              </p>
            )}
          </div>
        </aside>
      </div>

      <PackageForm
        open={formOpen}
        onOpenChange={setFormOpen}
        existing={editing}
        onSubmit={(values) => {
          if (editing) {
            setAllPackages((prev) =>
              prev.map((p) => (p.id === editing.id ? { ...p, ...values } : p)),
            );
          } else {
            setAllPackages((prev) => [
              { ...values, id: `pk-${Date.now()}`, status: "active" },
              ...prev,
            ]);
          }
        }}
      />
    </div>
  );
}

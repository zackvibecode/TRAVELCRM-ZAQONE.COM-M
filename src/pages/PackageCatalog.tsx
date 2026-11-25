import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  PlaneTakeoff,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { TravelPackage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLang } from "@/lib/i18n";
import { getSession } from "@/lib/auth";
import { canWriteModule, usePermissionMatrix } from "@/lib/permission-store";
import CreatePackageDialog from "@/components/CreatePackageDialog";

type TFn = (ms: string, en: string) => string;

// ---------------------------------------------------------------------------
// Card view model — live D1 packages merged with prototype metadata for
// fields that do not exist in the TravelPackage type (quota, filled, next
// departure date, marketing description).
// ---------------------------------------------------------------------------

type PkgStatus = "published" | "draft" | "archived";

interface PkgCard {
  id: string;
  name: string;
  category: string;
  duration: string;
  price: number;
  description: string;
  quota: number;
  filled: number;
  next: string;
  status: PkgStatus;
}

/** Fallback metadata for packages that lack their own details. */
const STATIC_META = [
  { category: "Umum", quota: 0, filled: 0, next: "—", description: "" },
];

const STATUS_PILL: Record<PkgStatus, { bg: string; fg: string }> = {
  published: { bg: "var(--color-success-soft)", fg: "var(--color-success)" },
  draft: { bg: "var(--color-warning-soft)", fg: "var(--color-warning)" },
  archived: { bg: "var(--color-neutral-soft)", fg: "var(--color-text-secondary)" },
};

const STATUS_LABEL: Record<PkgStatus, { ms: string; en: string }> = {
  published: { ms: "Terbit", en: "Published" },
  draft: { ms: "Draf", en: "Draft" },
  archived: { ms: "Diarkib", en: "Archived" },
};

const CATEGORIES = ["All", "Umum", "Beach", "Islands", "Culture", "Mountains", "Nature"];

const CATEGORY_LABEL: Record<string, { ms: string; en: string }> = {
  All: { ms: "Semua", en: "All" },
  Umum: { ms: "Umum", en: "General" },
  Beach: { ms: "Pantai", en: "Beach" },
  Islands: { ms: "Kepulauan", en: "Islands" },
  Culture: { ms: "Budaya", en: "Culture" },
  Mountains: { ms: "Gunung", en: "Mountains" },
  Nature: { ms: "Alam", en: "Nature" },
};

function statusOf(p: TravelPackage): PkgStatus {
  if (p.status === "archived") return "archived";
  if (p.published === false) return "draft";
  return "published";
}

function buildCard(p: TravelPackage, index: number): PkgCard {
  const meta = STATIC_META[index % STATIC_META.length];
  const status = statusOf(p);
  return {
    id: p.id,
    name: p.name,
    category: meta.category,
    duration: `${p.durationDays}D${Math.max(p.durationDays - 1, 1)}N`,
    price: p.adultPrice,
    description:
      p.highlights && p.highlights.length > 0
        ? p.highlights.join(" · ")
        : meta.description,
    quota: meta.quota,
    filled: status === "archived" ? meta.filled : meta.filled,
    next: meta.next,
    status,
  };
}

function ringgit(v: number): string {
  return `RM ${v.toLocaleString("en-MY")}`;
}

function StatusPill({ status, t }: { status: PkgStatus; t: TFn }) {
  const tone = STATUS_PILL[status];
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {t(STATUS_LABEL[status].ms, STATUS_LABEL[status].en)}
    </span>
  );
}
export default function PackageCatalog() {
  const { t } = useLang();
  const [list, setList] = useState<PkgCard[]>([]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Gate the "New Package" button on the admin permission matrix (packages module).
  usePermissionMatrix();
  const canCreate = canWriteModule("packages", getSession()?.role);

  // Live packages from D1 (falls back to mock inside the loader).
  const loadList = () => {
    (async () => {
      try {
        const { fetchPackages } = await import("@/lib/live-data");
        const res = await fetchPackages();
        const cards = res.packages.map(buildCard);
        setList(cards);
        setSelectedId((prev) => prev ?? cards[0]?.id ?? null);
      } catch {
        /* live data unavailable — leave list empty */
      }
    })();
  };

  useEffect(() => {
    loadList();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return list.filter((item) => {
      const matchCategory = category === "All" || item.category === category;
      const matchTerm =
        !term ||
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term);
      return matchCategory && matchTerm;
    });
  }, [list, category, query]);

  const selected =
    list.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  const summary = useMemo(
    () => ({
      published: list.filter((item) => item.status === "published").length,
      draft: list.filter((item) => item.status === "draft").length,
      seats: list.reduce((sum, item) => sum + item.filled, 0),
      capacity: list.reduce((sum, item) => sum + item.quota, 0),
    }),
    [list],
  );

  function setStatus(id: string, status: PkgStatus) {
    setList((items) =>
      items.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-5 pb-8">
      {/* Toolbar: category tabs + search */}
      <section className="flex min-w-0 flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label={t(
            "Tapis pakej mengikut kategori",
            "Filter packages by category",
          )}
          className="flex min-w-0 flex-wrap gap-2"
        >
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
              className={cn(
                "cursor-pointer rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium text-[var(--color-text-secondary)] transition-colors duration-150 hover:border-[var(--color-border-strong)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                category === item &&
                  "border-[var(--color-text)] bg-[var(--color-text)] text-[var(--color-surface)]",
              )}
            >
              {t(CATEGORY_LABEL[item].ms, CATEGORY_LABEL[item].en)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setEditingId(null); setCreateOpen(true); }}
          disabled={!canCreate}
          className="inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-3.5 text-[12.5px] font-semibold text-[var(--color-on-primary)] transition-opacity duration-150 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("Tambah Pakej", "New Package")}
        </button>
        <label className="ml-auto flex h-9 min-w-0 flex-[1_1_220px] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 sm:max-w-[280px]">
          <Search
            className="h-4 w-4 flex-none text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Cari pakej", "Search packages")}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus-ring)]"
          />
        </label>
      </section>

      <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Package cards grid */}
        <section className="min-w-0">
          {filtered.length === 0 ? (
            <div className="rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-10 text-center text-muted-foreground">
              <p className="m-0 text-[13.5px]">
                {t(
                  "Tiada pakej sepadan dengan carian ini.",
                  "No packages match this search.",
                )}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("All");
                }}
                className="mt-3 cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[12.5px] font-medium text-foreground transition-colors duration-150 hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
              >
                {t("Set semula penapis", "Reset filters")}
              </button>
            </div>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => {
                const seatsLeft = item.quota - item.filled;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected?.id === item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex min-w-0 cursor-pointer flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left font-inherit text-foreground transition-all duration-150 hover:border-[var(--color-border-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]",
                      selected?.id === item.id &&
                        "border-[var(--color-primary)] shadow-[0_0_0_1px_var(--color-primary)]",
                    )}
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[11.5px] text-muted-foreground">
                          {item.category} · {item.duration}
                        </span>
                        <span className="mt-0.5 block text-[14px] font-semibold leading-tight">
                          {item.name}
                        </span>
                      </span>
                      <StatusPill status={item.status} t={t} />
                    </div>
                    <p className="m-0 line-clamp-2 text-[12.5px] text-[var(--color-text-secondary)]">
                      {item.description}
                    </p>
                    <div className="flex w-full items-baseline justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                      <span className="whitespace-nowrap text-[13.5px] font-semibold [font-variant-numeric:tabular-nums]">
                        {ringgit(item.price)}
                      </span>
                      <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
                        {t("seorang", "per pax")}
                      </span>
                    </div>
                    <div className="flex w-full flex-col gap-1">
                      <div
                        role="img"
                        aria-label={`${item.filled} of ${item.quota} seats filled`}
                        className="h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-soft)]"
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round((item.filled / item.quota) * 100)}%`,
                            background:
                              seatsLeft === 0
                                ? "var(--color-danger)"
                                : "var(--color-info)",
                          }}
                        />
                      </div>
                      <div className="flex justify-between gap-2">
                        <span
                          className={cn(
                            "text-[11.5px]",
                            seatsLeft === 0
                              ? "text-[var(--color-danger)]"
                              : "text-muted-foreground",
                          )}
                        >
                          {seatsLeft === 0
                            ? t("Penuh ditempah", "Fully booked")
                            : t(
                                `${seatsLeft} tempatan lagi`,
                                `${seatsLeft} seats left`,
                              )}
                        </span>
                        <span className="whitespace-nowrap text-[11.5px] text-muted-foreground [font-variant-numeric:tabular-nums]">
                          {item.next}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Detail / summary aside */}
        <aside className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div>
            <h2 className="m-0 text-[11px] font-semibold uppercase tracking-[var(--tracking-wide)] text-muted-foreground">
              {t("Ringkasan katalog", "Catalog summary")}
            </h2>
            <dl className="m-0 mt-3 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <dt className="text-[11.5px] text-muted-foreground">
                  {t("Terbit", "Published")}
                </dt>
                <dd className="m-0 text-[18px] font-semibold [font-variant-numeric:tabular-nums]">
                  {summary.published}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11.5px] text-muted-foreground">
                  {t("Draf", "Draft")}
                </dt>
                <dd className="m-0 text-[18px] font-semibold [font-variant-numeric:tabular-nums]">
                  {summary.draft}
                </dd>
              </div>
              <div className="col-span-2 min-w-0">
                <dt className="text-[11.5px] text-muted-foreground">
                  {t("Tempatan diisi", "Seats filled")}
                </dt>
                <dd className="m-0 text-[18px] font-semibold [font-variant-numeric:tabular-nums]">
                  {summary.seats}{" "}
                  <span className="text-[13px] font-normal text-muted-foreground">
                    {t(`daripada ${summary.capacity}`, `of ${summary.capacity}`)}
                  </span>
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
                  <StatusPill status={selected.status} t={t} />
                </div>
                <p className="m-0 text-[12.5px] text-[var(--color-text-secondary)]">
                  {selected.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-[11.5px] text-[var(--color-text-secondary)]">
                    <CalendarDays className="h-3 w-3" aria-hidden="true" />
                    {selected.duration}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-[11.5px] text-[var(--color-text-secondary)]">
                    <PlaneTakeoff className="h-3 w-3" aria-hidden="true" />
                    {t("Berlepas", "Departs")} {selected.next}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2 py-1 text-[11.5px] text-[var(--color-text-secondary)]">
                    <UsersRound className="h-3 w-3" aria-hidden="true" />
                    {selected.filled}/{selected.quota} pax
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={() => { setEditingId(selected.id); setCreateOpen(true); }} className="cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[12.5px] font-semibold text-foreground hover:bg-[var(--color-surface-muted)]">
                    {t("Kemas kini pakej & itinerary", "Update package & itinerary")}
                  </button>
                  <a href={`/site/packages/${selected.id}`} target="_blank" rel="noreferrer" className="rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-center text-[12.5px] font-medium text-foreground no-underline hover:bg-[var(--color-surface-muted)]">
                    {t("Pratonton di website", "Preview on website")}
                  </a>
                  {selected.status === "published" ? (
                    <button
                      type="button"
                      onClick={() => setStatus(selected.id, "archived")}
                      className="cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[12.5px] font-medium text-foreground transition-colors duration-150 hover:bg-[var(--color-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                    >
                      {t("Keluarkan dari katalog", "Remove from catalog")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStatus(selected.id, "published")}
                      className="cursor-pointer rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-[12.5px] font-semibold text-[var(--color-on-primary)] transition-colors duration-150 hover:border-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
                    >
                      {selected.status === "draft"
                        ? t("Terbitkan pakej", "Publish package")
                        : t("Terbitkan semula", "Publish again")}
                    </button>
                  )}
                  <Link
                    to="/trips"
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-primary)] no-underline hover:text-[var(--color-primary-hover)]"
                  >
                    {t("Lihat jadual keberangkatan", "View departure schedule")}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : (
              <p className="m-0 text-[13px] text-muted-foreground">
                {t(
                  "Pilih pakej untuk melihat butirannya.",
                  "Select a package to see its details.",
                )}
              </p>
            )}
          </div>
        </aside>
      </div>

      <CreatePackageDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={loadList}
        packageId={editingId}
      />
    </div>
  );
}

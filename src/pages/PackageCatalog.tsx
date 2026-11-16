import { useMemo, useState } from "react";
import {
  Package,
  Search,
  MapPin,
  Clock,
  Copy,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { mockPackages } from "@/lib/mock-data";
import type { TravelPackage } from "@/lib/types";
import { cn } from "@/lib/utils";
import PackageForm from "@/components/PackageForm";
import PricingTiers from "@/components/PricingTiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DESTINATIONS = Array.from(
  new Set(mockPackages.map((p) => p.destination.split(",")[0].trim())),
).sort();

export default function PackageCatalog() {
  const [allPackages, setAllPackages] = useState<TravelPackage[]>(
    () => mockPackages.map((p) => ({ ...p, status: "active", published: true })),
  );
  const [search, setSearch] = useState("");
  const [destination, setDestination] = useState<string>("all");
  const [maxDuration, setMaxDuration] = useState<number>(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TravelPackage | null>(null);

  const packages = useMemo(() => {
    return allPackages.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.destination.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (destination !== "all") {
        const primary = p.destination.split(",")[0].trim();
        if (primary !== destination) return false;
      }
      if (maxDuration > 0 && p.durationDays > maxDuration) return false;
      return true;
    });
  }, [allPackages, search, destination, maxDuration]);

  function duplicate(pkg: TravelPackage) {
    const copy: TravelPackage = {
      ...pkg,
      id: `${pkg.id}-copy-${Date.now()}`,
      name: `${pkg.name} (Copy)`,
    };
    setAllPackages((prev) => [copy, ...prev]);
  }

  function toggleArchive(pkg: TravelPackage) {
    setAllPackages((prev) =>
      prev.map((p) =>
        p.id === pkg.id
          ? {
              ...p,
              status: p.status === "archived" ? "active" : "archived",
            }
          : p,
      ),
    );
  }

  function togglePublish(pkg: TravelPackage) {
    setAllPackages((prev) =>
      prev.map((p) =>
        p.id === pkg.id ? { ...p, published: !p.published } : p,
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Package Catalog
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage travel packages, pricing, and itineraries.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Package className="h-4 w-4" />
          New Package
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or destination..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={destination === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setDestination("all")}
          >
            All
          </Button>
          {DESTINATIONS.map((d) => (
            <Button
              key={d}
              variant={destination === d ? "default" : "outline"}
              size="sm"
              onClick={() => setDestination(d)}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      {/* Duration filter */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Max duration:</span>
        {[
          { label: "Any", value: 0 },
          { label: "≤ 5 days", value: 5 },
          { label: "≤ 7 days", value: 7 },
          { label: "≤ 14 days", value: 14 },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMaxDuration(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              maxDuration === opt.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Package cards */}
      {packages.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center text-muted-foreground">
            <p className="text-sm">No packages match your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <Card
              key={p.id}
              className={cn(
                "flex flex-col transition-shadow hover:shadow-md",
                p.status === "archived" && "opacity-60",
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    {p.name}
                  </CardTitle>
                  <div className="flex shrink-0 gap-1">
                    {p.published && (
                      <Badge variant="default">Published</Badge>
                    )}
                    {p.status === "archived" && (
                      <Badge variant="outline">Archived</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {p.destination}
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {p.durationDays} days
                </div>
                <div className="text-sm">
                  <div className="mb-1 text-muted-foreground">Pricing</div>
                  <PricingTiers pkg={p} />
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.inclusions.slice(0, 3).map((inc) => (
                    <Badge key={inc} variant="secondary">
                      {inc}
                    </Badge>
                  ))}
                  {p.inclusions.length > 3 && (
                    <Badge variant="outline">
                      +{p.inclusions.length - 3}
                    </Badge>
                  )}
                </div>
                {p.exclusions && p.exclusions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.exclusions.slice(0, 2).map((exc) => (
                      <Badge key={exc} variant="outline" className="text-red-500">
                        {exc}
                      </Badge>
                    ))}
                    {p.exclusions.length > 2 && (
                      <Badge variant="outline">
                        +{p.exclusions.length - 2} excl.
                      </Badge>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-auto flex gap-2 border-t pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setEditing(p);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => duplicate(p)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Duplicate
                  </Button>
                  <Button
                    variant={p.published ? "default" : "outline"}
                    size="sm"
                    onClick={() => togglePublish(p)}
                    title={p.published ? "Unpublish" : "Publish"}
                  >
                    {p.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleArchive(p)}
                    title={p.status === "archived" ? "Restore" : "Archive"}
                  >
                    {p.status === "archived" ? (
                      <ArchiveRestore className="h-3.5 w-3.5" />
                    ) : (
                      <Archive className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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

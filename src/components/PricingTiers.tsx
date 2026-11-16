import { Users, Baby, User } from "lucide-react";
import type { TravelPackage } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export default function PricingTiers({
  pkg,
}: {
  pkg: TravelPackage;
}) {
  const tiers = [
    {
      key: "adult",
      label: "Adult",
      price: pkg.adultPrice,
      icon: User,
    },
    {
      key: "child",
      label: "Child",
      price: pkg.childPrice,
      icon: Users,
    },
    {
      key: "infant",
      label: "Infant",
      price: pkg.infantPrice,
      icon: Baby,
    },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiers.map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.key}
            className="rounded-lg border bg-muted/30 p-2.5 text-center"
          >
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </div>
            <div className="mt-1 text-sm font-semibold">
              {formatCurrency(t.price)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

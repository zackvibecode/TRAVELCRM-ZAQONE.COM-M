import { useEffect, useState } from "react";
import { TrendingUp, Wallet, Receipt } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Departure } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface DepartureCostRow {
  id: string;
  departureId: string;
  category: string;
  description: string;
  estimatedAmount: number;
  actualAmount: number;
}

export default function TripCostProfit({
  departure,
}: {
  departure: Departure;
}) {
  const [costs, setCosts] = useState<DepartureCostRow[]>([]);

  // Live cost breakdown from D1 via /departures/:id/costs.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{
          success: boolean;
          data?: DepartureCostRow[];
          costs?: DepartureCostRow[];
        }>(`/departures/${departure.id}/costs`);
        setCosts(res.success ? res.data ?? res.costs ?? [] : []);
      } catch {
        // Kos tiada — papar sifar (endpoint perlukan role operations/finance).
      }
    })();
  }, [departure.id]);

  // Revenue estimate: booked seats × adult price (mock simplification).
  const revenue = departure.seatsBooked * departure.adultPrice;

  const estimatedCost = costs.reduce((s, c) => s + c.estimatedAmount, 0);
  const actualCost = costs.reduce(
    (s, c) => s + (c.actualAmount || c.estimatedAmount),
    0,
  );

  const actualProfit = revenue - actualCost;
  const margin =
    revenue > 0 ? Math.round((actualProfit / revenue) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Profit summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            Revenue
          </div>
          <div className="mt-1 text-lg font-bold">
            {formatCurrency(revenue)}
          </div>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" />
            Actual cost
          </div>
          <div className="mt-1 text-lg font-bold">
            {formatCurrency(actualCost)}
          </div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="flex items-center gap-1.5 text-xs text-emerald-700">
            <TrendingUp className="h-3.5 w-3.5" />
            Gross profit
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-700">
            {formatCurrency(actualProfit)}
          </div>
          <div className="text-xs text-emerald-600">{margin}% margin</div>
        </div>
      </div>

      {/* Estimated vs actual */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">
            Estimated cost
          </div>
          <div className="font-medium">{formatCurrency(estimatedCost)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Actual cost</div>
          <div className="font-medium">{formatCurrency(actualCost)}</div>
        </div>
      </div>

      {/* Cost line items */}
      {costs.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No supplier costs recorded for this departure.
        </p>
      ) : (
        <div className="space-y-2">
          {costs.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-md border p-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{c.description}</div>
                <div className="text-xs text-muted-foreground">
                  {c.category}
                </div>
              </div>
              <div className="text-right text-sm">
                <div>{formatCurrency(c.estimatedAmount)}</div>
                <div className="text-xs text-muted-foreground">
                  actual:{" "}
                  {c.actualAmount
                    ? formatCurrency(c.actualAmount)
                    : "—"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

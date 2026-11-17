import { useEffect, useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Departure } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

interface DepartureCostRow {
  id: string;
  departureId: string;
  category: string;
  description: string;
  estimatedAmount: number;
  actualAmount: number;
}

export default function SupplierCostComparison({
  departure,
}: {
  departure: Departure;
}) {
  const [costs, setCosts] = useState<DepartureCostRow[]>([]);

  // Live supplier costs from D1 via /departures/:id/costs.
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
        // tiada kos
      }
    })();
  }, [departure.id]);

  const totals = useMemo(() => {
    const estimated = costs.reduce((s, c) => s + c.estimatedAmount, 0);
    const actual = costs.reduce(
      (s, c) => s + (c.actualAmount || c.estimatedAmount),
      0,
    );
    return { estimated, actual, variance: actual - estimated };
  }, [costs]);

  function varianceFor(estimated: number, actual: number) {
    // actual is 0 => not yet incurred
    const effActual = actual || estimated;
    return effActual - estimated;
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Scale className="h-4 w-4" />
        Supplier Cost Comparison
      </h3>

      {costs.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No supplier costs recorded for this departure.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costs.map((c) => {
                const variance = varianceFor(c.estimatedAmount, c.actualAmount);
                const over = variance > 0;
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {c.category}
                      </span>
                    </TableCell>
                    <TableCell>{c.description}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(c.estimatedAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.actualAmount
                        ? formatCurrency(c.actualAmount)
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        over ? "text-red-600" : "text-emerald-600",
                      )}
                    >
                      {c.actualAmount
                        ? `${over ? "+" : ""}${formatCurrency(variance)}`
                        : "pending"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {/* Totals */}
              <TableRow className="bg-muted/40 font-medium">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totals.estimated)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(totals.actual)}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right",
                    totals.variance > 0
                      ? "text-red-600"
                      : "text-emerald-600",
                  )}
                >
                  {totals.variance > 0 ? "+" : ""}
                  {formatCurrency(totals.variance)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

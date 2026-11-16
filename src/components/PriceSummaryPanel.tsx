import { useMemo } from "react";
import type { Booking } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

interface PriceSummaryPanelProps {
  booking: Booking;
  unitPrices?: {
    adult: number;
    child: number;
    infant: number;
  };
}

/**
 * Full price & discount summary panel for a booking.
 * Shows per-pax pricing, discount, deposit and outstanding balance.
 */
export default function PriceSummaryPanel({
  booking,
  unitPrices,
}: PriceSummaryPanelProps) {
  const {
    paxAdult,
    paxChild,
    paxInfant,
    totalAmount,
    discount,
    depositAmount,
    paidAmount,
    balanceDue,
  } = booking;

  const subtotal = useMemo(() => {
    if (unitPrices) {
      return (
        paxAdult * unitPrices.adult +
        paxChild * unitPrices.child +
        paxInfant * unitPrices.infant
      );
    }
    // When unit prices are unknown, derive from total + discount.
    return totalAmount + discount;
  }, [unitPrices, paxAdult, paxChild, paxInfant, totalAmount, discount]);

  const discountPercent =
    subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0;

  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Price Summary</h3>
      </div>

      <div className="space-y-2 text-sm">
        {/* Per-pax line items */}
        {unitPrices && paxAdult > 0 && (
          <LineItem
            label={`Adult × ${paxAdult}`}
            value={paxAdult * unitPrices.adult}
          />
        )}
        {unitPrices && paxChild > 0 && (
          <LineItem
            label={`Child × ${paxChild}`}
            value={paxChild * unitPrices.child}
          />
        )}
        {unitPrices && paxInfant > 0 && (
          <LineItem
            label={`Infant × ${paxInfant}`}
            value={paxInfant * unitPrices.infant}
          />
        )}

        {!unitPrices && (
          <LineItem label="Subtotal" value={subtotal} />
        )}

        {/* Discount */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            Discount
            {discountPercent > 0 && (
              <span className="ml-1 text-xs">({discountPercent}%)</span>
            )}
          </span>
          <span
            className={
              discount > 0 ? "font-medium text-emerald-600" : ""
            }
          >
            {discount > 0 ? `-${formatCurrency(discount)}` : "—"}
          </span>
        </div>

        {/* Divider */}
        <div className="border-t pt-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-muted-foreground">Total</span>
            <span className="font-semibold">
              {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        {/* Deposit */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Deposit required</span>
          <span>{formatCurrency(depositAmount)}</span>
        </div>

        {/* Paid */}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Amount paid</span>
          <span className="text-emerald-600">
            {formatCurrency(paidAmount)}
          </span>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between border-t pt-2">
          <span className="font-medium text-muted-foreground">
            Balance due
          </span>
          <span
            className={
              balanceDue > 0
                ? "font-semibold text-amber-600"
                : "font-semibold text-emerald-600"
            }
          >
            {formatCurrency(balanceDue)}
          </span>
        </div>
      </div>
    </div>
  );
}

function LineItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

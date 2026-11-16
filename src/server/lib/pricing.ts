export interface PriceTiers {
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
}

export interface PaxCounts {
  paxAdult: number;
  paxChild: number;
  paxInfant: number;
}

export type DiscountInput =
  | { kind: "amount"; value: number }
  | { kind: "percent"; value: number };

export interface PricingResult {
  adultSubtotal: number;
  childSubtotal: number;
  infantSubtotal: number;
  grossTotal: number;
  discount: number;
  total: number;
}

/**
 * Computes the gross total from pax counts and price tiers, then applies a
 * discount (fixed amount or percentage of the gross total). Prices are
 * treated as integers (smallest currency unit); the final total is floored to
 * a whole integer to avoid fractional cents.
 */
export function calculatePricing(
  tiers: PriceTiers,
  pax: PaxCounts,
  discount?: DiscountInput,
): PricingResult {
  const adultSubtotal = pax.paxAdult * tiers.adultPrice;
  const childSubtotal = pax.paxChild * tiers.childPrice;
  const infantSubtotal = pax.paxInfant * tiers.infantPrice;
  const grossTotal = adultSubtotal + childSubtotal + infantSubtotal;

  let discountAmount = 0;
  if (discount) {
    if (discount.kind === "amount") {
      discountAmount = Math.max(0, Math.floor(discount.value));
    } else {
      const pct = Math.min(100, Math.max(0, discount.value));
      discountAmount = Math.floor((grossTotal * pct) / 100);
    }
  }
  if (discountAmount > grossTotal) discountAmount = grossTotal;

  return {
    adultSubtotal,
    childSubtotal,
    infantSubtotal,
    grossTotal,
    discount: discountAmount,
    total: grossTotal - discountAmount,
  };
}

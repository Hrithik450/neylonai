/**
 * Display + charge currency for plan pricing.
 *
 * USD and INR are separate fixed price lists — not a live FX conversion.
 * Razorpay must charge the same INR amount shown in the UI.
 */

import { PLAN_CATALOG, type PlanId } from "./plans";

export type BillingCurrency = "USD" | "INR";

/**
 * Fixed India list prices (rupees / month).
 * Keep these intentional marketing points; do not derive from USD × rate.
 */
export const PLAN_PRICE_INR_MONTHLY: Record<PlanId, number> = {
  free: 0,
  starter: 1_499,
  pro: 3_999,
  business: 12_499,
};

export function planPriceInCurrency(
  planId: PlanId,
  currency: BillingCurrency,
): number {
  if (currency === "INR") return PLAN_PRICE_INR_MONTHLY[planId];
  return PLAN_CATALOG[planId].priceUsdMonthly;
}

/** India is billed in INR through Razorpay; everyone else in USD via Stripe. */
export function currencyForCountry(
  country: string | null | undefined,
): BillingCurrency {
  return (country ?? "").trim().toUpperCase() === "IN" ? "INR" : "USD";
}

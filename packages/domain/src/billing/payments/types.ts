import type { PlanId } from "../plans";
import type { SubscriptionStatus } from "../keys";

export type PaymentProviderId = "stripe" | "razorpay" | "paypal";

export interface CreateCheckoutInput {
  organizationId: string;
  planId: PlanId;
  /** Customer-facing success / cancel URLs. */
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  /** Existing external customer id if known. */
  externalCustomerId?: string | null;
  /** ISO currency; Razorpay typically INR, Stripe USD. */
  currency?: string;
}

export interface CreateCheckoutResult {
  provider: PaymentProviderId;
  /** Redirect the browser here. */
  checkoutUrl: string;
  externalSessionId?: string;
}

export interface ProviderWebhookEvent {
  provider: PaymentProviderId;
  /** Normalized event type. */
  type:
    | "checkout_completed"
    | "subscription_updated"
    | "subscription_cancelled"
    | "payment_failed"
    | "invoice_paid";
  organizationId?: string | null;
  planId?: PlanId | null;
  status?: SubscriptionStatus | null;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  externalEventId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  /** Non-secret metadata for ledger. */
  rawType?: string;
  periodEnd?: Date | null;
}

/**
 * Payment provider abstraction.
 * Secrets stay in server env — never in SDK / browser.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /**
   * Verify signature + parse payload into a normalized event.
   * Throw on invalid signature.
   */
  parseWebhook(
    headers: Headers | Record<string, string | null | undefined>,
    rawBody: string,
  ): Promise<ProviderWebhookEvent | null>;
}

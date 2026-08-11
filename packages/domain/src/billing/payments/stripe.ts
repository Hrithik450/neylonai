import { createHmac, timingSafeEqual } from "crypto";
import { PLAN_CATALOG, type PlanId, normalizePlanId } from "../plans";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  ProviderWebhookEvent,
} from "./types";

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/**
 * Stripe Checkout + webhook adapter.
 * Uses REST directly so we don't hard-require the Stripe SDK package.
 */
export function createStripeProvider(): PaymentProvider {
  return {
    id: "stripe",

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const secret = env("STRIPE_SECRET_KEY");
      if (!secret) {
        throw new Error("STRIPE_SECRET_KEY is not configured.");
      }

      const priceMap: Partial<Record<PlanId, string | undefined>> = {
        starter: env("STRIPE_PRICE_STARTER"),
        pro: env("STRIPE_PRICE_PRO"),
        business: env("STRIPE_PRICE_BUSINESS"),
      };
      const priceId = priceMap[input.planId];
      if (!priceId) {
        throw new Error(
          `Stripe price id missing for plan "${input.planId}". Set STRIPE_PRICE_* env vars.`,
        );
      }

      const body = new URLSearchParams();
      body.set("mode", "subscription");
      body.set("success_url", input.successUrl);
      body.set("cancel_url", input.cancelUrl);
      body.set("line_items[0][price]", priceId);
      body.set("line_items[0][quantity]", "1");
      body.set("client_reference_id", input.organizationId);
      body.set("metadata[organizationId]", input.organizationId);
      body.set("metadata[planId]", input.planId);
      body.set("subscription_data[metadata][organizationId]", input.organizationId);
      body.set("subscription_data[metadata][planId]", input.planId);
      if (input.customerEmail) body.set("customer_email", input.customerEmail);
      if (input.externalCustomerId) body.set("customer", input.externalCustomerId);

      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Stripe checkout failed: ${text.slice(0, 300)}`);
      }

      const json = (await res.json()) as { id: string; url: string };
      return {
        provider: "stripe",
        checkoutUrl: json.url,
        externalSessionId: json.id,
      };
    },

    async parseWebhook(headers, rawBody): Promise<ProviderWebhookEvent | null> {
      const secret = env("STRIPE_WEBHOOK_SECRET");
      if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");

      const get = (name: string) => {
        if (headers instanceof Headers) return headers.get(name);
        const lower = name.toLowerCase();
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() === lower) return v ?? null;
        }
        return null;
      };

      const sigHeader = get("stripe-signature");
      if (!sigHeader) throw new Error("Missing Stripe-Signature header.");

      verifyStripeSignature(rawBody, sigHeader, secret);

      const payload = JSON.parse(rawBody) as {
        id: string;
        type: string;
        data: { object: Record<string, unknown> };
      };

      const obj = payload.data.object;
      const meta = (obj.metadata as Record<string, string> | undefined) ?? {};
      const organizationId =
        meta.organizationId ??
        (obj.client_reference_id as string | undefined) ??
        null;
      const planId = meta.planId
        ? normalizePlanId(meta.planId)
        : undefined;

      switch (payload.type) {
        case "checkout.session.completed":
          return {
            provider: "stripe",
            type: "checkout_completed",
            organizationId,
            planId: planId ?? null,
            status: "active",
            externalCustomerId: (obj.customer as string) ?? null,
            externalSubscriptionId: (obj.subscription as string) ?? null,
            externalEventId: payload.id,
            amountCents: Number(obj.amount_total ?? 0) || null,
            currency: (obj.currency as string) ?? "usd",
            rawType: payload.type,
          };
        case "customer.subscription.updated":
          return {
            provider: "stripe",
            type: "subscription_updated",
            organizationId,
            planId: planId ?? null,
            status: mapStripeStatus(String(obj.status ?? "")),
            externalCustomerId: (obj.customer as string) ?? null,
            externalSubscriptionId: (obj.id as string) ?? null,
            externalEventId: payload.id,
            periodEnd: obj.current_period_end
              ? new Date(Number(obj.current_period_end) * 1000)
              : null,
            rawType: payload.type,
          };
        case "customer.subscription.deleted":
          return {
            provider: "stripe",
            type: "subscription_cancelled",
            organizationId,
            status: "cancelled",
            externalCustomerId: (obj.customer as string) ?? null,
            externalSubscriptionId: (obj.id as string) ?? null,
            externalEventId: payload.id,
            rawType: payload.type,
          };
        case "invoice.payment_failed":
          return {
            provider: "stripe",
            type: "payment_failed",
            organizationId,
            status: "past_due",
            externalCustomerId: (obj.customer as string) ?? null,
            externalSubscriptionId: (obj.subscription as string) ?? null,
            externalEventId: payload.id,
            amountCents: Number(obj.amount_due ?? 0) || null,
            currency: (obj.currency as string) ?? "usd",
            rawType: payload.type,
          };
        case "invoice.paid":
          return {
            provider: "stripe",
            type: "invoice_paid",
            organizationId,
            status: "active",
            externalCustomerId: (obj.customer as string) ?? null,
            externalSubscriptionId: (obj.subscription as string) ?? null,
            externalEventId: payload.id,
            amountCents: Number(obj.amount_paid ?? 0) || null,
            currency: (obj.currency as string) ?? "usd",
            rawType: payload.type,
          };
        default:
          return null;
      }
    },
  };
}

function mapStripeStatus(status: string) {
  switch (status) {
    case "active":
      return "active" as const;
    case "trialing":
      return "trialing" as const;
    case "past_due":
      return "past_due" as const;
    case "canceled":
    case "unpaid":
      return "cancelled" as const;
    default:
      return "active" as const;
  }
}

function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
): void {
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, ...rest] = p.split("=");
      return [k.trim(), rest.join("=")];
    }),
  ) as Record<string, string>;

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) throw new Error("Invalid Stripe signature.");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Stripe webhook timestamp too old.");

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Stripe signature mismatch.");
  }
}

/** Helper for display amounts — not used in checkout (Stripe Price IDs are). */
export function stripePlanDisplayCents(planId: PlanId): number {
  return Math.round(PLAN_CATALOG[planId].priceUsdMonthly * 100);
}

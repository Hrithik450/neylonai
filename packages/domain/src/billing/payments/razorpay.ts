import { createHmac, timingSafeEqual } from "crypto";
import { PLAN_CATALOG, type PlanId, normalizePlanId } from "../plans";
import { planPriceInCurrency } from "../currency";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  ProviderWebhookEvent,
} from "./types";

function unixDate(value: unknown): Date | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(n * 1000);
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/**
 * Razorpay subscription / payment-link adapter for India.
 * Secrets stay server-side (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET).
 */
export function createRazorpayProvider(): PaymentProvider {
  return {
    id: "razorpay",

    async createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
      const keyId = env("RAZORPAY_KEY_ID");
      const keySecret = env("RAZORPAY_KEY_SECRET");
      if (!keyId || !keySecret) {
        throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured.");
      }

      const planMap: Partial<Record<PlanId, string | undefined>> = {
        starter: env("RAZORPAY_PLAN_STARTER"),
        pro: env("RAZORPAY_PLAN_PRO"),
        business: env("RAZORPAY_PLAN_BUSINESS"),
      };
      const planId = planMap[input.planId];

      // Prefer hosted payment links when plan ids are not configured yet.
      if (!planId) {
        const amountPaise =
          planPriceInCurrency(input.planId, "INR") * 100;
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
        const res = await fetch("https://api.razorpay.com/v1/payment_links", {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountPaise,
            currency: "INR",
            accept_partial: false,
            description: `Neylon AI ${PLAN_CATALOG[input.planId].name} plan`,
            customer: input.customerEmail
              ? { email: input.customerEmail }
              : undefined,
            notify: { email: Boolean(input.customerEmail) },
            reminder_enable: false,
            callback_url: input.successUrl,
            callback_method: "get",
            notes: {
              organizationId: input.organizationId,
              planId: input.planId,
            },
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Razorpay payment link failed: ${text.slice(0, 300)}`);
        }
        const json = (await res.json()) as { id: string; short_url: string };
        return {
          provider: "razorpay",
          checkoutUrl: json.short_url,
          externalSessionId: json.id,
        };
      }

      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: planId,
          total_count: 120,
          customer_notify: 1,
          notes: {
            organizationId: input.organizationId,
            planId: input.planId,
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Razorpay subscription failed: ${text.slice(0, 300)}`);
      }
      const json = (await res.json()) as {
        id: string;
        short_url?: string;
      };
      // Hosted checkout page for subscription
      const checkoutUrl =
        json.short_url ??
        `https://api.razorpay.com/v1/subscriptions/${json.id}/checkout`;
      return {
        provider: "razorpay",
        checkoutUrl,
        externalSessionId: json.id,
      };
    },

    async parseWebhook(headers, rawBody): Promise<ProviderWebhookEvent | null> {
      const secret = env("RAZORPAY_WEBHOOK_SECRET");
      if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured.");

      const get = (name: string) => {
        if (headers instanceof Headers) return headers.get(name);
        const lower = name.toLowerCase();
        for (const [k, v] of Object.entries(headers)) {
          if (k.toLowerCase() === lower) return v ?? null;
        }
        return null;
      };

      const signature = get("x-razorpay-signature");
      if (!signature) throw new Error("Missing X-Razorpay-Signature.");

      const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(signature, "utf8");
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new Error("Razorpay signature mismatch.");
      }

      const payload = JSON.parse(rawBody) as {
        event: string;
        payload: Record<string, { entity?: Record<string, unknown> }>;
      };

      const entity =
        payload.payload.subscription?.entity ??
        payload.payload.payment_link?.entity ??
        payload.payload.payment?.entity ??
        {};

      const notes = (entity.notes as Record<string, string> | undefined) ?? {};
      const organizationId = notes.organizationId ?? null;
      const planId = notes.planId ? normalizePlanId(notes.planId) : null;

      switch (payload.event) {
        case "payment_link.paid":
        case "subscription.activated":
        case "subscription.charged":
          return {
            provider: "razorpay",
            type:
              payload.event === "subscription.charged"
                ? "invoice_paid"
                : "checkout_completed",
            organizationId,
            planId,
            status: "active",
            externalCustomerId: (entity.customer_id as string) ?? null,
            externalSubscriptionId: (entity.id as string) ?? null,
            externalEventId: `${payload.event}:${String(entity.id ?? "unknown")}:${String(entity.created_at ?? entity.createdAt ?? "")}`,
            amountCents: entity.amount ? Number(entity.amount) : null,
            currency: (entity.currency as string) ?? "inr",
            periodStart:
              unixDate(entity.current_start) ?? unixDate(entity.current_start_at),
            periodEnd:
              unixDate(entity.current_end) ?? unixDate(entity.current_end_at),
            rawType: payload.event,
          };
        case "subscription.cancelled":
        case "subscription.completed":
          return {
            provider: "razorpay",
            type: "subscription_cancelled",
            organizationId,
            status: "cancelled",
            externalSubscriptionId: (entity.id as string) ?? null,
            externalEventId: `${payload.event}:${String(entity.id ?? "unknown")}:${String(entity.created_at ?? entity.createdAt ?? "")}`,
            rawType: payload.event,
          };
        case "subscription.pending":
        case "payment.failed":
          return {
            provider: "razorpay",
            type: "payment_failed",
            organizationId,
            status: "past_due",
            externalSubscriptionId: (entity.id as string) ?? null,
            externalEventId: `${payload.event}:${String(entity.id ?? "unknown")}:${String(entity.created_at ?? entity.createdAt ?? "")}`,
            rawType: payload.event,
          };
        default:
          return null;
      }
    },
  };
}

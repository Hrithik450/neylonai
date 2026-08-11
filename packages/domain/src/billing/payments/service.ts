import { desc, eq } from "drizzle-orm";
import { db, subscriptions, billingEvents } from "@neylonai/database";
import { normalizePlanId, type PlanId, PLAN_CATALOG } from "../plans";
import {
  normalizeSubscriptionStatus,
  type SubscriptionStatus,
} from "../keys";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  PaymentProviderId,
  ProviderWebhookEvent,
} from "./types";
import { createStripeProvider } from "./stripe";
import { createRazorpayProvider } from "./razorpay";

export type { PaymentProvider, PaymentProviderId, ProviderWebhookEvent };
export type { CreateCheckoutInput, CreateCheckoutResult };

export function resolvePaymentProvider(
  preferred?: PaymentProviderId | null,
  localeHint?: string | null,
): PaymentProvider {
  if (preferred === "razorpay") return createRazorpayProvider();
  if (preferred === "stripe") return createStripeProvider();
  const region = (localeHint ?? "").toLowerCase();
  if (region.includes("in") || region === "india") {
    return createRazorpayProvider();
  }
  return createStripeProvider();
}

export async function applyProviderWebhookEvent(
  event: ProviderWebhookEvent,
): Promise<{ ok: boolean; organizationId?: string }> {
  let organizationId = event.organizationId ?? null;

  if (!organizationId && event.externalSubscriptionId) {
    const [row] = await db
      .select({ organizationId: subscriptions.organization_id })
      .from(subscriptions)
      .where(
        eq(subscriptions.external_subscription_id, event.externalSubscriptionId),
      )
      .limit(1);
    organizationId = row?.organizationId ?? null;
  }
  if (!organizationId && event.externalCustomerId) {
    const [row] = await db
      .select({ organizationId: subscriptions.organization_id })
      .from(subscriptions)
      .where(eq(subscriptions.external_customer_id, event.externalCustomerId))
      .limit(1);
    organizationId = row?.organizationId ?? null;
  }

  if (!organizationId) {
    console.warn("[billing] webhook missing organization mapping", event.type);
    return { ok: false };
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, organizationId))
    .limit(1);

  if (!sub) return { ok: false };

  let nextStatus: SubscriptionStatus | undefined;
  let nextPlan: PlanId | undefined;
  const now = new Date();

  switch (event.type) {
    case "checkout_completed":
    case "invoice_paid":
    case "subscription_updated":
      nextStatus = event.status
        ? normalizeSubscriptionStatus(event.status)
        : "active";
      if (event.planId) nextPlan = normalizePlanId(event.planId);
      break;
    case "subscription_cancelled":
      nextStatus = "cancelled";
      break;
    case "payment_failed":
      nextStatus = "past_due";
      break;
  }

  await db
    .update(subscriptions)
    .set({
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextPlan ? { plan: nextPlan } : {}),
      payment_provider: event.provider,
      ...(event.externalCustomerId
        ? { external_customer_id: event.externalCustomerId }
        : {}),
      ...(event.externalSubscriptionId
        ? { external_subscription_id: event.externalSubscriptionId }
        : {}),
      ...(event.periodEnd ? { current_period_end: event.periodEnd } : {}),
      ...(nextStatus === "cancelled" ? { canceled_at: now } : {}),
      updated_at: now,
    })
    .where(eq(subscriptions.id, sub.id));

  await db.insert(billingEvents).values({
    organization_id: organizationId,
    subscription_id: sub.id,
    provider: event.provider,
    event_type: event.type,
    external_id: event.externalEventId ?? null,
    amount_cents: event.amountCents ?? null,
    currency: event.currency ?? "usd",
    payload: {
      rawType: event.rawType ?? null,
      planId: event.planId ?? null,
      status: nextStatus ?? null,
    },
  });

  return { ok: true, organizationId };
}

export async function startCheckout(input: {
  organizationId: string;
  planId: PlanId;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  provider?: PaymentProviderId | null;
  localeHint?: string | null;
}): Promise<CreateCheckoutResult> {
  if (input.planId === "free") {
    throw new Error("Free plan does not require checkout.");
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, input.organizationId))
    .limit(1);

  const provider = resolvePaymentProvider(
    input.provider ?? (sub?.payment_provider as PaymentProviderId | null),
    input.localeHint,
  );

  const result = await provider.createCheckout({
    organizationId: input.organizationId,
    planId: input.planId,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
    customerEmail: input.customerEmail,
    externalCustomerId: sub?.external_customer_id,
    currency: provider.id === "razorpay" ? "INR" : "USD",
  });

  await db.insert(billingEvents).values({
    organization_id: input.organizationId,
    subscription_id: sub?.id ?? null,
    provider: provider.id,
    event_type: "checkout_started",
    external_id: result.externalSessionId ?? null,
    amount_cents: Math.round(PLAN_CATALOG[input.planId].priceUsdMonthly * 100),
    currency: provider.id === "razorpay" ? "inr" : "usd",
    payload: { planId: input.planId },
  });

  return result;
}

export async function cancelSubscriptionServerSide(
  organizationId: string,
): Promise<void> {
  await db
    .update(subscriptions)
    .set({
      status: "cancelled",
      canceled_at: new Date(),
      updated_at: new Date(),
      plan: "free",
    })
    .where(eq(subscriptions.organization_id, organizationId));

  const [sub] = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, organizationId))
    .limit(1);

  await db.insert(billingEvents).values({
    organization_id: organizationId,
    subscription_id: sub?.id ?? null,
    provider: "manual",
    event_type: "subscription_cancelled",
    payload: { source: "dashboard" },
  });
}

export async function changePlanServerSide(
  organizationId: string,
  planId: PlanId,
  opts?: { requirePaidCheckout?: boolean },
): Promise<{ needsCheckout: boolean }> {
  const normalized = normalizePlanId(planId);
  if (normalized === "free") {
    await db
      .update(subscriptions)
      .set({
        plan: "free",
        status: "active",
        payment_provider: null,
        updated_at: new Date(),
        canceled_at: null,
      })
      .where(eq(subscriptions.organization_id, organizationId));
    return { needsCheckout: false };
  }

  if (opts?.requirePaidCheckout !== false) {
    return { needsCheckout: true };
  }

  await db
    .update(subscriptions)
    .set({
      plan: normalized,
      status: "active",
      updated_at: new Date(),
    })
    .where(eq(subscriptions.organization_id, organizationId));
  return { needsCheckout: false };
}

/** List billing ledger for dashboard (no secrets). */
export async function listBillingEventsForOrg(
  organizationId: string,
  limit = 20,
) {
  return db
    .select({
      id: billingEvents.id,
      provider: billingEvents.provider,
      eventType: billingEvents.event_type,
      amountCents: billingEvents.amount_cents,
      currency: billingEvents.currency,
      createdAt: billingEvents.created_at,
    })
    .from(billingEvents)
    .where(eq(billingEvents.organization_id, organizationId))
    .orderBy(desc(billingEvents.created_at))
    .limit(limit);
}

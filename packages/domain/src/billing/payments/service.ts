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

function nextPeriodEnd(from: Date): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let i = 0; i < 5 && current && typeof current === "object"; i++) {
    const rec = current as { code?: unknown; cause?: unknown };
    if (rec.code === "23505") return true;
    current = rec.cause;
  }
  return false;
}

export async function applyProviderWebhookEvent(
  event: ProviderWebhookEvent,
): Promise<{ ok: boolean; organizationId?: string; duplicate?: boolean }> {
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

  if (event.externalEventId) {
    try {
      await db.insert(billingEvents).values({
        organization_id: organizationId,
        subscription_id: sub.id,
        provider: event.provider,
        event_type: event.type,
        external_id: event.externalEventId,
        amount_cents: event.amountCents ?? null,
        currency: event.currency ?? "usd",
        payload: {
          rawType: event.rawType ?? null,
          planId: event.planId ?? null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { ok: true, organizationId, duplicate: true };
      }
      throw error;
    }
  }

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
      // Keep Free entitlement usable for API auth after paid cancel.
      nextStatus = "active";
      nextPlan = "free";
      break;
    case "payment_failed":
      nextStatus = "past_due";
      break;
  }

  const periodStart =
    event.periodStart ??
    (event.type === "checkout_completed" || event.type === "invoice_paid"
      ? now
      : undefined);
  const periodEnd =
    event.periodEnd ??
    (periodStart ? nextPeriodEnd(periodStart) : undefined);

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
      ...(periodStart ? { current_period_start: periodStart } : {}),
      ...(periodEnd ? { current_period_end: periodEnd } : {}),
      ...(event.type === "subscription_cancelled" ? { canceled_at: now } : {}),
      updated_at: now,
    })
    .where(eq(subscriptions.id, sub.id));

  if (!event.externalEventId) {
    await db.insert(billingEvents).values({
      organization_id: organizationId,
      subscription_id: sub.id,
      provider: event.provider,
      event_type: event.type,
      external_id: null,
      amount_cents: event.amountCents ?? null,
      currency: event.currency ?? "usd",
      payload: {
        rawType: event.rawType ?? null,
        planId: event.planId ?? null,
        status: nextStatus ?? null,
      },
    });
  }

  const planForCredits = nextPlan ?? normalizePlanId(sub.plan);
  const shouldGrant =
    event.type === "checkout_completed" ||
    event.type === "invoice_paid" ||
    (event.type === "subscription_updated" && Boolean(nextPlan)) ||
    event.type === "subscription_cancelled";

  if (shouldGrant) {
    try {
      const { grantPlanCredits } = await import("../credits");
      await grantPlanCredits({
        organizationId,
        plan: planForCredits,
        periodStart: periodStart ?? sub.current_period_start ?? now,
        reason: `Billing ${event.type} (${planForCredits})`,
      });
    } catch (error) {
      console.warn(
        "[billing] credit grant failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }

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
  const now = new Date();
  const periodEnd = nextPeriodEnd(now);
  await db
    .update(subscriptions)
    .set({
      status: "active",
      canceled_at: now,
      updated_at: now,
      plan: "free",
      current_period_start: now,
      current_period_end: periodEnd,
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

  const { grantPlanCredits } = await import("../credits");
  await grantPlanCredits({
    organizationId,
    plan: "free",
    periodStart: now,
    reason: "Cancel to Free plan grant",
  });
}

export async function changePlanServerSide(
  organizationId: string,
  planId: PlanId,
  opts?: { requirePaidCheckout?: boolean },
): Promise<{ needsCheckout: boolean }> {
  const normalized = normalizePlanId(planId);
  const now = new Date();
  if (normalized === "free") {
    await db
      .update(subscriptions)
      .set({
        plan: "free",
        status: "active",
        payment_provider: null,
        updated_at: now,
        canceled_at: null,
        current_period_start: now,
        current_period_end: nextPeriodEnd(now),
      })
      .where(eq(subscriptions.organization_id, organizationId));
    const { grantPlanCredits } = await import("../credits");
    await grantPlanCredits({
      organizationId,
      plan: "free",
      periodStart: now,
      reason: "Downgrade to Free plan grant",
    });
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
      updated_at: now,
      current_period_start: now,
      current_period_end: nextPeriodEnd(now),
    })
    .where(eq(subscriptions.organization_id, organizationId));
  const { grantPlanCredits } = await import("../credits");
  await grantPlanCredits({
    organizationId,
    plan: normalized,
    periodStart: now,
    reason: `Plan change grant (${normalized})`,
  });
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

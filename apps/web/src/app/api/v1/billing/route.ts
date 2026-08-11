import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  cancelSubscriptionServerSide,
  canConsumeConversation,
  canConsumeProactive,
  changePlanServerSide,
  formatPlanPrice,
  getOrganizationForUser,
  getPlanEntitlements,
  getSubscriptionForOrg,
  listBillingEventsForOrg,
  normalizePlanId,
  PLAN_CATALOG,
  recommendUpgradePlan,
  startCheckout,
  type PaymentProviderId,
  type PlanId,
} from "@neylonai/domain/billing";
import { trackEventlySafe } from "@neylonai/integrations/evently";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session)
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  const org = await getOrganizationForUser(session.id);
  if (!org)
    return {
      error: NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      ),
    };
  return { session, org };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const planId = normalizePlanId(subscription?.plan);
    const entitlements = getPlanEntitlements(planId);
    const periodStart =
      subscription?.current_period_start ??
      new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const ctx = {
      organizationId: gate.org.organizationId,
      plan: planId,
    };

    const [events, conversations, proactive] = await Promise.all([
      listBillingEventsForOrg(gate.org.organizationId),
      canConsumeConversation(ctx, periodStart),
      canConsumeProactive(ctx),
    ]);

    const suggestedUpgrade = recommendUpgradePlan(planId);

    return NextResponse.json({
      success: true,
      data: {
        plans: Object.values(PLAN_CATALOG).map((p) => ({
          ...p,
          priceLabel: formatPlanPrice(p.planId),
        })),
        subscription: subscription
          ? {
              status: subscription.status,
              plan: planId,
              planName: entitlements.name,
              priceUsdMonthly: entitlements.priceUsdMonthly,
              priceLabel: formatPlanPrice(planId),
              billingCycle: "monthly" as const,
              paymentProvider: subscription.payment_provider,
              paymentMethodSummary: subscription.payment_provider
                ? `Managed by ${subscription.payment_provider}`
                : null,
              currentPeriodStart: subscription.current_period_start,
              currentPeriodEnd: subscription.current_period_end,
              entitlements,
            }
          : null,
        allowance: {
          conversations,
          proactive,
        },
        suggestedUpgrade,
        invoices: events,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load billing",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json().catch(() => ({}))) as {
      action?: "checkout" | "cancel" | "downgrade_free";
      planId?: string;
      provider?: PaymentProviderId;
      localeHint?: string;
    };

    const origin = new URL(req.url).origin;

    if (body.action === "cancel" || body.action === "downgrade_free") {
      const current = await getSubscriptionForOrg(gate.org.organizationId);
      await cancelSubscriptionServerSide(gate.org.organizationId);
      trackEventlySafe({
        event: "subscription_cancelled",
        organizationId: gate.org.organizationId,
        properties: { fromPlan: current?.plan ?? null },
      });
      return NextResponse.json({ success: true });
    }

    const planId = normalizePlanId(body.planId) as PlanId;
    if (planId === "free") {
      await changePlanServerSide(gate.org.organizationId, "free");
      trackEventlySafe({
        event: "subscription_downgraded",
        organizationId: gate.org.organizationId,
        properties: { planId: "free" },
      });
      return NextResponse.json({ success: true, data: { planId: "free" } });
    }

    const checkout = await startCheckout({
      organizationId: gate.org.organizationId,
      planId,
      successUrl: `${origin}/dashboard/settings?section=billing&checkout=success`,
      cancelUrl: `${origin}/dashboard/settings?section=billing&checkout=cancel`,
      customerEmail: gate.session.email,
      provider: body.provider,
      localeHint: body.localeHint,
    });

    trackEventlySafe({
      event: "subscription_upgraded",
      organizationId: gate.org.organizationId,
      properties: { planId, provider: checkout.provider, pending: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        checkoutUrl: checkout.checkoutUrl,
        provider: checkout.provider,
        note: "Entitlements activate only after the payment provider webhook confirms payment.",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Billing action failed",
      },
      { status: 500 },
    );
  }
}

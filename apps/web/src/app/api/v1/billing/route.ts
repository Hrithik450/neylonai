import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  cancelSubscriptionServerSide,
  canConsumeProactive,
  changePlanServerSide,
  currencyForCountry,
  formatPlanPrice,
  planPriceInCurrency,
  getOrgCreditSummary,
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

const requireOrg = async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { session, org };
};

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const planId = normalizePlanId(subscription?.plan);
    const entitlements = getPlanEntitlements(planId);
    const ctx = { organizationId: gate.org.organizationId, plan: planId };

    const [events, creditSummary, proactive] = await Promise.all([
      listBillingEventsForOrg(gate.org.organizationId),
      getOrgCreditSummary(gate.org.organizationId),
      canConsumeProactive(ctx),
    ]);

    const creditLimit = creditSummary.granted > 0 ? creditSummary.granted : entitlements.aiCreditsPerMonth;
    const aiCredits = {
      ok: creditSummary.available > 0 || creditSummary.onDemandEnabled,
      used: creditSummary.used,
      limit: creditLimit,
      remaining: creditSummary.available,
      reserved: creditSummary.reserved,
      onDemandUsed: creditSummary.onDemandUsed,
    };
    const suggestedUpgrade = recommendUpgradePlan(planId);
    const country =
      req.headers.get("x-vercel-ip-country") ??
      req.headers.get("cf-ipcountry") ??
      null;
    const currency = currencyForCountry(country);

    return NextResponse.json({
      success: true,
      data: {
        region: { country, currency },
        plans: Object.values(PLAN_CATALOG).map((p) => ({
          ...p,
          priceLabel: formatPlanPrice(p.planId),
          priceInrMonthly: planPriceInCurrency(p.planId, "INR"),
        })),
        subscription: subscription ? {
          status: subscription.status,
          plan: planId,
          planName: entitlements.name,
          priceUsdMonthly: entitlements.priceUsdMonthly,
          priceInrMonthly: planPriceInCurrency(planId, "INR"),
          priceLabel: formatPlanPrice(planId),
          billingCycle: "monthly" as const,
          paymentProvider: subscription.payment_provider,
          paymentMethodSummary: subscription.payment_provider ? `Managed by ${subscription.payment_provider}` : null,
          currentPeriodStart: subscription.current_period_start,
          currentPeriodEnd: subscription.current_period_end,
          entitlements,
        } : null,
        allowance: { aiCredits, proactive, workloads: creditSummary.workloads },
        wallet: {
          balance: creditSummary.balance,
          reserved: creditSummary.reserved,
          available: creditSummary.available,
          granted: creditSummary.granted,
          used: creditSummary.used,
          onDemandUsed: creditSummary.onDemandUsed,
          creditCosts: creditSummary.policy.creditCosts,
          sharedWallet: true as const,
          classQueryLimits: entitlements.classQuotas,
          oneWayBorrowing: true as const,
        },
        policy: creditSummary.policy,
        blocked: creditSummary.blocked,
        maxQueries: entitlements.classQuotas,
        classQuotas: entitlements.classQuotas,
        suggestedUpgrade,
        invoices: events,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load billing" }, { status: 500 });
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
      await cancelSubscriptionServerSide(gate.org.organizationId);
      return NextResponse.json({ success: true });
    }

    const planId = normalizePlanId(body.planId) as PlanId;
    if (planId === "free") {
      await changePlanServerSide(gate.org.organizationId, "free");
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

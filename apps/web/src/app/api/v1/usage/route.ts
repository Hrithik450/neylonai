import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  AI_CREDIT_CLASS_EXPLANATIONS,
  AI_CREDIT_CLASS_LABELS,
  buildUsageUpgradePrompt,
  canConsumeProactive,
  getCreditUsageTrend,
  getOrgCreditSummary,
  getOrganizationForUser,
  getPlanDisplay,
  getPlanEntitlements,
  getSubscriptionForOrg,
  normalizePlanId,
  type AiCreditClass,
} from "@neylonai/domain/billing";
import { getWebsiteCrawlEntitlements } from "@neylonai/domain/knowledge";

const meter = (used: number, limit: number, reserved = 0) => {
  const occupied = used + reserved;
  const percent = limit > 0 ? Math.min(100, Math.round((occupied / limit) * 100)) : 0;
  return { ok: occupied < limit, used, reserved, limit, remaining: Math.max(0, limit - occupied), percent };
};

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    const org = await getOrganizationForUser(session.id);
    if (!org) return NextResponse.json({ success: false, error: "No organization" }, { status: 403 });

    const trendDays = 30;
    const subscription = await getSubscriptionForOrg(org.organizationId);
    const plan = subscription?.plan ?? "free";
    const planId = normalizePlanId(plan);
    const entitlements = getPlanEntitlements(plan);
    const planDisplay = getPlanDisplay(planId);
    const periodStart = subscription?.current_period_start ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const ctx = { organizationId: org.organizationId, plan };

    const [credits, proactive, trend, website] = await Promise.all([
      getOrgCreditSummary(org.organizationId),
      canConsumeProactive(ctx),
      getCreditUsageTrend(org.organizationId, trendDays),
      getWebsiteCrawlEntitlements({ organizationId: org.organizationId, plan }),
    ]);

    const includedCreditMeter = meter(credits.used, credits.granted, credits.reserved);
    const creditMeter = { ...includedCreditMeter, ok: includedCreditMeter.ok || credits.policy.onDemand, includedExhausted: !includedCreditMeter.ok };
    const nearLimit = creditMeter.percent >= 85;

    return NextResponse.json({
      success: true,
      data: {
        plan: planId,
        planName: planDisplay.name,
        planPriceLabel: planDisplay.priceLabel,
        period: {
          start: periodStart.toISOString(),
          end: subscription?.current_period_end ? new Date(subscription.current_period_end).toISOString() : null,
        },
        policy: credits.policy,
        blocked: credits.blocked,
        credits: {
          used: credits.used,
          remaining: credits.available,
          granted: credits.granted,
          reserved: credits.reserved,
          onDemandUsed: credits.onDemandUsed,
          totalUsed: credits.totalUsed,
          conversations: credits.conversations,
          averagePerConversation: credits.averageCreditsPerConversation,
          byClass: credits.byClass.map((row) => ({
            ...row,
            label: AI_CREDIT_CLASS_LABELS[row.complexityClass as AiCreditClass] ?? row.complexityClass,
            explanation: AI_CREDIT_CLASS_EXPLANATIONS[row.complexityClass as AiCreditClass] ?? "",
          })),
          meter: creditMeter,
        },
        workloads: credits.workloads,
        maxQueries: entitlements.classQuotas,
        classQuotas: entitlements.classQuotas,
        wallet: {
          balance: credits.balance,
          reserved: credits.reserved,
          available: credits.available,
          granted: credits.granted,
          used: credits.used,
          onDemandUsed: credits.onDemandUsed,
          creditCosts: credits.policy.creditCosts,
          sharedWallet: true as const,
          classQueryLimits: entitlements.classQuotas,
          oneWayBorrowing: true as const,
        },
        allowance: {
          aiCredits: creditMeter,
          proactive: meter(proactive.used, proactive.limit),
          websitePages: meter(website.monthlyUsed, website.websitePagesPerMonth),
        },
        nearLimit,
        upgradePrompt: buildUsageUpgradePrompt(plan, { used: credits.used, limit: credits.granted, metricLabel: "included AI credits" }),
        trend: { days: trendDays, points: trend },
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to load usage" }, { status: 500 });
  }
}

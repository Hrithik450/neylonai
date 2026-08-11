import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  buildUsageUpgradePrompt,
  canConsumeConversation,
  canConsumeProactive,
  canUseKnowledgeBase,
  countEnabledIntegrations,
  getOrganizationForUser,
  getPlanDisplay,
  getPlanEntitlements,
  getSubscriptionForOrg,
  getUsageTrendForOrg,
  normalizePlanId,
} from "@neylonai/domain/billing";

function meter(used: number, limit: number) {
  const percent =
    limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return {
    ok: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percent,
  };
}

/** Customer-facing usage — allowances only, no provider COGS. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const org = await getOrganizationForUser(session.id);
    if (!org) {
      return NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      );
    }

    const trendDays =
      Number(new URL(req.url).searchParams.get("trendDays") ?? "30") === 7
        ? 7
        : 30;

    const subscription = await getSubscriptionForOrg(org.organizationId);
    const plan = subscription?.plan ?? "free";
    const planId = normalizePlanId(plan);
    const entitlements = getPlanEntitlements(plan);
    const planDisplay = getPlanDisplay(planId);
    const periodStart =
      subscription?.current_period_start ??
      new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const ctx = { organizationId: org.organizationId, plan };
    const [conversations, proactive, knowledge, integrationsUsed, trend] =
      await Promise.all([
        canConsumeConversation(ctx, periodStart),
        canConsumeProactive(ctx),
        canUseKnowledgeBase(ctx),
        countEnabledIntegrations(org.organizationId),
        getUsageTrendForOrg(org.organizationId, trendDays),
      ]);

    const conversationMeter = meter(conversations.used, conversations.limit);

    return NextResponse.json({
      success: true,
      data: {
        plan: planId,
        planName: planDisplay.name,
        planPriceLabel: planDisplay.priceLabel,
        period: {
          start: periodStart.toISOString(),
          end: subscription?.current_period_end
            ? new Date(subscription.current_period_end).toISOString()
            : null,
        },
        allowance: {
          conversations: conversationMeter,
          proactive: meter(proactive.used, proactive.limit),
          knowledge: meter(knowledge.used, knowledge.limit),
          integrations: meter(
            integrationsUsed,
            entitlements.integrationsLimit,
          ),
        },
        nearLimit: conversationMeter.percent >= 85,
        upgradePrompt: buildUsageUpgradePrompt(plan, {
          used: conversations.used,
          limit: conversations.limit,
        }),
        trend: { days: trendDays, points: trend },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load usage",
      },
      { status: 500 },
    );
  }
}

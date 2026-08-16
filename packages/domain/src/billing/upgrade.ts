import {
  getPlanEntitlements,
  normalizePlanId,
  PLAN_CATALOG,
  type PlanEntitlements,
  type PlanId,
} from "./plans";

export type UpgradeFeature =
  | "advanced_proactive"
  | "more_conversations"
  | "more_integrations"
  | "more_websites"
  | "more_website_pages";

export interface UpgradePromptContent {
  /** Short headline. */
  title: string;
  /** Why this plan / feature needs an upgrade. */
  detail: string;
  /** Plan to promote (never invent — must unlock the need). */
  targetPlanId: PlanId;
  targetPlanName: string;
  targetPriceUsdMonthly: number;
  ctaLabel: string;
  /** Dashboard billing deep-link with suggested plan. */
  href: string;
}

const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "business"];

function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

/** Lowest paid plan that unlocks the capability. */
export function lowestPlanForFeature(feature: UpgradeFeature): PlanId {
  for (const id of PLAN_ORDER) {
    const e = PLAN_CATALOG[id];
    if (planSatisfiesFeature(e, feature)) return id;
  }
  return "business";
}

function planSatisfiesFeature(
  e: PlanEntitlements,
  feature: UpgradeFeature,
): boolean {
  switch (feature) {
    case "advanced_proactive":
      return e.advancedProactive;
    case "more_conversations":
      return e.aiCreditsPerMonth > PLAN_CATALOG.free.aiCreditsPerMonth;
    case "more_integrations":
      return e.integrationsLimit > PLAN_CATALOG.free.integrationsLimit;
    case "more_websites":
      return e.websites > 1;
    case "more_website_pages":
      return e.websitePagesPerSync > PLAN_CATALOG.free.websitePagesPerSync;
    default:
      return false;
  }
}

/**
 * Recommend an upgrade target. Never returns the current plan or a downgrade.
 * Business → null (no upgrade advertising).
 */
export function recommendUpgradePlan(
  currentPlan: string | null | undefined,
  feature?: UpgradeFeature,
): PlanId | null {
  const current = normalizePlanId(currentPlan);
  if (current === "business") return null;

  if (feature) {
    const needed = lowestPlanForFeature(feature);
    if (planRank(needed) > planRank(current)) return needed;
    // Already entitled for that feature — bump one tier for headroom when relevant.
    if (feature === "more_conversations" || feature === "more_integrations") {
      const next = PLAN_ORDER[planRank(current) + 1];
      return next ?? null;
    }
    return null;
  }

  // Default nudge path.
  if (current === "free") return "starter";
  if (current === "starter") return "pro";
  if (current === "pro") return "business";
  return null;
}

export function formatPlanPrice(planId: PlanId): string {
  const price = PLAN_CATALOG[planId].priceUsdMonthly;
  if (price === 0) return "$0";
  return `$${price}/mon`;
}

export function buildFeatureUpgradePrompt(
  currentPlan: string | null | undefined,
  feature: UpgradeFeature,
  options?: { featureLabel?: string },
): UpgradePromptContent | null {
  const current = normalizePlanId(currentPlan);
  const target = recommendUpgradePlan(current, feature);
  if (!target) return null;

  const targetEnt = PLAN_CATALOG[target];
  const label = options?.featureLabel ?? featureLabel(feature);

  return {
    title: `${label} requires ${targetEnt.name}`,
    detail: featureDetail(feature, targetEnt),
    targetPlanId: target,
    targetPlanName: targetEnt.name,
    targetPriceUsdMonthly: targetEnt.priceUsdMonthly,
    ctaLabel: `Upgrade to ${targetEnt.name}`,
    href: `/dashboard/settings?section=billing&upgrade=${target}`,
  };
}

/** Upgrade prompt when an integration's planBadge blocks the current plan. */
export function buildPlanBadgeUpgradePrompt(
  currentPlan: string | null | undefined,
  planBadge: "free" | "starter" | "pro" | "business" | undefined,
): UpgradePromptContent | null {
  const current = normalizePlanId(currentPlan);
  const needed: PlanId = normalizePlanId(planBadge ?? "free");
  if (planRank(needed) <= planRank(current)) {
    return buildFeatureUpgradePrompt(currentPlan, "more_integrations");
  }
  const targetEnt = PLAN_CATALOG[needed];
  return {
    title: `This integration requires ${targetEnt.name}`,
    detail: `Upgrade to ${targetEnt.name} (${formatPlanPrice(needed)}) to enable this integration.`,
    targetPlanId: needed,
    targetPlanName: targetEnt.name,
    targetPriceUsdMonthly: targetEnt.priceUsdMonthly,
    ctaLabel: `Upgrade to ${targetEnt.name}`,
    href: `/dashboard/settings?section=billing&upgrade=${needed}`,
  };
}

export function buildUsageUpgradePrompt(
  currentPlan: string | null | undefined,
  input: { used: number; limit: number; metricLabel?: string },
): UpgradePromptContent | null {
  const current = normalizePlanId(currentPlan);
  if (current === "business") return null;
  if (input.limit <= 0) return null;
  const ratio = input.used / input.limit;
  if (ratio < 0.85) return null;

  const target = recommendUpgradePlan(current, "more_conversations");
  if (!target) return null;
  const targetEnt = PLAN_CATALOG[target];
  const pct = Math.round(ratio * 100);
  const metric = input.metricLabel ?? "included AI credits";

  return {
    title: `You’re using ${pct}% of your ${metric}`,
    detail: `Upgrade to ${targetEnt.name} for a larger shared AI credit pool (${targetEnt.aiCreditsPerMonth.toLocaleString()} / month).`,
    targetPlanId: target,
    targetPlanName: targetEnt.name,
    targetPriceUsdMonthly: targetEnt.priceUsdMonthly,
    ctaLabel: `Upgrade to ${targetEnt.name}`,
    href: `/dashboard/settings?section=billing&upgrade=${target}`,
  };
}

/**
 * Whether Overview / UI should show a soft "Upgrade" vs only "Manage plan".
 * Pro only sees Upgrade when Business is relevant (limits / seats).
 */
export function shouldShowUpgradeCta(
  currentPlan: string | null | undefined,
  opts?: { usageRatio?: number; needsBusiness?: boolean },
): boolean {
  const current = normalizePlanId(currentPlan);
  if (current === "business") return false;
  if (current === "free" || current === "starter") return true;
  if (current === "pro") {
    return Boolean(opts?.needsBusiness || (opts?.usageRatio ?? 0) >= 0.85);
  }
  return false;
}

function featureLabel(feature: UpgradeFeature): string {
  switch (feature) {
    case "advanced_proactive":
      return "Advanced proactive engagement";
    case "more_conversations":
      return "More included AI credits";
    case "more_integrations":
      return "More integrations";
    case "more_websites":
      return "More websites";
    case "more_website_pages":
      return "More website pages";
    default:
      return "This feature";
  }
}

function featureDetail(
  feature: UpgradeFeature,
  target: PlanEntitlements,
): string {
  switch (feature) {
    case "advanced_proactive":
      return `${target.name} includes advanced proactive engagement controls.`;
    default:
      return `Your current plan doesn’t include this. Upgrade to ${target.name} (${formatPlanPrice(target.planId)}).`;
  }
}

export function getPlanDisplay(plan: string | null | undefined) {
  const e = getPlanEntitlements(plan);
  return {
    planId: e.planId,
    name: e.name,
    priceLabel: formatPlanPrice(e.planId),
    billingCycle: "monthly" as const,
    entitlements: e,
  };
}

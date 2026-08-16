/**
 * Plan catalog + entitlements.
 *
 * Customer-facing AI credits are an abstract usage unit (NOT dollars, NOT
 * provider tokens). Included credits and workload quotas live HERE
 * (via workload-policy) — routes must call getPlanEntitlements() / helpers,
 * never hardcode quotas.
 */

import { listBillingCatalogEntries } from "@neylonai/integrations/catalog";
import {
  AI_CREDITS_INCLUDED_BY_PLAN,
  PLAN_CLASS_QUOTAS,
  type AiCreditClass,
  type WorkloadPlanId,
} from "./workload-policy";

export type PlanId = WorkloadPlanId;

export { AI_CREDITS_INCLUDED_BY_PLAN };

export type PlanClassQuotas = Record<AiCreditClass, number>;

export interface PlanEntitlements {
  planId: PlanId;
  name: string;
  /** Display subscription price USD / month. Free = 0. */
  priceUsdMonthly: number;
  /**
   * Included AI credits granted per billing period (primary entitlement).
   * Abstract usage units — not USD and not provider tokens.
   * Workload mapping is Simple 1 / Standard 2 / Complex 8 (observed after
   * delivery, capped by the effective class after query-limit routing).
   */
  aiCreditsPerMonth: number;
  /** Hard per-period query limits with one-way upward borrowing. */
  classQuotas: PlanClassQuotas;
  /** Paid plans continue beyond included credits as provider-metered overage. */
  onDemandBilling: boolean;
  /**
   * Analytics-only soft count of conversation turns (not the entitlement gate).
   * Kept for dashboards / backwards compatibility.
   */
  conversationsPerMonth: number;
  /** Soft API requests / minute per client key. */
  apiRequestsPerMinute: number;
  knowledgeChunksApprox: number;
  websites: number;
  /** Org-wide selected evergreen website pages stored after a crawl. */
  websitePagesPerSync: number;
  /** How many website refresh runs are allowed per calendar month. */
  websitePagesPerMonth: number;
  proactiveSuggestionsPerDay: number;
  proactiveEnabled: boolean;
  advancedProactive: boolean;
  integrationsLimit: number;
  allowedOriginsRequired: boolean;
}

function entitlements(
  planId: PlanId,
  extras: Omit<
    PlanEntitlements,
    "planId" | "aiCreditsPerMonth" | "classQuotas" | "onDemandBilling"
  >,
): PlanEntitlements {
  return {
    planId,
    aiCreditsPerMonth: AI_CREDITS_INCLUDED_BY_PLAN[planId],
    classQuotas: PLAN_CLASS_QUOTAS[planId],
    onDemandBilling: planId !== "free",
    ...extras,
  };
}

export const PLAN_CATALOG: Record<PlanId, PlanEntitlements> = {
  free: entitlements("free", {
    name: "Free",
    priceUsdMonthly: 0,
    conversationsPerMonth: 50,
    apiRequestsPerMinute: 20,
    knowledgeChunksApprox: 200,
    websites: 1,
    websitePagesPerSync: 8,
    websitePagesPerMonth: 1,
    proactiveSuggestionsPerDay: 20,
    proactiveEnabled: true,
    advancedProactive: false,
    integrationsLimit: 1,
    allowedOriginsRequired: false,
  }),
  starter: entitlements("starter", {
    name: "Starter",
    priceUsdMonthly: 19,
    conversationsPerMonth: 500,
    apiRequestsPerMinute: 60,
    knowledgeChunksApprox: 2_000,
    websites: 1,
    websitePagesPerSync: 50,
    websitePagesPerMonth: 2,
    proactiveSuggestionsPerDay: 200,
    proactiveEnabled: true,
    advancedProactive: false,
    integrationsLimit: 3,
    allowedOriginsRequired: true,
  }),
  pro: entitlements("pro", {
    name: "Pro",
    priceUsdMonthly: 49,
    conversationsPerMonth: 2_500,
    apiRequestsPerMinute: 120,
    knowledgeChunksApprox: 15_000,
    websites: 3,
    websitePagesPerSync: 250,
    websitePagesPerMonth: 2,
    proactiveSuggestionsPerDay: 2_000,
    proactiveEnabled: true,
    advancedProactive: true,
    integrationsLimit: 10,
    allowedOriginsRequired: true,
  }),
  business: entitlements("business", {
    name: "Business",
    priceUsdMonthly: 149,
    conversationsPerMonth: 15_000,
    apiRequestsPerMinute: 300,
    knowledgeChunksApprox: 80_000,
    websites: 10,
    websitePagesPerSync: 1_000,
    websitePagesPerMonth: 2,
    proactiveSuggestionsPerDay: 10_000,
    proactiveEnabled: true,
    advancedProactive: true,
    integrationsLimit: 50,
    allowedOriginsRequired: true,
  }),
};

export function normalizePlanId(plan: string | null | undefined): PlanId {
  const p = (plan ?? "free").toLowerCase();
  if (p === "starter" || p === "pro" || p === "business" || p === "free") {
    return p;
  }
  // Pre-0071 rows used "platform" for the Business grant (10,000 credits).
  if (p === "platform") return "business";
  return "free";
}

export function getPlanEntitlements(
  plan: string | null | undefined,
): PlanEntitlements {
  return PLAN_CATALOG[normalizePlanId(plan)];
}

/** User-chosen page cap, never above the plan's selected-page ceiling. */
export function clampWebsiteMaxPages(
  plan: string | null | undefined,
  requested?: number | null,
): number {
  const cap = getPlanEntitlements(plan).websitePagesPerSync;
  if (requested == null || !Number.isFinite(requested)) return cap;
  return Math.max(1, Math.min(Math.floor(requested), cap));
}

export const FEATURE_KEYS = ["proactive", "advanced_proactive"] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export function planHasFeature(
  entitlements: PlanEntitlements,
  feature: FeatureKey,
): boolean {
  switch (feature) {
    case "proactive":
      return entitlements.proactiveEnabled;
    case "advanced_proactive":
      return entitlements.advancedProactive;
    default:
      return false;
  }
}

/**
 * Static billing entitlement catalog (plan tiers). Presentation lives in the
 * code registry (`@neylonai/agent`); org enablement in `organization_agents`.
 *
 * Main Agent is the runtime entry point; specialized entries are blueprints.
 */
export const AGENT_CATALOG = [
  {
    id: "main-agent",
    name: "Main Agent",
    description:
      "Primary conversational agent with knowledge, meeting-link, and escalation capabilities.",
    purpose: "Primary conversational agent",
    tier: "basic" as const,
    builtIn: true,
    defaultEnabled: true,
  },
] as const;

/**
 * Billing entitlement catalog — derived from `@neylonai/integrations` registry.
 * Do not maintain a parallel list here.
 */
export const INTEGRATION_CATALOG = listBillingCatalogEntries();

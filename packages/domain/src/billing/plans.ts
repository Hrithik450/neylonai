/**
 * Plan catalog + entitlements.
 *
 * Limits are informed by competitor bands (Intercom outcome pricing, Tidio/Crisp
 * message tiers) and rough Gemini Flash + embedding + infra cost (~$0.01–0.03
 * fully loaded per conversation). Numbers live HERE only — routes must call
 * getPlanEntitlements() / canUse* helpers, never hardcode quotas.
 */

import { listBillingCatalogEntries } from "@neylonai/integrations/catalog";

export type PlanId = "free" | "starter" | "pro" | "business";

export interface PlanEntitlements {
  planId: PlanId;
  name: string;
  /** Display price USD / month. Free = 0. */
  priceUsdMonthly: number;
  /** Conversations (user→assistant turns counted as 1) per billing period. */
  conversationsPerMonth: number;
  /** Soft API requests / minute per client key. */
  apiRequestsPerMinute: number;
  knowledgeDocuments: number;
  knowledgeChunksApprox: number;
  websites: number;
  teamSeats: number;
  proactiveSuggestionsPerDay: number;
  proactiveEnabled: boolean;
  advancedProactive: boolean;
  basicAgents: boolean;
  advancedAgents: boolean;
  integrationsLimit: number;
  crmIntegrations: boolean;
  fullWidgetCustomization: boolean;
  prioritySupport: boolean;
  allowedOriginsRequired: boolean;
}

export const PLAN_CATALOG: Record<PlanId, PlanEntitlements> = {
  free: {
    planId: "free",
    name: "Free",
    priceUsdMonthly: 0,
    conversationsPerMonth: 50,
    apiRequestsPerMinute: 20,
    knowledgeDocuments: 5,
    knowledgeChunksApprox: 200,
    websites: 1,
    teamSeats: 1,
    proactiveSuggestionsPerDay: 20,
    proactiveEnabled: true,
    advancedProactive: false,
    basicAgents: false,
    advancedAgents: false,
    integrationsLimit: 1,
    crmIntegrations: false,
    fullWidgetCustomization: false,
    prioritySupport: false,
    allowedOriginsRequired: false,
  },
  starter: {
    planId: "starter",
    name: "Starter",
    priceUsdMonthly: 19,
    conversationsPerMonth: 500,
    apiRequestsPerMinute: 60,
    knowledgeDocuments: 40,
    knowledgeChunksApprox: 2_000,
    websites: 1,
    teamSeats: 2,
    proactiveSuggestionsPerDay: 200,
    proactiveEnabled: true,
    advancedProactive: false,
    basicAgents: true,
    advancedAgents: false,
    integrationsLimit: 3,
    crmIntegrations: false,
    fullWidgetCustomization: true,
    prioritySupport: false,
    allowedOriginsRequired: true,
  },
  pro: {
    planId: "pro",
    name: "Pro",
    priceUsdMonthly: 49,
    conversationsPerMonth: 2_500,
    apiRequestsPerMinute: 120,
    knowledgeDocuments: 200,
    knowledgeChunksApprox: 15_000,
    websites: 3,
    teamSeats: 5,
    proactiveSuggestionsPerDay: 2_000,
    proactiveEnabled: true,
    advancedProactive: true,
    basicAgents: true,
    advancedAgents: true,
    integrationsLimit: 10,
    crmIntegrations: true,
    fullWidgetCustomization: true,
    prioritySupport: false,
    allowedOriginsRequired: true,
  },
  business: {
    planId: "business",
    name: "Business",
    priceUsdMonthly: 149,
    conversationsPerMonth: 15_000,
    apiRequestsPerMinute: 300,
    knowledgeDocuments: 1_000,
    knowledgeChunksApprox: 80_000,
    websites: 10,
    teamSeats: 20,
    proactiveSuggestionsPerDay: 10_000,
    proactiveEnabled: true,
    advancedProactive: true,
    basicAgents: true,
    advancedAgents: true,
    integrationsLimit: 50,
    crmIntegrations: true,
    fullWidgetCustomization: true,
    prioritySupport: true,
    allowedOriginsRequired: true,
  },
};

export function normalizePlanId(plan: string | null | undefined): PlanId {
  const p = (plan ?? "free").toLowerCase();
  if (p === "starter" || p === "pro" || p === "business" || p === "free") {
    return p;
  }
  // Legacy seeds used "platform" / "starter" — map unknown paid-looking to pro.
  if (p === "platform") return "business";
  return "free";
}

export function getPlanEntitlements(plan: string | null | undefined): PlanEntitlements {
  return PLAN_CATALOG[normalizePlanId(plan)];
}

export const FEATURE_KEYS = [
  "proactive",
  "advanced_proactive",
  "basic_agents",
  "advanced_agents",
  "crm",
  "full_widget_customization",
  "priority_support",
] as const;

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
    case "basic_agents":
      return entitlements.basicAgents;
    case "advanced_agents":
      return entitlements.advancedAgents;
    case "crm":
      return entitlements.crmIntegrations;
    case "full_widget_customization":
      return entitlements.fullWidgetCustomization;
    case "priority_support":
      return entitlements.prioritySupport;
    default:
      return false;
  }
}

/**
 * Agent catalog — aligns with @neylonai/agent workforce registry.
 * Human handoff is a ticket capability (not an agent). CRM is an integration.
 */
export const AGENT_CATALOG = [
  {
    id: "neylonai-chatbot",
    name: "Support Agent",
    description:
      "Answers customer questions and escalates for team follow-up when a human is needed.",
    purpose: "Answers customer questions",
    tier: "basic" as const,
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "lead",
    name: "Lead Agent",
    description:
      "Captures and qualifies leads from conversations for your team or CRM.",
    purpose: "Captures and qualifies leads",
    tier: "basic" as const,
    builtIn: true,
    defaultEnabled: true,
  },
  {
    id: "sales",
    name: "Sales Agent",
    description: "Qualifies prospects and surfaces buying signals.",
    purpose: "Qualifies prospects",
    tier: "advanced" as const,
    builtIn: false,
    defaultEnabled: false,
  },
  {
    id: "booking",
    name: "Booking Agent",
    description: "Collects availability and helps book demos or meetings.",
    purpose: "Schedules demos and meetings",
    tier: "advanced" as const,
    builtIn: false,
    defaultEnabled: false,
  },
] as const;

/**
 * Billing entitlement catalog — derived from `@neylonai/integrations` registry.
 * Do not maintain a parallel list here.
 */
export const INTEGRATION_CATALOG = listBillingCatalogEntries();

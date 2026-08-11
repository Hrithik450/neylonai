import { and, eq, count } from "drizzle-orm";
import {
  db,
  knowledgeDocuments,
  organizationIntegrations,
  organizationAgents,
} from "@neylonai/database";
import {
  AGENT_CATALOG,
  getPlanEntitlements,
  INTEGRATION_CATALOG,
  planHasFeature,
  type FeatureKey,
  type PlanEntitlements,
  type PlanId,
} from "./plans";
import { ApiAuthError } from "./keys";
import { countProductMetric } from "./usage";

export interface EntitlementContext {
  organizationId: string;
  plan: string;
  entitlements?: PlanEntitlements;
}

function entitlementsFor(ctx: EntitlementContext): PlanEntitlements {
  return ctx.entitlements ?? getPlanEntitlements(ctx.plan);
}

export function canUseFeature(
  ctx: EntitlementContext,
  feature: FeatureKey,
): boolean {
  return planHasFeature(entitlementsFor(ctx), feature);
}

export function canUseProactive(ctx: EntitlementContext): boolean {
  return canUseFeature(ctx, "proactive");
}

export function canUseAgent(ctx: EntitlementContext, agentId: string): boolean {
  const e = entitlementsFor(ctx);
  const agent = AGENT_CATALOG.find((a) => a.id === agentId);
  if (!agent) return false;
  if (agent.builtIn) return true;
  // Advanced catalog agents require advancedAgents entitlement.
  return agent.tier === "advanced" ? e.advancedAgents : e.basicAgents;
}

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

const BADGE_TO_PLAN: Record<string, PlanId> = {
  free: "free",
  starter: "starter",
  pro: "pro",
  business: "business",
};

function planMeetsBadge(planId: PlanId, badge: string | undefined): boolean {
  const needed = BADGE_TO_PLAN[badge ?? "free"] ?? "free";
  return (PLAN_RANK[planId] ?? 0) >= (PLAN_RANK[needed] ?? 0);
}

export function canUseIntegration(
  ctx: EntitlementContext,
  integrationId: string,
): boolean {
  const e = entitlementsFor(ctx);
  const item = INTEGRATION_CATALOG.find((i) => i.id === integrationId);
  if (!item) return false;
  return planMeetsBadge(e.planId, item.planBadge);
}

export function canUseWebsite(
  ctx: EntitlementContext,
  websiteCount: number,
): boolean {
  return websiteCount <= entitlementsFor(ctx).websites;
}

export async function canUseKnowledgeBase(
  ctx: EntitlementContext,
): Promise<{ ok: boolean; used: number; limit: number }> {
  const e = entitlementsFor(ctx);
  const [row] = await db
    .select({ n: count() })
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.organization_id, ctx.organizationId));
  const used = Number(row?.n ?? 0);
  return { ok: used < e.knowledgeDocuments, used, limit: e.knowledgeDocuments };
}

export async function countConversationsThisPeriod(
  organizationId: string,
  periodStart: Date,
): Promise<number> {
  return countProductMetric(organizationId, "conversation_turn", periodStart);
}

export async function canConsumeConversation(
  ctx: EntitlementContext,
  periodStart?: Date,
): Promise<{ ok: boolean; used: number; limit: number }> {
  const e = entitlementsFor(ctx);
  const start =
    periodStart ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const used = await countConversationsThisPeriod(ctx.organizationId, start);
  return {
    ok: used < e.conversationsPerMonth,
    used,
    limit: e.conversationsPerMonth,
  };
}

export async function countProactiveToday(
  organizationId: string,
): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return countProductMetric(organizationId, "proactive_refresh", start);
}

export async function canConsumeProactive(
  ctx: EntitlementContext,
): Promise<{ ok: boolean; used: number; limit: number }> {
  const e = entitlementsFor(ctx);
  if (!e.proactiveEnabled) {
    return { ok: false, used: 0, limit: 0 };
  }
  const used = await countProactiveToday(ctx.organizationId);
  return {
    ok: used < e.proactiveSuggestionsPerDay,
    used,
    limit: e.proactiveSuggestionsPerDay,
  };
}

export async function countEnabledIntegrations(
  organizationId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, organizationId),
        eq(organizationIntegrations.enabled, true),
      ),
    );
  return Number(row?.n ?? 0);
}

export async function assertCanConsumeConversation(
  ctx: EntitlementContext,
  periodStart?: Date,
): Promise<void> {
  const result = await canConsumeConversation(ctx, periodStart);
  if (!result.ok) {
    throw new ApiAuthError(
      "usage_exceeded",
      `Conversation limit reached (${result.used}/${result.limit}). Upgrade your plan.`,
      402,
    );
  }
}

export async function assertCanUseProactive(
  ctx: EntitlementContext,
): Promise<void> {
  if (!canUseProactive(ctx)) {
    throw new ApiAuthError(
      "entitlement_denied",
      "Proactive suggestions are not available on this plan.",
      403,
    );
  }
  const result = await canConsumeProactive(ctx);
  if (!result.ok) {
    throw new ApiAuthError(
      "usage_exceeded",
      `Daily proactive suggestion limit reached (${result.used}/${result.limit}).`,
      402,
    );
  }
}

export function assertCanUseAgent(
  ctx: EntitlementContext,
  agentId: string,
): void {
  if (!canUseAgent(ctx, agentId)) {
    throw new ApiAuthError(
      "entitlement_denied",
      `Agent "${agentId}" is not available on this plan.`,
      403,
    );
  }
}

export function assertCanUseIntegration(
  ctx: EntitlementContext,
  integrationId: string,
): void {
  if (!canUseIntegration(ctx, integrationId)) {
    throw new ApiAuthError(
      "entitlement_denied",
      `Integration "${integrationId}" is not available on this plan.`,
      403,
    );
  }
}

export async function assertCanEnableIntegration(
  ctx: EntitlementContext,
  integrationId: string,
): Promise<void> {
  assertCanUseIntegration(ctx, integrationId);
  const e = entitlementsFor(ctx);
  const enabled = await countEnabledIntegrations(ctx.organizationId);
  const already = await db
    .select({
      id: organizationIntegrations.id,
      enabled: organizationIntegrations.enabled,
    })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organization_id, ctx.organizationId),
        eq(organizationIntegrations.integration_type, integrationId),
      ),
    )
    .limit(1);
  if (already[0]?.enabled) return;
  if (enabled >= e.integrationsLimit) {
    throw new ApiAuthError(
      "entitlement_denied",
      `Integration limit reached (${enabled}/${e.integrationsLimit}).`,
      403,
    );
  }
}

export function getPlanId(plan: string): PlanId {
  return getPlanEntitlements(plan).planId;
}

export async function listOrgAgents(organizationId: string) {
  return db
    .select()
    .from(organizationAgents)
    .where(eq(organizationAgents.organization_id, organizationId));
}

export async function setOrgAgentEnabled(
  organizationId: string,
  agentId: string,
  enabled: boolean,
  config?: Record<string, unknown>,
) {
  await db
    .insert(organizationAgents)
    .values({
      organization_id: organizationId,
      agent_id: agentId,
      enabled,
      config: config ?? {},
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [organizationAgents.organization_id, organizationAgents.agent_id],
      set: {
        enabled,
        ...(config !== undefined ? { config } : {}),
        updated_at: new Date(),
      },
    });
}

export async function getOrgAgent(organizationId: string, agentId: string) {
  const [row] = await db
    .select()
    .from(organizationAgents)
    .where(
      and(
        eq(organizationAgents.organization_id, organizationId),
        eq(organizationAgents.agent_id, agentId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listOrgIntegrations(organizationId: string) {
  return db
    .select()
    .from(organizationIntegrations)
    .where(eq(organizationIntegrations.organization_id, organizationId));
}

export async function setOrgIntegration(
  organizationId: string,
  integrationId: string,
  input: {
    enabled?: boolean;
    config?: Record<string, unknown>;
  },
): Promise<{ storageKeys: string[] }> {
  await db
    .insert(organizationIntegrations)
    .values({
      organization_id: organizationId,
      integration_type: integrationId,
      enabled: input.enabled ?? false,
      config: input.config ?? {},
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        organizationIntegrations.organization_id,
        organizationIntegrations.integration_type,
      ],
      set: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.config !== undefined ? { config: input.config } : {}),
        updated_at: new Date(),
      },
    });

  // Turning off removes all knowledge for that integration
  // (source → documents → chunks via FK cascade) and vault secrets.
  if (input.enabled === false) {
    const { deleteSecretsForOrgCatalogIntegration } = await import(
      "../integrations/secrets"
    );
    await deleteSecretsForOrgCatalogIntegration({
      organizationId,
      integrationType: integrationId,
    });
    const { purgeKnowledgeForCatalogIntegration } = await import(
      "../knowledge/service"
    );
    return purgeKnowledgeForCatalogIntegration(organizationId, integrationId);
  }
  return { storageKeys: [] };
}

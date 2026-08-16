import { and, eq, count } from "drizzle-orm";
import { db, organizationIntegrations } from "@neylonai/database";
import { getIntegrationManifest } from "@neylonai/integrations/catalog";
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

/**
 * Single-agent product: Main Agent is always entitled.
 * Specialized catalog entries are blueprints, not plan-gated tiers.
 */
export function canUseAgent(
  _ctx: EntitlementContext,
  agentId: string,
): boolean {
  const agent = AGENT_CATALOG.find((a) => a.id === agentId);
  if (!agent) return false;
  return agent.id === "main-agent" || agent.defaultEnabled;
}

export function canUseAgentRecord(
  _ctx: EntitlementContext,
  agent: {
    role: string;
    tier: string;
    status: string;
  },
): boolean {
  if (agent.role === "main") return true;
  return agent.status === "active";
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
  // Credit gating happens after the preflight billability/workload classifier.
  // This lets social turns remain free and paid plans enter on-demand mode.
  void ctx;
  void periodStart;
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
  agentIdOrSlug: string,
): void {
  if (!canUseAgent(ctx, agentIdOrSlug)) {
    throw new ApiAuthError(
      "entitlement_denied",
      `Agent "${agentIdOrSlug}" is not available on this plan.`,
      403,
    );
  }
}

export function assertCanUseAgentRecord(
  ctx: EntitlementContext,
  agent: {
    role: string;
    tier: string;
    status: string;
    name?: string;
  },
): void {
  if (agent.status !== "active" && agent.role !== "main") {
    throw new ApiAuthError(
      "entitlement_denied",
      `Agent "${agent.name ?? "unknown"}" is coming soon and cannot be enabled yet.`,
      403,
    );
  }
  if (!canUseAgentRecord(ctx, agent)) {
    throw new ApiAuthError(
      "entitlement_denied",
      `Agent "${agent.name ?? "unknown"}" is not available on this plan.`,
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

  const manifest = getIntegrationManifest(integrationId);
  if (!manifest) {
    throw new ApiAuthError(
      "entitlement_denied",
      `Unknown integration "${integrationId}".`,
      404,
    );
  }
  if (manifest.connectable === false) {
    throw new ApiAuthError(
      "entitlement_denied",
      `Integration "${manifest.name || integrationId}" is coming soon and cannot be enabled yet.`,
      403,
    );
  }

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
        eq(organizationIntegrations.integration_id, integrationId),
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
  const { OrgAgentsService } = await import("../agents/org-agents.service");
  return OrgAgentsService.list(organizationId);
}

/**
 * Connect (enabled=true) or disconnect specialized (enabled=false → delete row).
 * Main agent cannot be disconnected.
 */
export async function setOrgAgentEnabled(
  organizationId: string,
  agentKey: string,
  enabled: boolean,
  extra?: Record<string, unknown>,
) {
  const { OrgAgentsService } = await import("../agents/org-agents.service");
  const { MAIN_AGENT_KEY } = await import("../agents/org-agents.types");

  if (!enabled) {
    if (agentKey === MAIN_AGENT_KEY) {
      throw new ApiAuthError(
        "entitlement_denied",
        "Main Agent cannot be disconnected",
        400,
      );
    }
    await OrgAgentsService.disconnect(organizationId, agentKey);
    return;
  }

  await OrgAgentsService.connect(organizationId, agentKey, extra);
}

export async function getOrgAgent(organizationId: string, agentKey: string) {
  const { OrgAgentsService } = await import("../agents/org-agents.service");
  return OrgAgentsService.get(organizationId, agentKey);
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
): Promise<void> {
  await db
    .insert(organizationIntegrations)
    .values({
      organization_id: organizationId,
      integration_id: integrationId,
      enabled: input.enabled ?? false,
      config: input.config ?? {},
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        organizationIntegrations.organization_id,
        organizationIntegrations.integration_id,
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
    const { deleteSecretsForOrgCatalogIntegration } =
      await import("../integrations/secrets");
    await deleteSecretsForOrgCatalogIntegration({
      organizationId,
      integrationType: integrationId,
    });
    const { purgeKnowledgeForCatalogIntegration } =
      await import("../knowledge/service");
    await purgeKnowledgeForCatalogIntegration(organizationId, integrationId);
  }
}

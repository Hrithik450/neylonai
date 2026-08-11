import { count, desc, eq, sql } from "drizzle-orm";
import {
  db,
  schema,
  apiKeys,
  organizations,
  organizationAgents,
  organizationIntegrations,
  subscriptions,
} from "@neylonai/database";
import { PLAN_CATALOG, type PlanId, normalizePlanId } from "./plans";
import { getPlatformUsageSnapshot } from "./usage";

export async function getAdminPlatformMetrics() {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [orgCount] = await db.select({ n: count() }).from(organizations);
  const [userCount] = await db.select({ n: count() }).from(schema.users);
  const [threadCount] = await db.select({ n: count() }).from(schema.threads);
  const [keyCount] = await db
    .select({ n: count() })
    .from(apiKeys)
    .where(sql`${apiKeys.revoked_at} is null`);
  const [agentCount] = await db
    .select({ n: count() })
    .from(organizationAgents)
    .where(eq(organizationAgents.enabled, true));
  const [integrationCount] = await db
    .select({ n: count() })
    .from(organizationIntegrations)
    .where(eq(organizationIntegrations.enabled, true));

  const subs = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      n: count(),
    })
    .from(subscriptions)
    .groupBy(subscriptions.plan, subscriptions.status);

  let activeSubscriptions = 0;
  const planDistribution: Record<string, number> = {
    free: 0,
    starter: 0,
    pro: 0,
    business: 0,
  };
  let mrrCents = 0;

  for (const row of subs) {
    const n = Number(row.n);
    const plan = normalizePlanId(row.plan);
    planDistribution[plan] = (planDistribution[plan] ?? 0) + n;
    if (row.status === "active" || row.status === "trialing") {
      activeSubscriptions += n;
      if (plan !== "free") {
        mrrCents += Math.round(PLAN_CATALOG[plan as PlanId].priceUsdMonthly * 100) * n;
      }
    }
  }

  const usage = await getPlatformUsageSnapshot(since);

  return {
    organizations: Number(orgCount?.n ?? 0),
    users: Number(userCount?.n ?? 0),
    conversations: Number(threadCount?.n ?? 0),
    activeSubscriptions,
    planDistribution,
    mrrCents,
    arrCents: mrrCents * 12,
    activeApiKeys: Number(keyCount?.n ?? 0),
    activeAgents: Number(agentCount?.n ?? 0),
    activeIntegrations: Number(integrationCount?.n ?? 0),
    usage,
    providerCostUsd: usage.costMicros / 1_000_000,
  };
}

export async function listSubscriptionsAdmin(limit = 100) {
  return db
    .select({
      id: subscriptions.id,
      organizationId: subscriptions.organization_id,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      plan: subscriptions.plan,
      status: subscriptions.status,
      paymentProvider: subscriptions.payment_provider,
      periodEnd: subscriptions.current_period_end,
      updatedAt: subscriptions.updated_at,
    })
    .from(subscriptions)
    .innerJoin(
      organizations,
      eq(organizations.id, subscriptions.organization_id),
    )
    .orderBy(desc(subscriptions.updated_at))
    .limit(limit);
}

export async function listApiKeysAdmin(limit = 100) {
  return db
    .select({
      id: apiKeys.id,
      organizationId: apiKeys.organization_id,
      orgName: organizations.name,
      name: apiKeys.name,
      prefix: apiKeys.key_prefix,
      lastFour: apiKeys.last_four,
      revokedAt: apiKeys.revoked_at,
      lastUsedAt: apiKeys.last_used_at,
      createdAt: apiKeys.created_at,
    })
    .from(apiKeys)
    .innerJoin(organizations, eq(organizations.id, apiKeys.organization_id))
    .orderBy(desc(apiKeys.created_at))
    .limit(limit);
}

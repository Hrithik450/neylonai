import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db,
  schema,
  apiKeys,
  creditLedger,
  organizations,
  organizationAgents,
  organizationIntegrations,
  productUsageEvents,
  subscriptions,
  usageClassPeriodCounters,
  usageEvents,
  usageRequestReservations,
  usageRequestRollups,
} from "@neylonai/database";
import { listIntegrationManifests } from "@neylonai/integrations";
import {
  PLAN_CATALOG,
  getPlanEntitlements,
  type PlanId,
  normalizePlanId,
} from "./plans";
import { getPlatformUsageSnapshot } from "./usage";
import { AI_CREDIT_CLASSES, type AiCreditClass } from "./workload-policy";

/** Only current catalog installs count; removed integrations are not real state. */
const CATALOG_IDS = listIntegrationManifests().map((m) => m.id);

export type OrganizationUsageAdminRow = {
  id: string;
  slug: string;
  name: string;
  blockedAt: Date | null;
  plan: string | null;
  status: string | null;
  paymentProvider: string | null;
  createdAt: Date | null;
  /** Cached subscription credit balance. */
  creditsBalance: number;
  /** Credits granted for the current billing period. */
  creditsPeriodGranted: number;
  /** Granted − balance (period included usage). */
  creditsUsedPeriod: number;
  periodStart: Date | null;
  periodEnd: Date | null;
  /** Distinct chat requests with provider metering (usage_events), windowed. */
  providerRequests: number;
  /** Provider COGS USD in the window (from usage_events). */
  providerCostUsd: number;
  /** Finalized credit rollups in the window. */
  creditRequests: number;
  /** Credits charged via rollups in the window. */
  creditsCharged: number;
  /** Ledger consumption abs(sum) in the window (included). */
  ledgerIncludedCredits: number;
  /** Ledger on-demand abs(sum) in the window. */
  ledgerOnDemandCredits: number;
  conversationTurns: number;
  proactiveRefreshes: number;
  threads: number;
  lastActivityAt: string | null;
};

/** Per-workload-class platform activity for the constraints billing model. */
export type AdminWorkloadClassRow = {
  workloadClass: AiCreditClass;
  /** Delivered requests counted toward this class's hard period limit. */
  used: number;
  /** In-flight reservations this period (not yet charged). */
  reserved: number;
  /** Requests classified into this class in the window. */
  requests: number;
  /** Requests in the window that cost 0 credits (non-billable turns). */
  freeRequests: number;
  /** Credits charged in the window for this class. */
  creditsCharged: number;
  /** Provider COGS USD in the window for this class. */
  providerCostUsd: number;
};

/** Platform credit position: grants, balances, and window consumption. */
export type AdminCreditFlow = {
  /** Credits granted across all subscriptions for the current period. */
  granted: number;
  /** Cached balances across all subscriptions. */
  balance: number;
  /** Credits held by in-flight reservations. */
  reserved: number;
  /** granted − balance across all subscriptions. */
  usedPeriod: number;
  /** Ledger `ai_consumption` in the window (included credits). */
  includedCharged: number;
  /** Ledger `ai_on_demand` in the window (paid overage). */
  onDemandCharged: number;
  /** Reservations still open (should trend to ~0). */
  openReservations: number;
};

export async function getAdminPlatformMetrics() {
  const windowDays = 30;
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const [
    [orgCount],
    [userCount],
    [threadCount],
    [keyCount],
    [agentCount],
    [integrationCount],
    subs,
  ] = await Promise.all([
    db.select({ n: count() }).from(organizations),
    db.select({ n: count() }).from(schema.users),
    db.select({ n: count() }).from(schema.threads),
    db
      .select({ n: count() })
      .from(apiKeys)
      .where(sql`${apiKeys.revoked_at} is null`),
    // Joined to organizations so rows orphaned by deleted tenants never count.
    db
      .select({ n: count() })
      .from(organizationAgents)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationAgents.organization_id),
      )
      .where(eq(organizationAgents.enabled, true)),
    db
      .select({ n: count() })
      .from(organizationIntegrations)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationIntegrations.organization_id),
      )
      .where(
        and(
          eq(organizationIntegrations.enabled, true),
          inArray(organizationIntegrations.integration_id, CATALOG_IDS),
        ),
      ),
    db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        n: count(),
      })
      .from(subscriptions)
      .groupBy(subscriptions.plan, subscriptions.status),
  ]);

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

  const [
    counterRows,
    rollupRows,
    subscriptionCreditRows,
    ledgerRows,
    [openReservations],
  ] = await Promise.all([
      // Current-period class counters only: join on the period the grant applies to.
      db
        .select({
          workloadClass: usageClassPeriodCounters.workload_class,
          used: sql<number>`coalesce(sum(${usageClassPeriodCounters.used}), 0)::int`,
          reserved: sql<number>`coalesce(sum(${usageClassPeriodCounters.reserved}), 0)::int`,
        })
        .from(usageClassPeriodCounters)
        .innerJoin(
          subscriptions,
          and(
            eq(
              subscriptions.organization_id,
              usageClassPeriodCounters.organization_id,
            ),
            eq(
              usageClassPeriodCounters.period_start,
              subscriptions.current_period_start,
            ),
          ),
        )
        .groupBy(usageClassPeriodCounters.workload_class),
      db
        .select({
          workloadClass: usageRequestRollups.complexity_class,
          requests: sql<number>`count(*)::int`,
          freeRequests: sql<number>`count(*) filter (where ${usageRequestRollups.credits_charged} = 0)::int`,
          credits: sql<number>`coalesce(sum(${usageRequestRollups.credits_charged}), 0)::int`,
          costMicros: sql<number>`coalesce(sum(${usageRequestRollups.provider_cost_micros}), 0)::bigint`,
        })
        .from(usageRequestRollups)
        .where(gte(usageRequestRollups.created_at, since))
        .groupBy(usageRequestRollups.complexity_class),
      db
        .select({
          plan: subscriptions.plan,
          balance: subscriptions.ai_credits_balance,
        })
        .from(subscriptions),
      db
        .select({
          entryType: creditLedger.entry_type,
          credits: sql<number>`coalesce(sum(abs(${creditLedger.amount})), 0)::int`,
        })
        .from(creditLedger)
        .where(
          and(
            gte(creditLedger.created_at, since),
            sql`${creditLedger.entry_type} in ('ai_consumption', 'ai_on_demand')`,
          ),
        )
        .groupBy(creditLedger.entry_type),
      db
        .select({
          n: count(),
          credits: sql<number>`coalesce(sum(${usageRequestReservations.credits}), 0)::int`,
        })
        .from(usageRequestReservations)
        .innerJoin(
          subscriptions,
          and(
            eq(
              subscriptions.organization_id,
              usageRequestReservations.organization_id,
            ),
            eq(
              subscriptions.current_period_start,
              usageRequestReservations.period_start,
            ),
          ),
        )
        .where(eq(usageRequestReservations.status, "reserved")),
    ]);

  const counterByClass = new Map(
    counterRows.map((r) => [r.workloadClass, r] as const),
  );
  const rollupByClass = new Map(
    rollupRows.map((r) => [r.workloadClass, r] as const),
  );

  const workloadClasses: AdminWorkloadClassRow[] = AI_CREDIT_CLASSES.map(
    (workloadClass) => {
      const counter = counterByClass.get(workloadClass);
      const rollup = rollupByClass.get(workloadClass);
      return {
        workloadClass,
        used: Number(counter?.used ?? 0),
        reserved: Number(counter?.reserved ?? 0),
        requests: Number(rollup?.requests ?? 0),
        freeRequests: Number(rollup?.freeRequests ?? 0),
        creditsCharged: Number(rollup?.credits ?? 0),
        providerCostUsd: Number(rollup?.costMicros ?? 0) / 1_000_000,
      };
    },
  );

  const granted = subscriptionCreditRows.reduce(
    (total, row) =>
      total + getPlanEntitlements(normalizePlanId(row.plan)).aiCreditsPerMonth,
    0,
  );
  const balance = subscriptionCreditRows.reduce(
    (total, row) => total + Number(row.balance),
    0,
  );
  const credits: AdminCreditFlow = {
    granted,
    balance,
    reserved: Number(openReservations?.credits ?? 0),
    usedPeriod: Math.max(0, granted - balance),
    includedCharged: Number(
      ledgerRows.find((r) => r.entryType === "ai_consumption")?.credits ?? 0,
    ),
    onDemandCharged: Number(
      ledgerRows.find((r) => r.entryType === "ai_on_demand")?.credits ?? 0,
    ),
    openReservations: Number(openReservations?.n ?? 0),
  };

  const billableRequests = workloadClasses.reduce(
    (total, row) => total + (row.requests - row.freeRequests),
    0,
  );
  const freeRequests = workloadClasses.reduce(
    (total, row) => total + row.freeRequests,
    0,
  );

  return {
    windowDays,
    since: since.toISOString(),
    organizations: Number(orgCount?.n ?? 0),
    users: Number(userCount?.n ?? 0),
    threads: Number(threadCount?.n ?? 0),
    activeSubscriptions,
    planDistribution,
    mrrCents,
    arrCents: mrrCents * 12,
    activeApiKeys: Number(keyCount?.n ?? 0),
    activeAgents: Number(agentCount?.n ?? 0),
    activeIntegrations: Number(integrationCount?.n ?? 0),
    usage,
    providerCostUsd: usage.costMicros / 1_000_000,
    workloadClasses,
    billableRequests,
    freeRequests,
    credits,
  };
}

export async function listSubscriptionsAdmin(limit = 100) {
  const rows = await db
    .select({
      id: subscriptions.id,
      organizationId: subscriptions.organization_id,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      plan: subscriptions.plan,
      status: subscriptions.status,
      paymentProvider: subscriptions.payment_provider,
      periodEnd: subscriptions.current_period_end,
      creditsBalance: subscriptions.ai_credits_balance,
      updatedAt: subscriptions.updated_at,
    })
    .from(subscriptions)
    .innerJoin(
      organizations,
      eq(organizations.id, subscriptions.organization_id),
    )
    .orderBy(desc(subscriptions.updated_at))
    .limit(limit);
  return rows.map((row) => ({
    ...row,
    creditsPeriodGranted: getPlanEntitlements(
      normalizePlanId(row.plan),
    ).aiCreditsPerMonth,
  }));
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

/**
 * Per-customer usage for admin ops — every org, with credits + COGS + product
 * counters so nothing is hidden behind platform-only aggregates.
 */
export async function listOrganizationsUsageAdmin(
  days = 30,
  limit = 200,
): Promise<{ days: number; since: string; rows: OrganizationUsageAdminRow[] }> {
  const since = new Date();
  since.setDate(since.getDate() - Math.max(1, Math.min(days, 365)));

  const orgs = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      blockedAt: organizations.blocked_at,
      plan: subscriptions.plan,
      status: subscriptions.status,
      paymentProvider: subscriptions.payment_provider,
      createdAt: organizations.created_at,
      creditsBalance: subscriptions.ai_credits_balance,
      periodStart: subscriptions.current_period_start,
      periodEnd: subscriptions.current_period_end,
    })
    .from(organizations)
    .leftJoin(
      subscriptions,
      eq(subscriptions.organization_id, organizations.id),
    )
    .orderBy(desc(organizations.created_at))
    .limit(limit);

  if (orgs.length === 0) {
    return { days, since: since.toISOString(), rows: [] };
  }

  const orgIds = orgs.map((o) => o.id);

  const [providerRows, rollupRows, ledgerRows, productRows, threadRows] =
    await Promise.all([
      db
        .select({
          organizationId: usageEvents.organization_id,
          requests: sql<number>`count(distinct ${usageEvents.request_id})::int`,
          costMicros: sql<number>`coalesce(sum(${usageEvents.provider_cost_micros}), 0)::bigint`,
          lastAt: sql<Date | null>`max(${usageEvents.created_at})`,
        })
        .from(usageEvents)
        .where(
          and(
            inArray(usageEvents.organization_id, orgIds),
            gte(usageEvents.created_at, since),
          ),
        )
        .groupBy(usageEvents.organization_id),
      db
        .select({
          organizationId: usageRequestRollups.organization_id,
          requests: sql<number>`count(*)::int`,
          credits: sql<number>`coalesce(sum(${usageRequestRollups.credits_charged}), 0)::int`,
          lastAt: sql<Date | null>`max(${usageRequestRollups.created_at})`,
        })
        .from(usageRequestRollups)
        .where(
          and(
            inArray(usageRequestRollups.organization_id, orgIds),
            gte(usageRequestRollups.created_at, since),
          ),
        )
        .groupBy(usageRequestRollups.organization_id),
      db
        .select({
          organizationId: creditLedger.organization_id,
          entryType: creditLedger.entry_type,
          credits: sql<number>`coalesce(sum(abs(${creditLedger.amount})), 0)::int`,
        })
        .from(creditLedger)
        .where(
          and(
            inArray(creditLedger.organization_id, orgIds),
            gte(creditLedger.created_at, since),
            sql`${creditLedger.entry_type} in ('ai_consumption', 'ai_on_demand')`,
          ),
        )
        .groupBy(creditLedger.organization_id, creditLedger.entry_type),
      db
        .select({
          organizationId: productUsageEvents.organization_id,
          metric: productUsageEvents.metric,
          n: sql<number>`count(*)::int`,
          lastAt: sql<Date | null>`max(${productUsageEvents.created_at})`,
        })
        .from(productUsageEvents)
        .where(
          and(
            inArray(productUsageEvents.organization_id, orgIds),
            gte(productUsageEvents.created_at, since),
          ),
        )
        .groupBy(productUsageEvents.organization_id, productUsageEvents.metric),
      db
        .select({
          organizationId: schema.threads.organization_id,
          n: sql<number>`count(*)::int`,
          lastAt: sql<Date | null>`max(${schema.threads.created_at})`,
        })
        .from(schema.threads)
        .where(inArray(schema.threads.organization_id, orgIds))
        .groupBy(schema.threads.organization_id),
    ]);

  const providerByOrg = new Map(
    providerRows.map((r) => [r.organizationId, r] as const),
  );
  const rollupByOrg = new Map(
    rollupRows.map((r) => [r.organizationId, r] as const),
  );
  const ledgerByOrg = new Map<
    string,
    { included: number; onDemand: number }
  >();
  for (const row of ledgerRows) {
    const cur = ledgerByOrg.get(row.organizationId) ?? {
      included: 0,
      onDemand: 0,
    };
    if (row.entryType === "ai_on_demand") cur.onDemand = Number(row.credits);
    else cur.included = Number(row.credits);
    ledgerByOrg.set(row.organizationId, cur);
  }
  const productByOrg = new Map<
    string,
    { turns: number; proactive: number; lastAt: Date | null }
  >();
  for (const row of productRows) {
    const cur = productByOrg.get(row.organizationId) ?? {
      turns: 0,
      proactive: 0,
      lastAt: null,
    };
    if (row.metric === "conversation_turn") cur.turns = Number(row.n);
    else if (row.metric === "proactive_refresh") cur.proactive = Number(row.n);
    if (row.lastAt && (!cur.lastAt || row.lastAt > cur.lastAt)) {
      cur.lastAt = row.lastAt;
    }
    productByOrg.set(row.organizationId, cur);
  }
  const threadsByOrg = new Map(
    threadRows.map((r) => [r.organizationId, r] as const),
  );

  const rows: OrganizationUsageAdminRow[] = orgs.map((o) => {
    const granted =
      o.plan == null
        ? 0
        : getPlanEntitlements(normalizePlanId(o.plan)).aiCreditsPerMonth;
    const balance = Number(o.creditsBalance ?? 0);
    const provider = providerByOrg.get(o.id);
    const rollup = rollupByOrg.get(o.id);
    const ledger = ledgerByOrg.get(o.id);
    const product = productByOrg.get(o.id);
    const threads = threadsByOrg.get(o.id);

    const toTime = (value: unknown): number | null => {
      if (value instanceof Date) return value.getTime();
      if (typeof value === "string" || typeof value === "number") {
        const t = new Date(value).getTime();
        return Number.isFinite(t) ? t : null;
      }
      return null;
    };

    const activityTimes = [
      toTime(provider?.lastAt),
      toTime(rollup?.lastAt),
      toTime(product?.lastAt),
      toTime(threads?.lastAt),
    ].filter((t): t is number => t != null);
    const lastActivityAt =
      activityTimes.length > 0
        ? new Date(Math.max(...activityTimes)).toISOString()
        : null;

    return {
      id: o.id,
      slug: o.slug,
      name: o.name,
      blockedAt: o.blockedAt,
      plan: o.plan,
      status: o.status,
      paymentProvider: o.paymentProvider,
      createdAt: o.createdAt,
      creditsBalance: balance,
      creditsPeriodGranted: granted,
      creditsUsedPeriod: Math.max(0, granted - balance),
      periodStart: o.periodStart,
      periodEnd: o.periodEnd,
      providerRequests: Number(provider?.requests ?? 0),
      providerCostUsd: Number(provider?.costMicros ?? 0) / 1_000_000,
      creditRequests: Number(rollup?.requests ?? 0),
      creditsCharged: Number(rollup?.credits ?? 0),
      ledgerIncludedCredits: ledger?.included ?? 0,
      ledgerOnDemandCredits: ledger?.onDemand ?? 0,
      conversationTurns: product?.turns ?? 0,
      proactiveRefreshes: product?.proactive ?? 0,
      threads: Number(threads?.n ?? 0),
      lastActivityAt,
    };
  });

  rows.sort((a, b) => {
    const aT = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
    const bT = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
    return bT - aT;
  });

  return { days, since: since.toISOString(), rows };
}

/** Privacy-safe per-turn operational metrics; never includes message content. */
export async function listConversationUsageMetricsAdmin(input?: {
  page?: number;
  pageSize?: number;
}) {
  const pageSize = Math.min(100, Math.max(1, input?.pageSize ?? 50));
  const page = Math.max(1, input?.page ?? 1);
  const offset = (page - 1) * pageSize;

  const [rows, totals, countRows] = await Promise.all([
    db
      .select({
        id: usageRequestRollups.id,
        organizationId: usageRequestRollups.organization_id,
        organizationName: organizations.name,
        organizationSlug: organizations.slug,
        workload: usageRequestRollups.complexity_class,
        /** Legacy response fields; detailed RAG/DB counts are no longer persisted. */
        ragTokens: sql<number>`0`,
        databaseRows: sql<number>`0`,
        semanticSearchCount: usageRequestRollups.semantic_search_count,
        agentRounds: usageRequestRollups.agent_rounds,
        toolsUsed: usageRequestRollups.tools_used,
        inputTokens: usageRequestRollups.input_tokens,
        outputTokens: usageRequestRollups.output_tokens,
        toolCalls: usageRequestRollups.tool_calls,
        createdAt: usageRequestRollups.created_at,
      })
      .from(usageRequestRollups)
      .leftJoin(
        organizations,
        eq(organizations.id, usageRequestRollups.organization_id),
      )
      .orderBy(desc(usageRequestRollups.created_at))
      .limit(pageSize)
      .offset(offset),
    db
      .select({
        avgRag: sql<number>`0`,
        avgSemanticSearches: sql<number>`coalesce(avg(${usageRequestRollups.semantic_search_count}), 0)`,
        avgAgentRounds: sql<number>`coalesce(avg(${usageRequestRollups.agent_rounds}), 0)`,
        avgInput: sql<number>`coalesce(avg(${usageRequestRollups.input_tokens}), 0)`,
        avgOutput: sql<number>`coalesce(avg(${usageRequestRollups.output_tokens}), 0)`,
        avgTools: sql<number>`coalesce(avg(${usageRequestRollups.tool_calls}), 0)`,
        turns: sql<number>`count(*)::int`,
        workload: usageRequestRollups.complexity_class,
      })
      .from(usageRequestRollups)
      .groupBy(usageRequestRollups.complexity_class),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(usageRequestRollups),
  ]);

  return {
    rows,
    page,
    pageSize,
    total: Number(countRows[0]?.total ?? 0),
    byWorkload: Object.fromEntries(
      AI_CREDIT_CLASSES.map((workload) => {
        const row = totals.find((item) => item.workload === workload);
        return [
          workload,
          {
            turns: Number(row?.turns ?? 0),
            avgRag: Number(row?.avgRag ?? 0),
            avgSemanticSearches: Number(row?.avgSemanticSearches ?? 0),
            avgAgentRounds: Number(row?.avgAgentRounds ?? 0),
            avgInput: Number(row?.avgInput ?? 0),
            avgOutput: Number(row?.avgOutput ?? 0),
            avgTools: Number(row?.avgTools ?? 0),
          },
        ];
      }),
    ) as Record<
      AiCreditClass,
      {
        turns: number;
        avgRag: number;
        avgSemanticSearches: number;
        avgAgentRounds: number;
        avgInput: number;
        avgOutput: number;
        avgTools: number;
      }
    >,
  };
}

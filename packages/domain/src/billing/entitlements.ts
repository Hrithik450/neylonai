import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import {
  db,
  apiKeys,
  organizations,
  organizationAccounts,
  subscriptions,
  websiteCrawlJobs,
  widgetConfigs,
  redis,
} from "@neylonai/database";
import {
  ApiAuthError,
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
  isSubscriptionEligible,
  type SubscriptionStatus,
} from "./keys";
import { getPlanEntitlements } from "./plans";

export interface ApiKeyAuthContext {
  organizationId: string;
  organizationSlug: string;
  apiKeyId: string;
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  plan: string;
  periodStart: Date | null;
  allowedOrigins: string[];
}

export interface AuthenticateApiKeyInput {
  rawKey: string | null | undefined;
  /** Optional identifier for rate-limit bucketing (IP). */
  clientIp?: string | null;
  /** Request Origin / Referer host for domain restriction. */
  origin?: string | null;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "org"
  );
}

async function checkRateLimit(apiKeyId: string, perMinute: number): Promise<void> {
  const bucket = `neylonai:rl:apikey:${apiKeyId}:${Math.floor(Date.now() / 60_000)}`;
  try {
    const n = await redis.incr(bucket);
    if (n === 1) await redis.expire(bucket, 120);
    if (n > perMinute) {
      throw new ApiAuthError(
        "rate_limited",
        "API rate limit exceeded. Try again shortly.",
        429,
      );
    }
  } catch (error) {
    if (error instanceof ApiAuthError) throw error;
    console.warn("[billing] rate limit skipped:", error);
  }
}

/**
 * Validate client API key + active subscription.
 * Reusable across orchestration and public chatbot routes.
 */
export async function authenticateApiKey(
  input: AuthenticateApiKeyInput,
): Promise<ApiKeyAuthContext> {
  const raw = input.rawKey?.trim();
  if (!raw) {
    throw new ApiAuthError(
      "missing_api_key",
      "Missing API key. Pass Authorization: Bearer <key> or X-Neylonai-Api-Key.",
      401,
    );
  }

  const prefix = apiKeyPrefix(raw);
  const [row] = await db
    .select({
      id: apiKeys.id,
      organizationId: apiKeys.organization_id,
      keyHash: apiKeys.key_hash,
      revokedAt: apiKeys.revoked_at,
      orgSlug: organizations.slug,
      orgBlockedAt: organizations.blocked_at,
      subscriptionId: subscriptions.id,
      subscriptionStatus: subscriptions.status,
      plan: subscriptions.plan,
      periodStart: subscriptions.current_period_start,
      periodEnd: subscriptions.current_period_end,
    })
    .from(apiKeys)
    .innerJoin(organizations, eq(organizations.id, apiKeys.organization_id))
    .leftJoin(
      subscriptions,
      eq(subscriptions.organization_id, apiKeys.organization_id),
    )
    .where(and(eq(apiKeys.key_prefix, prefix), isNull(apiKeys.revoked_at)))
    .limit(1);

  if (!row || row.keyHash !== hashApiKey(raw)) {
    throw new ApiAuthError("invalid_api_key", "Invalid API key.", 401);
  }

  if (row.revokedAt) {
    throw new ApiAuthError("revoked_api_key", "API key has been revoked.", 401);
  }

  if (row.orgBlockedAt) {
    throw new ApiAuthError(
      "organization_blocked",
      "This organization has been blocked.",
      403,
    );
  }

  const status = (row.subscriptionStatus ?? "inactive") as SubscriptionStatus;
  if (!isSubscriptionEligible(status)) {
    throw new ApiAuthError(
      "subscription_inactive",
      "Subscription is not active. Chatbot usage is disabled for this organization.",
      402,
    );
  }

  if (row.periodEnd && new Date(row.periodEnd).getTime() < Date.now()) {
    if (status === "trialing" || status === "active") {
      throw new ApiAuthError(
        "subscription_inactive",
        "Subscription period has ended.",
        402,
      );
    }
  }

  if (!row.subscriptionId) {
    throw new ApiAuthError(
      "subscription_inactive",
      "No subscription found for this organization.",
      402,
    );
  }

  const entitlements = getPlanEntitlements(row.plan);
  await checkRateLimit(row.id, entitlements.apiRequestsPerMinute);

  void db
    .update(apiKeys)
    .set({ last_used_at: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch((error) => {
      console.warn("[authenticateApiKey] last_used_at update failed:", error);
    });

  return {
    organizationId: row.organizationId,
    organizationSlug: row.orgSlug,
    apiKeyId: row.id,
    subscriptionId: row.subscriptionId,
    subscriptionStatus: status,
    plan: row.plan ?? "free",
    periodStart: row.periodStart ?? null,
    allowedOrigins: [],
  };
}

export async function listApiKeysForOrg(organizationId: string) {
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.key_prefix,
      lastFour: apiKeys.last_four,
      revokedAt: apiKeys.revoked_at,
      lastUsedAt: apiKeys.last_used_at,
      createdAt: apiKeys.created_at,
    })
    .from(apiKeys)
    .where(eq(apiKeys.organization_id, organizationId));
  return rows.map((row) => ({ ...row, allowedOrigins: [] as string[] }));
}

export async function createApiKeyForOrg(
  organizationId: string,
  name = "Default",
  _allowedOrigins: string[] = [],
): Promise<{ rawKey: string; id: string; prefix: string; lastFour: string }> {
  const generated = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({
      organization_id: organizationId,
      name,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
      last_four: generated.lastFour,
    })
    .returning({ id: apiKeys.id });

  if (!row) {
    throw new Error("Failed to create API key");
  }

  return {
    rawKey: generated.rawKey,
    id: row.id,
    prefix: generated.prefix,
    lastFour: generated.lastFour,
  };
}

export async function updateApiKeyOrigins(
  organizationId: string,
  apiKeyId: string,
  _allowedOrigins: string[],
): Promise<boolean> {
  const result = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.id, apiKeyId),
        eq(apiKeys.organization_id, organizationId),
        isNull(apiKeys.revoked_at),
      ),
    );
  return result.length > 0;
}

export async function revokeApiKey(
  organizationId: string,
  apiKeyId: string,
): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({ revoked_at: new Date() })
    .where(
      and(
        eq(apiKeys.id, apiKeyId),
        eq(apiKeys.organization_id, organizationId),
        isNull(apiKeys.revoked_at),
      ),
    )
    .returning({ id: apiKeys.id });
  return result.length > 0;
}

/** Revoke all active keys and mint a new one (returns plaintext once). */
export async function regenerateApiKey(
  organizationId: string,
  name = "Default",
  allowedOrigins: string[] = [],
): Promise<{ rawKey: string; id: string; prefix: string; lastFour: string }> {
  await db
    .update(apiKeys)
    .set({ revoked_at: new Date() })
    .where(
      and(
        eq(apiKeys.organization_id, organizationId),
        isNull(apiKeys.revoked_at),
      ),
    );
  return createApiKeyForOrg(organizationId, name, allowedOrigins);
}

export async function getSubscriptionForOrg(organizationId: string) {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, organizationId))
    .limit(1);
  return row ?? null;
}

/**
 * Ensure the signed-in user has a solo-founder workspace:
 * one organization (named after them), free subscription, default agents, API key.
 * Idempotent — concurrent first logins resolve via unique user_id membership.
 */
export async function ensureOrganizationWorkspace(input: {
  userId: string;
  email: string;
  name: string;
}): Promise<{
  organizationId: string;
  organizationSlug: string;
}> {
  const resolveExisting = async () => {
    const [membership] = await db
      .select({
        organizationId: organizationAccounts.organization_id,
        slug: organizations.slug,
      })
      .from(organizationAccounts)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationAccounts.organization_id),
      )
      .where(eq(organizationAccounts.user_id, input.userId))
      .limit(1);
    return membership ?? null;
  };

  const withActiveKey = async (membership: {
    organizationId: string;
    slug: string;
  }) => {
    const keys = await listApiKeysForOrg(membership.organizationId);
    if (!keys.some((k) => !k.revokedAt)) {
      await createApiKeyForOrg(membership.organizationId);
    }
    return {
      organizationId: membership.organizationId,
      organizationSlug: membership.slug,
    };
  };

  const existing = await resolveExisting();
  if (existing) return withActiveKey(existing);

  const displayName =
    input.name.trim() || input.email.split("@")[0] || "Workspace";
  const baseSlug = slugify(displayName);
  let slug = baseSlug;
  for (let i = 0; i < 5; i++) {
    const [clash] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!clash) break;
    slug = `${baseSlug}-${randomSuffix()}`;
  }

  try {
    const [org] = await db
      .insert(organizations)
      .values({
        slug,
        name: displayName,
      })
      .returning();

    await db.insert(organizationAccounts).values({
      organization_id: org!.id,
      user_id: input.userId,
    });

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await db.insert(subscriptions).values({
      organization_id: org!.id,
      status: "active",
      plan: "free",
      monthly_request_limit: null,
      current_period_start: new Date(),
      current_period_end: periodEnd,
    });

    await db.insert(widgetConfigs).values({
      organization_id: org!.id,
      config: {},
    });

    const { OrgAgentsService } = await import("../agents/org-agents.service");
    await OrgAgentsService.ensureMainAgent(org!.id);

    await createApiKeyForOrg(org!.id);

    const { grantPlanCredits } = await import("./credits");
    await grantPlanCredits({
      organizationId: org!.id,
      plan: "free",
      reason: "Initial free plan grant",
      force: true,
    });

    return {
      organizationId: org!.id,
      organizationSlug: org!.slug,
    };
  } catch (error) {
    // Unique user_id membership: another concurrent login created the workspace.
    const raced = await resolveExisting();
    if (raced) return withActiveKey(raced);
    throw error;
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

export async function getOrganizationForUser(userId: string) {
  const [row] = await db
    .select({
      organizationId: organizationAccounts.organization_id,
      slug: organizations.slug,
      name: organizations.name,
    })
    .from(organizationAccounts)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationAccounts.organization_id),
    )
    .where(
      and(
        eq(organizationAccounts.user_id, userId),
        isNull(organizations.blocked_at),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listOrganizationsAdmin(limit = 100) {
  return db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      blockedAt: organizations.blocked_at,
      plan: subscriptions.plan,
      status: subscriptions.status,
      paymentProvider: subscriptions.payment_provider,
      createdAt: organizations.created_at,
    })
    .from(organizations)
    .leftJoin(
      subscriptions,
      eq(subscriptions.organization_id, organizations.id),
    )
    .orderBy(desc(organizations.created_at))
    .limit(limit);
}

export async function setOrganizationBlockedAdmin(
  organizationId: string,
  blocked: boolean,
): Promise<boolean> {
  const result = await db
    .update(organizations)
    .set({
      blocked_at: blocked ? new Date() : null,
      updated_at: new Date(),
    })
    .where(eq(organizations.id, organizationId))
    .returning({ id: organizations.id });
  if (blocked && result.length > 0) {
    await db
      .update(websiteCrawlJobs)
      .set({ status: "cancelling", updated_at: new Date() })
      .where(
        and(
          eq(websiteCrawlJobs.organization_id, organizationId),
          inArray(websiteCrawlJobs.status, [
            "queued",
            "discovering",
            "crawling",
          ]),
        ),
      );
  }
  return result.length > 0;
}

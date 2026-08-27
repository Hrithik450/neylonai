import { and, eq, isNull, desc, inArray } from "drizzle-orm";
import { getDomain } from "tldts";
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

/**
 * Reduce an Origin/Referer/host string to a bare lowercase hostname.
 * Accepts "https://app.example.com/path", "example.com:3000", "example.com".
 */
function toHostname(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withScheme).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

/** Loopback / local-dev hosts, always allowed so the operator can verify the
 * snippet on their own machine even after a real domain is set. Covers
 * "localhost" + any "*.localhost", IPv4 loopback, and IPv6 "::1" (bracketed or
 * not, as URL parsing may yield either). */
function isLocalhost(host: string): boolean {
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

/**
 * Per-key domain allowlist check. This is the real enforcement point for the
 * `allowed_domains` the org configures in the dashboard — the widget's CORS
 * headers stay wildcard (edge middleware can't read the DB), so authorization
 * happens here instead.
 *
 * Rules, tuned to be forgiving for non-technical operators:
 * - Localhost is always allowed, even against a non-empty allowlist, so local
 *   verification never 403s.
 * - Empty allowlist → unrestricted (matches the column's documented default;
 *   this is the "lenient until the website is connected" state).
 * - No request Origin/Referer → allowed. Browsers always send Origin on
 *   cross-origin requests; its absence means a same-origin or non-browser
 *   caller, which the allowlist isn't meant to police.
 * - A listed host matches itself and any subdomain, so entering "example.com"
 *   also covers "www.example.com" / "app.example.com".
 */
function isOriginAllowed(
  origin: string | null | undefined,
  allowed: string[],
): boolean {
  const host = origin ? toHostname(origin) : null;
  if (host && isLocalhost(host)) return true;
  if (!allowed || allowed.length === 0) return true;
  if (!host) return true;
  return allowed.some((entry) => {
    const allowedHost = toHostname(entry);
    if (!allowedHost) return false;
    return host === allowedHost || host.endsWith(`.${allowedHost}`);
  });
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
      allowedDomains: apiKeys.allowed_domains,
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

  const allowedOrigins = row.allowedDomains ?? [];
  if (!isOriginAllowed(input.origin, allowedOrigins)) {
    throw new ApiAuthError(
      "origin_not_allowed",
      "This website is not the connected domain for this API key. Connect it under Integrations → Website.",
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
    allowedOrigins,
  };
}

export async function listApiKeysForOrg(organizationId: string) {
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.key_prefix,
      lastFour: apiKeys.last_four,
      publicKey: apiKeys.public_key,
      allowedDomains: apiKeys.allowed_domains,
      revokedAt: apiKeys.revoked_at,
      lastUsedAt: apiKeys.last_used_at,
      createdAt: apiKeys.created_at,
    })
    .from(apiKeys)
    .where(eq(apiKeys.organization_id, organizationId));
  return rows.map(({ allowedDomains, ...row }) => ({
    ...row,
    allowedOrigins: (allowedDomains ?? []) as string[],
  }));
}

export async function createApiKeyForOrg(
  organizationId: string,
  name = "Default",
  allowedOrigins: string[] = [],
): Promise<{ rawKey: string; id: string; prefix: string; lastFour: string }> {
  const generated = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({
      organization_id: organizationId,
      name,
      key_prefix: generated.prefix,
      key_hash: generated.hash,
      public_key: generated.rawKey,
      last_four: generated.lastFour,
      allowed_domains: allowedOrigins,
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
  allowedOrigins: string[],
): Promise<boolean> {
  const result = await db
    .update(apiKeys)
    .set({ allowed_domains: allowedOrigins })
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

/**
 * The org's active (non-revoked) publishable key in plaintext, for rendering
 * the copy-paste install snippet. Returns null when the org has no key yet
 * (lazy — user hasn't copied) or when the key predates the `public_key` column
 * (must be rotated to become copyable). Picks the most recently created active
 * key if somehow more than one exists.
 */
export async function getPublishableKeyForOrg(
  organizationId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ publicKey: apiKeys.public_key })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.organization_id, organizationId),
        isNull(apiKeys.revoked_at),
      ),
    )
    .orderBy(desc(apiKeys.created_at))
    .limit(1);
  return row?.publicKey ?? null;
}

/**
 * Reduce any URL/host to its registrable apex domain (eTLD+1), the single value
 * we store in `allowed_domains`. `www.acme.com` → `acme.com`,
 * `blog.acme.co.uk` → `acme.co.uk` (public-suffix aware, so multi-label TLDs
 * don't over-match). Falls back to a www-stripped hostname when tldts can't
 * classify the input (e.g. an intranet host with no known suffix). Returns null
 * for unparseable input.
 */
export function registrableDomainFromUrl(url: string): string | null {
  const host = toHostname(url);
  if (!host) return null;
  const apex = getDomain(host);
  if (apex) return apex.toLowerCase();
  return host.startsWith("www.") ? host.slice(4) : host;
}

/**
 * Bind the org's single connected website to its active key: derive the apex
 * from `url` and overwrite the key's `allowed_domains` with `[apex]`. No-op
 * (returns false) when the org has no active key yet — in that case the domain
 * is applied later at mint time from the stored `config.url`. Best-effort:
 * callers wrap this so a domain-write hiccup never blocks a crawl.
 */
export async function setOrgKeyAllowedDomainFromUrl(
  organizationId: string,
  url: string,
): Promise<boolean> {
  const apex = registrableDomainFromUrl(url);
  if (!apex) return false;
  const [active] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.organization_id, organizationId),
        isNull(apiKeys.revoked_at),
      ),
    )
    .orderBy(desc(apiKeys.created_at))
    .limit(1);
  if (!active) return false;
  return updateApiKeyOrigins(organizationId, active.id, [apex]);
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
 * one organization (named after them), free subscription, and default agents.
 * No API key is minted here — keys are created lazily when the user first
 * copies the install snippet (via `createApiKeyForOrg` / the `/api-keys/ensure`
 * route), so a fresh org intentionally has zero keys.
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

  const existing = await resolveExisting();
  if (existing) {
    return {
      organizationId: existing.organizationId,
      organizationSlug: existing.slug,
    };
  }

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
    if (raced) {
      return {
        organizationId: raced.organizationId,
        organizationSlug: raced.slug,
      };
    }
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

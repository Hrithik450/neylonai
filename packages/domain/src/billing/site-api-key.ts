import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  redis,
  organizations,
  subscriptions,
  apiKeys,
} from "@neylonai/database";
import { apiKeyPrefix, hashApiKey } from "./keys";
import { createApiKeyForOrg } from "./entitlements";

/** Named client key used by ops when env key is unset (scripts / recovery). */
export const SITE_WIDGET_API_KEY_NAME = "First-party site";

const cacheKey = (organizationId: string) =>
  `neylonai:site_widget_key:${organizationId}`;

const memoryKeys = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

/**
 * Ops helper: return the env publishable key when set, otherwise mint/cache a
 * key for the knowledge-slug org. The marketing site does **not** use this —
 * it reads `NEXT_PUBLIC_NEYLONAI_API_KEY` like any client embed.
 */
export async function resolveSiteWidgetApiKey(): Promise<{
  apiKey: string;
  organizationId: string;
} | null> {
  const fromEnv =
    process.env.NEYLONAI_SITE_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_NEYLONAI_API_KEY?.trim();
  if (fromEnv) {
    const organizationId =
      (await organizationIdForRawKey(fromEnv)) ?? "env";
    return { apiKey: fromEnv, organizationId };
  }

  const organizationId = await resolveFallbackOrganizationId();
  if (!organizationId) return null;

  await ensureActiveSubscription(organizationId);

  const memorized = memoryKeys.get(organizationId);
  if (memorized && (await isActiveClientKey(memorized, organizationId))) {
    return { apiKey: memorized, organizationId };
  }

  const cached = await readCachedKey(organizationId);
  if (cached) {
    memoryKeys.set(organizationId, cached);
    return { apiKey: cached, organizationId };
  }

  let pending = inflight.get(organizationId);
  if (!pending) {
    pending = (async () => {
      const created = await createApiKeyForOrg(
        organizationId,
        SITE_WIDGET_API_KEY_NAME,
        [],
      );
      memoryKeys.set(organizationId, created.rawKey);
      await writeCachedKey(organizationId, created.rawKey);
      return created.rawKey;
    })().finally(() => {
      inflight.delete(organizationId);
    });
    inflight.set(organizationId, pending);
  }

  const apiKey = await pending;
  return { apiKey, organizationId };
}

async function organizationIdForRawKey(rawKey: string): Promise<string | null> {
  const prefix = apiKeyPrefix(rawKey);
  const [row] = await db
    .select({ organizationId: apiKeys.organization_id, keyHash: apiKeys.key_hash })
    .from(apiKeys)
    .where(and(eq(apiKeys.key_prefix, prefix), isNull(apiKeys.revoked_at)))
    .limit(1);
  if (!row || row.keyHash !== hashApiKey(rawKey)) return null;
  return row.organizationId;
}

async function resolveFallbackOrganizationId(): Promise<string | null> {
  const slug =
    process.env.KNOWLEDGE_ORGANIZATION_SLUG?.trim() || "neylonai";
  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (org) return org.id;
  // Common local seed slug
  const [neylon] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, "neylon"))
    .limit(1);
  return neylon?.id ?? null;
}

async function ensureActiveSubscription(organizationId: string): Promise<void> {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, organizationId))
    .limit(1);

  if (!sub) {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    await db.insert(subscriptions).values({
      organization_id: organizationId,
      status: "active",
      plan: "business",
      monthly_request_limit: null,
      current_period_start: new Date(),
      current_period_end: end,
    });
    return;
  }

  if (sub.status !== "active" && sub.status !== "trialing") {
    await db
      .update(subscriptions)
      .set({ status: "active", updated_at: new Date() })
      .where(eq(subscriptions.id, sub.id));
  }
}

async function readCachedKey(organizationId: string): Promise<string | null> {
  try {
    const raw = await redis.get(cacheKey(organizationId));
    if (!raw) return null;
    if (await isActiveClientKey(raw, organizationId)) return raw;
    await redis.del(cacheKey(organizationId));
    return null;
  } catch (error) {
    console.warn("[site-api-key] cache read failed:", error);
    return null;
  }
}

async function writeCachedKey(
  organizationId: string,
  rawKey: string,
): Promise<void> {
  try {
    await redis.set(cacheKey(organizationId), rawKey);
  } catch (error) {
    console.warn("[site-api-key] cache write failed:", error);
  }
}

async function isActiveClientKey(
  rawKey: string,
  organizationId: string,
): Promise<boolean> {
  const prefix = apiKeyPrefix(rawKey);
  const [row] = await db
    .select({
      keyHash: apiKeys.key_hash,
      organizationId: apiKeys.organization_id,
    })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.key_prefix, prefix),
        eq(apiKeys.organization_id, organizationId),
        isNull(apiKeys.revoked_at),
      ),
    )
    .limit(1);
  return Boolean(row && row.keyHash === hashApiKey(rawKey));
}

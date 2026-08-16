import { createHash, randomBytes } from "crypto";

/** Eligible for chatbot API usage (server-side only). */
export const ELIGIBLE_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
] as const;

export type EligibleSubscriptionStatus =
  (typeof ELIGIBLE_SUBSCRIPTION_STATUSES)[number];

export type SubscriptionStatus =
  | EligibleSubscriptionStatus
  | "past_due"
  | "cancelled"
  | "expired"
  | "suspended"
  | "inactive";

export function normalizeSubscriptionStatus(status: string): SubscriptionStatus {
  const s = status.toLowerCase();
  if (s === "canceled") return "cancelled";
  return s as SubscriptionStatus;
}

export function isSubscriptionEligible(status: string): boolean {
  const normalized = normalizeSubscriptionStatus(status);
  return (ELIGIBLE_SUBSCRIPTION_STATUSES as readonly string[]).includes(
    normalized,
  );
}

/** Fallback when plan catalog unavailable during key auth bootstrap. */
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

export const DEFAULT_MONTHLY_REQUEST_LIMIT = 10_000;

const KEY_PREFIX_LEN = 12;

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey, "utf8").digest("hex");
}

export function apiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, KEY_PREFIX_LEN);
}

/**
 * Generate a client/public API key for embeddable widgets.
 * Format: nk_live_<url-safe random>
 */
export function generateApiKey(): {
  rawKey: string;
  prefix: string;
  hash: string;
  lastFour: string;
} {
  const random = randomBytes(24).toString("base64url");
  const rawKey = `nk_live_${random}`;
  return {
    rawKey,
    prefix: apiKeyPrefix(rawKey),
    hash: hashApiKey(rawKey),
    lastFour: rawKey.slice(-4),
  };
}

export function extractApiKeyFromHeaders(
  headers: Headers | Record<string, string | null | undefined>,
): string | null {
  const get = (name: string) => {
    if (headers instanceof Headers) return headers.get(name);
    const lower = name.toLowerCase();
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === lower) return v ?? null;
    }
    return null;
  };

  const bearer = get("authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    const token = bearer.slice(7).trim();
    if (token) return token;
  }

  const headerKey = get("x-neylonai-api-key");
  if (headerKey?.trim()) return headerKey.trim();

  return null;
}

export type ApiAuthFailureCode =
  | "missing_api_key"
  | "invalid_api_key"
  | "revoked_api_key"
  | "organization_blocked"
  | "subscription_inactive"
  | "rate_limited"
  | "origin_not_allowed"
  | "entitlement_denied"
  | "usage_exceeded";

export class ApiAuthError extends Error {
  constructor(
    public readonly code: ApiAuthFailureCode,
    message: string,
    public readonly status: number = 401,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

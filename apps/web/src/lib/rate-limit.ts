import { Redis } from "ioredis";

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 50, 2000);
      },
    });
  }
  return redis;
}

export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the window
   */
  limit: number;
  /**
   * Time window in seconds
   */
  windowSeconds: number;
  /**
   * Unique identifier for this rate limit (e.g., "webhook:stripe", "api:threads")
   */
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Token bucket rate limiter using Redis.
 * Returns whether the request should be allowed.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const key = `ratelimit:${config.keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const windowStart = now - windowMs;

  try {
    const redis = getRedis();

    // Use Redis sorted set to track requests in the time window
    const multi = redis.multi();

    // Remove expired entries
    multi.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    multi.zcard(key);

    // Add current request
    multi.zadd(key, now, `${now}`);

    // Set expiry
    multi.expire(key, config.windowSeconds);

    const results = await multi.exec();

    if (!results) {
      throw new Error("Redis transaction failed");
    }

    // Get count after cleanup, before adding new request
    const count = results[1]?.[1] as number;

    const allowed = count < config.limit;
    const remaining = Math.max(0, config.limit - count - (allowed ? 1 : 0));
    const resetAt = new Date(now + windowMs);

    // If not allowed, remove the request we just added
    if (!allowed) {
      await getRedis().zrem(key, `${now}`);
    }

    return {
      allowed,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error("[checkRateLimit] Redis error:", error);
    // Fail open on Redis errors to prevent service disruption
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(now + windowMs),
    };
  }
}

/**
 * Helper for webhook rate limiting by IP address
 */
export async function checkWebhookRateLimit(
  ip: string | null,
): Promise<RateLimitResult> {
  const identifier = ip || "unknown";
  return checkRateLimit(identifier, {
    limit: 100, // 100 requests
    windowSeconds: 60, // per minute
    keyPrefix: "webhook",
  });
}

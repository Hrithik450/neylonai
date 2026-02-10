import Redis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL is not set in environment variables.");
}

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

const redis = globalThis.redis ?? new Redis(process.env.REDIS_URL, {
  connectTimeout: 5000,
  commandTimeout: 5000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  lazyConnect: true,
});

if (process.env.NODE_ENV !== "production") {
  globalThis.redis = redis;
}

export { redis };

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number = 3600,
): Promise<void> {
  try {
    await redis.set(key, value, "EX", ttlSeconds);
  } catch {
    // silently ignore cache errors
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // silently ignore cache errors
  }
}

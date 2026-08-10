import { redis } from "./client";

function logCacheError(op: string, error: unknown) {
  console.warn(`[redis cache] ${op} failed:`, error);
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (error) {
    logCacheError("get", error);
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
  } catch (error) {
    logCacheError("set", error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    logCacheError("del", error);
  }
}

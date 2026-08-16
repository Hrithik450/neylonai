import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

let client: Redis | undefined;

function createRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set in environment variables.");
  }

  // During `next build` (NEXT_PHASE=phase-production-build) there is no Redis
  // available. Return null immediately so ioredis gives up after one attempt
  // instead of retrying for minutes and crashing the build.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

  const instance = new Redis(url, {
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: isBuildPhase ? 0 : 2,
    // Required with lazyConnect: otherwise commands fail while connecting with
    // "Stream isn't writeable and enableOfflineQueue options is false".
    enableOfflineQueue: true,
    lazyConnect: true,
    retryStrategy(times) {
      if (isBuildPhase || times > 20) return null;
      return Math.min(times * 100, 2000);
    },
  });

  // Swallow all Redis errors — AggregateError (Node ≥17 multi-connect) included.
  instance.on("error", (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[redis]", msg);
  });

  return instance;
}

function dropClient(): void {
  client = undefined;
  if (process.env.NODE_ENV !== "production") {
    globalThis.redis = undefined;
  }
}

function getRedis(): Redis {
  if (process.env.NODE_ENV !== "production" && globalThis.redis) {
    client = globalThis.redis;
  }

  // Next.js HMR / long-lived workers can leave a closed client in globalThis.
  if (client && (client.status === "end" || client.status === "close")) {
    try {
      client.disconnect(false);
    } catch {
      // already dead
    }
    dropClient();
  }

  if (!client) {
    client = createRedis();
    if (process.env.NODE_ENV !== "production") {
      globalThis.redis = client;
    }
  }
  return client;
}

/**
 * Lazy Redis accessor so `next build` can import modules without REDIS_URL.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    const instance = getRedis();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});

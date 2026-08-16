import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

let client: Redis | undefined;

/**
 * During `next build` there is no Redis available — return a no-op proxy so
 * any accidental Redis calls silently resolve/reject without crashing the build.
 */
function createBuildProxy(): Redis {
  return new Proxy({} as Redis, {
    get(_t, prop) {
      if (prop === "status") return "end";
      if (prop === "on" || prop === "off" || prop === "once") return () => {};
      // Every Redis command returns a rejected promise so callers can handle it
      return () => Promise.reject(new Error("[redis] unavailable during build"));
    },
  });
}

function createRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set in environment variables.");
  }

  const instance = new Redis(url, {
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 2,
    // Required with lazyConnect: otherwise commands fail while connecting with
    // "Stream isn't writeable and enableOfflineQueue options is false".
    enableOfflineQueue: true,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 20) return null;
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
  // During `next build`, return a no-op proxy — no Redis server is running.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return createBuildProxy();
  }

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

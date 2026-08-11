/**
 * Scalable Google Generative AI API key pool.
 *
 * Configure keys via (any combination; duplicates ignored):
 *   GOOGLE_API_KEYS=key1,key2,key3
 *   GOOGLE_API_KEY_1 / GOOGLE_API_KEY_2 / … (numbered)
 *   GOOGLE_API_KEY=single-key (legacy fallback)
 *
 * On 429 / quota / rate-limit errors, the offending key is cooled down and
 * the next healthy key is used. Round-robin spreads load across paid keys.
 */

export interface GoogleApiKeyPoolOptions {
  /** Cooldown after a rate-limit hit (ms). Default 60s. */
  cooldownMs?: number;
}

function parseKeyList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\s,]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/** Collect keys from env — order preserved, unique. */
export function loadGoogleApiKeysFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];

  const add = (value: string | undefined) => {
    for (const key of parseKeyList(value)) {
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
  };

  add(env.GOOGLE_API_KEYS);

  // Numbered keys: GOOGLE_API_KEY_1 … GOOGLE_API_KEY_99 (and bare GOOGLE_API_KEY)
  const numbered = Object.keys(env)
    .map((name) => {
      const match = /^GOOGLE_API_KEY_(\d+)$/.exec(name);
      return match ? { name, n: Number(match[1]) } : null;
    })
    .filter((x): x is { name: string; n: number } => x !== null)
    .sort((a, b) => a.n - b.n);

  for (const { name } of numbered) {
    add(env[name]);
  }

  add(env.GOOGLE_API_KEY);

  return keys;
}

export function isGoogleRateLimitError(error: unknown): boolean {
  if (error == null) return false;

  const status =
    typeof error === "object" && error !== null
      ? ((error as { status?: unknown }).status ??
        (error as { statusCode?: unknown }).statusCode ??
        (error as { response?: { status?: unknown } }).response?.status)
      : undefined;

  if (status === 429 || status === 503) return true;

  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  return /429|rate.?limit|quota|resource.?exhausted|too many requests|exceeded.+quota|generative.?language.+quota/i.test(
    message,
  );
}

export class GoogleApiKeyPool {
  private readonly keys: string[];
  private readonly cooldownMs: number;
  private readonly cooldownUntil = new Map<string, number>();
  private cursor = 0;

  constructor(keys: string[], options?: GoogleApiKeyPoolOptions) {
    const unique = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
    if (unique.length === 0) {
      throw new Error(
        "No Google API keys configured. Set GOOGLE_API_KEYS, GOOGLE_API_KEY_1…, or GOOGLE_API_KEY.",
      );
    }
    this.keys = unique;
    this.cooldownMs = options?.cooldownMs ??
      Number(process.env.GOOGLE_API_KEY_COOLDOWN_MS ?? 60_000);
  }

  get size(): number {
    return this.keys.length;
  }

  /** 1-based index for logs (never log the raw key). */
  label(apiKey: string): string {
    const idx = this.keys.indexOf(apiKey);
    return idx >= 0 ? `#${idx + 1}` : "#?";
  }

  private isAvailable(apiKey: string, now = Date.now()): boolean {
    const until = this.cooldownUntil.get(apiKey);
    return until == null || until <= now;
  }

  /**
   * Pick the next healthy key (round-robin).
   * @param exclude keys already tried in the current request
   */
  acquire(exclude?: ReadonlySet<string>): string {
    const now = Date.now();
    const n = this.keys.length;

    for (let i = 0; i < n; i++) {
      const idx = (this.cursor + i) % n;
      const key = this.keys[idx]!;
      if (exclude?.has(key)) continue;
      if (!this.isAvailable(key, now)) continue;
      this.cursor = (idx + 1) % n;
      return key;
    }

    // All cooling or excluded — pick the soonest-to-recover key not in exclude.
    let best: string | null = null;
    let bestUntil = Infinity;
    for (const key of this.keys) {
      if (exclude?.has(key)) continue;
      const until = this.cooldownUntil.get(key) ?? 0;
      if (until < bestUntil) {
        bestUntil = until;
        best = key;
      }
    }

    if (best) {
      this.cooldownUntil.delete(best);
      this.cursor = (this.keys.indexOf(best) + 1) % n;
      return best;
    }

    // Last resort: rotate even if excluded (single-key setups).
    const fallback = this.keys[this.cursor % n]!;
    this.cursor = (this.cursor + 1) % n;
    return fallback;
  }

  markRateLimited(apiKey: string, cooldownMs = this.cooldownMs): void {
    this.cooldownUntil.set(apiKey, Date.now() + cooldownMs);
  }

  /** Test helper / ops introspection. */
  snapshot(): { total: number; available: number; cooling: number } {
    const now = Date.now();
    let available = 0;
    let cooling = 0;
    for (const key of this.keys) {
      if (this.isAvailable(key, now)) available++;
      else cooling++;
    }
    return { total: this.keys.length, available, cooling };
  }
}

let sharedPool: GoogleApiKeyPool | null = null;

export function getGoogleApiKeyPool(): GoogleApiKeyPool {
  if (!sharedPool) {
    sharedPool = new GoogleApiKeyPool(loadGoogleApiKeysFromEnv());
  }
  return sharedPool;
}

/** Reset pool (tests / after env hot-reload). */
export function resetGoogleApiKeyPool(): void {
  sharedPool = null;
}

export function getGoogleApiKey(): string {
  return getGoogleApiKeyPool().acquire();
}

export interface WithGoogleApiRetryOptions {
  /** Max attempts; defaults to pool size (try each key once). */
  maxAttempts?: number;
}

/**
 * Run an API call with automatic key rotation on rate-limit / quota errors.
 */
export async function withGoogleApiRetry<T>(
  fn: (apiKey: string) => Promise<T>,
  options?: WithGoogleApiRetryOptions,
): Promise<T> {
  const pool = getGoogleApiKeyPool();
  const maxAttempts = Math.max(
    1,
    options?.maxAttempts ?? pool.size,
  );
  const tried = new Set<string>();
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const apiKey = pool.acquire(tried);
    tried.add(apiKey);

    try {
      return await fn(apiKey);
    } catch (error) {
      lastError = error;
      if (!isGoogleRateLimitError(error)) {
        throw error;
      }
      pool.markRateLimited(apiKey);
      console.warn(
        `[google-api-keys] rate limited key ${pool.label(apiKey)} ` +
          `(attempt ${attempt + 1}/${maxAttempts}); rotating`,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        `All Google API keys rate-limited after ${maxAttempts} attempts`,
      );
}

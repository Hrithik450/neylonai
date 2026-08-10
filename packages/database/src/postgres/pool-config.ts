import type { PoolConfig } from "pg";

/**
 * Supabase (and similar) expose multiple Postgres endpoints:
 * - Direct `:5432` — migrations, drizzle-kit, long-lived processes
 * - Transaction pooler `:6543` (Supavisor / dedicated PgBouncer) — Vercel / serverless
 * - Session pooler `:5432` on `*.pooler.supabase.com` — persistent IPv4 backends
 *
 * Transaction mode does not support prepared statements / session features.
 * @see https://supabase.com/docs/guides/database/connecting-to-postgres
 */

const TRANSACTION_POOLER_PORT = "6543";

/** Strip Prisma-style / non-libpq flags that confuse `pg`. */
export function sanitizeDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("pgbouncer");
    url.searchParams.delete("connection_limit");
    url.searchParams.delete("pool_timeout");
    return url.toString();
  } catch {
    return connectionString;
  }
}

export function isTransactionPoolerUrl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    if (url.port === TRANSACTION_POOLER_PORT) return true;
    if (url.searchParams.get("pgbouncer") === "true") return true;
    return false;
  } catch {
    return /:6543(\/|\?|$)/.test(connectionString);
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Pool settings safe for Vercel + Supabase transaction pooler.
 * Keep client-side `max` small — multiplexing happens in PgBouncer/Supavisor.
 */
export function getPoolConfig(connectionString: string): PoolConfig {
  const usingTransactionPooler = isTransactionPoolerUrl(connectionString);
  const onVercel = Boolean(process.env.VERCEL);

  const defaultMax = usingTransactionPooler || onVercel ? 1 : 10;

  return {
    connectionString: sanitizeDatabaseUrl(connectionString),
    max: envInt("DATABASE_POOL_MAX", defaultMax),
    idleTimeoutMillis: envInt("DATABASE_POOL_IDLE_MS", onVercel ? 10_000 : 30_000),
    connectionTimeoutMillis: envInt("DATABASE_POOL_CONNECT_MS", 10_000),
    // Let serverless isolates exit when idle instead of holding sockets open.
    allowExitOnIdle: onVercel || usingTransactionPooler,
  };
}

/** Runtime URL (prefer transaction pooler on Vercel / Supabase). */
export function getRuntimeDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set in environment variables.");
  }
  return url;
}

/**
 * Direct (or session) URL for migrations / drizzle-kit.
 * Falls back to DATABASE_URL for local Docker where there is no pooler.
 */
export function getDirectDatabaseUrl(): string {
  return (
    process.env.DATABASE_DIRECT_URL?.trim() ||
    process.env.DIRECT_URL?.trim() ||
    getRuntimeDatabaseUrl()
  );
}

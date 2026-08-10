import { Pool } from "pg";
import * as schema from "./schema";
import { getPostgresSsl } from "./ssl";
import { getPoolConfig, getRuntimeDatabaseUrl } from "./pool-config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

export type AppDatabase = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let dbInstance: AppDatabase | null = null;

function createDb(): AppDatabase {
  const connectionString = getRuntimeDatabaseUrl();
  const ssl = getPostgresSsl(connectionString);

  pool = new Pool({
    ...getPoolConfig(connectionString),
    ssl: ssl === false ? undefined : ssl,
  });

  // node-pg uses unnamed extended-protocol queries by default, which works with
  // Supabase transaction poolers (Supavisor / PgBouncer on :6543). Do not switch
  // to named prepared statements without verifying pooler compatibility.
  dbInstance = drizzle(pool, { schema });
  return dbInstance;
}

/**
 * Lazy DB accessor so `next build` can import route modules without requiring
 * runtime secrets (DATABASE_URL is injected at container start).
 *
 * On Vercel, point DATABASE_URL at Supabase **transaction** pooler (`:6543`).
 * Keep DATABASE_DIRECT_URL as the direct `:5432` string for migrations.
 */
export const db: AppDatabase = new Proxy({} as AppDatabase, {
  get(_target, prop, receiver) {
    const instance = dbInstance ?? createDb();
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

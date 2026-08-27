import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getPostgresSsl } from "./postgres/ssl";
import {
  getDirectDatabaseUrl,
  getPoolConfig,
  isTransactionPoolerUrl,
} from "./postgres/pool-config";
import { Pool } from "pg";

async function main() {
  // Load env before reading DATABASE_URL. `pnpm --filter @neylonai/database
  // migrate` runs with the package dir as cwd, so the monorepo-root .env must be
  // resolved explicitly — a bare dotenv/config reads only ./.env from cwd, which
  // doesn't exist in the package. dotenv never overrides vars already set in the
  // environment, so CI/prod (where DATABASE_URL is set directly) is unaffected,
  // and a missing file is silently ignored.
  loadEnv({ path: resolve(process.cwd(), "../../.env") });
  loadEnv();

  const connectionString = getDirectDatabaseUrl();

  if (isTransactionPoolerUrl(connectionString)) {
    console.error(
      "Migrations must use a direct (or session) Postgres URL, not the transaction pooler (:6543).\n" +
        "Set DATABASE_DIRECT_URL to the Supabase Direct connection (db.*.supabase.co:5432),\n" +
        "and keep DATABASE_URL as the transaction pooler for the app.",
    );
    process.exit(1);
  }

  const ssl = getPostgresSsl(connectionString);
  const pool = new Pool({
    ...getPoolConfig(connectionString),
    // Migrations are a single CLI process — a slightly larger pool is fine.
    max: 1,
    ssl: ssl === false ? undefined : ssl,
  });

  const db = drizzle(pool);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./migrations" });
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

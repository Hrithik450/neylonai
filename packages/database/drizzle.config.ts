import "dotenv/config";
import type { Config } from "drizzle-kit";

/**
 * drizzle-kit must talk to a direct (or session) Postgres endpoint.
 * Prefer DATABASE_DIRECT_URL; fall back to DATABASE_URL for local Docker.
 */
const url =
  process.env.DATABASE_DIRECT_URL?.trim() ||
  process.env.DIRECT_URL?.trim() ||
  process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "Set DATABASE_DIRECT_URL (preferred) or DATABASE_URL for drizzle-kit.",
  );
}

if (/:6543(\/|\?|$)/.test(url) || /pgbouncer=true/i.test(url)) {
  throw new Error(
    "drizzle-kit cannot use the transaction pooler (:6543). Set DATABASE_DIRECT_URL to the Direct connection (:5432).",
  );
}

export default {
  out: "./migrations",
  schema: "./src/postgres/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
  verbose: true,
  strict: true,
} satisfies Config;

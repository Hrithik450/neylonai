/**
 * Supabase-specific read-only role SQL (browser-safe).
 * Database name on Supabase is typically `postgres`.
 */

export const SUPABASE_READONLY_ROLE = "neylon_readonly";

/**
 * Run in Supabase SQL Editor (Dashboard → SQL).
 * Replace the password before running. Never use the `postgres` superuser
 * password or the service_role API key for Neylon.
 */
export const SUPABASE_READONLY_SETUP_SQL = `-- Neylon AI: dedicated read-only role (least privilege)
-- Docs: https://supabase.com/docs/guides/database/postgres/roles
-- Docs: https://supabase.com/docs/guides/database/connecting-to-postgres

CREATE ROLE neylon_readonly WITH LOGIN PASSWORD 'replace-with-a-strong-password';

GRANT CONNECT ON DATABASE postgres TO neylon_readonly;
GRANT USAGE ON SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO neylon_readonly;

-- Future tables created by postgres / table owners stay readable
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO neylon_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO neylon_readonly;

-- Optional: allow schema discovery (information_schema is usually readable)
GRANT USAGE ON SCHEMA information_schema TO neylon_readonly;`;

/**
 * Prefer Session mode pooler (IPv4) for SaaS backends when Direct is IPv6-only.
 * Customer substitutes project-ref, region, and password.
 */
export const SUPABASE_CONNECTION_URL_EXAMPLES = {
  sessionPooler:
    "postgresql://neylon_readonly.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres",
  transactionPooler:
    "postgresql://neylon_readonly.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres",
  direct:
    "postgresql://neylon_readonly:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres",
} as const;

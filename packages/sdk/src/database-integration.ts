/**
 * Browser-safe database integration setup types and constants.
 * Used in the dashboard UI for connecting customer databases.
 */

export type DatabaseDeploymentKind = "cloud" | "private";

export type DatabaseProviderStatus = "available" | "upcoming";

export type DatabaseCloudProviderId =
  | "supabase"
  | "neon"
  | "rds"
  | "cloud_sql"
  | "azure_postgres"
  | "railway"
  | "planetscale";

export type DatabasePrivateProviderId =
  | "vps"
  | "on_prem"
  | "localhost"
  | "private_vpc";

export type DatabaseProviderId =
  | DatabaseCloudProviderId
  | DatabasePrivateProviderId;

export type DatabaseProviderOption = {
  id: DatabaseProviderId;
  name: string;
  description: string;
  status: DatabaseProviderStatus;
  deployment: DatabaseDeploymentKind;
  upcomingNote?: string;
};

export type SupabaseSetupMethod = "manual" | "cli";

export const DATABASE_CLOUD_PROVIDERS: readonly DatabaseProviderOption[] = [
  {
    id: "supabase",
    name: "Supabase",
    description:
      "Hosted Postgres. Create a read-only role, then paste the connection URL.",
    status: "available",
    deployment: "cloud",
  },
  {
    id: "neon",
    name: "Neon",
    description: "Serverless Postgres.",
    status: "upcoming",
    deployment: "cloud",
    upcomingNote: "Coming soon",
  },
  {
    id: "rds",
    name: "Amazon RDS / Aurora",
    description: "Managed Postgres on AWS.",
    status: "upcoming",
    deployment: "cloud",
    upcomingNote: "Coming soon",
  },
  {
    id: "cloud_sql",
    name: "Google Cloud SQL",
    description: "Managed Postgres on GCP.",
    status: "upcoming",
    deployment: "cloud",
    upcomingNote: "Coming soon",
  },
  {
    id: "azure_postgres",
    name: "Azure Database for PostgreSQL",
    description: "Managed Postgres on Azure.",
    status: "upcoming",
    deployment: "cloud",
    upcomingNote: "Coming soon",
  },
  {
    id: "railway",
    name: "Railway",
    description: "Managed Postgres on Railway.",
    status: "upcoming",
    deployment: "cloud",
    upcomingNote: "Coming soon",
  },
] as const;

export const DATABASE_PRIVATE_PROVIDERS: readonly DatabaseProviderOption[] = [
  {
    id: "vps",
    name: "VPS / self-hosted",
    description: "Postgres on a VPS (DigitalOcean, Hetzner, Linode, …).",
    status: "upcoming",
    deployment: "private",
    upcomingNote: "Outbound connector coming soon",
  },
  {
    id: "on_prem",
    name: "On-premise",
    description: "Databases inside your data center.",
    status: "upcoming",
    deployment: "private",
    upcomingNote: "Outbound connector coming soon",
  },
  {
    id: "private_vpc",
    name: "Private VPC",
    description: "Cloud Postgres with no public endpoint.",
    status: "upcoming",
    deployment: "private",
    upcomingNote: "Outbound connector coming soon",
  },
  {
    id: "localhost",
    name: "Localhost / local network",
    description: "Dev machines and LAN-only databases.",
    status: "upcoming",
    deployment: "private",
    upcomingNote: "Outbound connector coming soon",
  },
] as const;

export const SUPABASE_READONLY_ROLE = "neylon_readonly";

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

export const SUPABASE_CONNECTION_URL_EXAMPLES = {
  sessionPooler:
    "postgresql://neylon_readonly.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres",
  transactionPooler:
    "postgresql://neylon_readonly.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres",
  direct:
    "postgresql://neylon_readonly:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres",
} as const;

export const POSTGRES_READONLY_SETUP_SQL = `CREATE ROLE neylon_readonly LOGIN PASSWORD 'strong-password';

GRANT CONNECT ON DATABASE mydb TO neylon_readonly;
GRANT USAGE ON SCHEMA public TO neylon_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO neylon_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO neylon_readonly;`;

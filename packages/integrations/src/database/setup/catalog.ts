/**
 * Browser-safe Database integration setup catalog (Cloud / Private).
 * Extensible for future providers and private connectors — no Node/`pg` deps.
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
  /** Shown when status is upcoming. */
  upcomingNote?: string;
};

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

export type SupabaseSetupMethod = "manual" | "cli";

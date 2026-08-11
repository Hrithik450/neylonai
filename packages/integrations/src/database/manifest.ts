import type { IntegrationManifest } from "../catalog/types";

export const databaseManifest = {
  id: "database",
  name: "Database",
  description:
    "Connect a cloud or private Postgres database with a read-only role. Neylon introspects schema into knowledge and answers with live relational queries — no database copy.",
  dataMode: "import",
  connectable: true,
  planBadge: "starter",
  ingestKind: "schema",
  credentialKeys: ["connectionUrl"],
  stubNote:
    "Cloud (Supabase available) or private (connector upcoming). Create a read-only role, paste the connection URL.",
} as const satisfies IntegrationManifest;

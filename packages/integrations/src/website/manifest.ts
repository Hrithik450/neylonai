import type { IntegrationManifest } from "../catalog/types";

export const websiteManifest = {
  id: "website",
  name: "Website",
  description:
    "Import evergreen site pages like pricing, features, docs, help, and policies into your AI knowledge base.",
  dataMode: "import",
  connectable: true,
  planBadge: "free",
  ingestKind: "scrape",
} as const satisfies IntegrationManifest;

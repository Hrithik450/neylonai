import type { IntegrationManifest } from "../catalog/types";

export const websiteManifest = {
  id: "website",
  name: "Website",
  description:
    "Import full website evergreen pages. Database backed pages are filtered out, use Database for those.",
  dataMode: "import",
  connectable: true,
  planBadge: "free",
  ingestKind: "scrape",
} as const satisfies IntegrationManifest;

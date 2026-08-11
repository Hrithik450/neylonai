import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const hubspotManifest = {
  id: "hubspot",
  name: "HubSpot",
  description:
    "Query and write HubSpot contacts when a conversation needs CRM context. Bidirectional does not bulk-copy your CRM database.",
  dataMode: "sync",
  connectable: false,
  planBadge: "pro",
  stubNote: "Coming soon — Connect is unavailable.",
} as const satisfies IntegrationManifest;

export const hubspotIntegration = {
  manifest: hubspotManifest,
} as const satisfies IntegrationModule;

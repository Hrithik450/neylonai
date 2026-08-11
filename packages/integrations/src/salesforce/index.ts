import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const salesforceManifest = {
  id: "salesforce",
  name: "Salesforce",
  description:
    "Query and write Salesforce leads from Neylon AI. Bidirectional — does not bulk-copy your Salesforce org.",
  dataMode: "sync",
  connectable: false,
  planBadge: "pro",
  stubNote: "Coming soon — Connect is unavailable.",
} as const satisfies IntegrationManifest;

export const salesforceIntegration = {
  manifest: salesforceManifest,
} as const satisfies IntegrationModule;

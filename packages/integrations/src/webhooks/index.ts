import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const webhooksManifest = {
  id: "webhooks",
  name: "Outbound webhooks",
  description:
    "Outbound webhooks for custom automation. Configuration UI not shipped yet.",
  dataMode: "connect",
  connectable: false,
  planBadge: "free",
  stubNote: "Coming soon — Connect is unavailable.",
} as const satisfies IntegrationManifest;

export const webhooksIntegration = {
  manifest: webhooksManifest,
} as const satisfies IntegrationModule;

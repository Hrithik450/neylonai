import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const slackManifest = {
  id: "slack",
  name: "Slack",
  description:
    "Send notifications to Slack when leads are captured or conversations need humans.",
  dataMode: "connect",
  connectable: false,
  planBadge: "free",
  stubNote: "Coming soon — Connect is unavailable.",
} as const satisfies IntegrationManifest;

export const slackIntegration = {
  manifest: slackManifest,
} as const satisfies IntegrationModule;

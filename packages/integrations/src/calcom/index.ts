import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const calcomManifest = {
  id: "calcom",
  name: "Cal.com",
  description:
    "Give the Main Agent a public meeting URL to share with visitors.",
  dataMode: "connect",
  connectable: true,
  planBadge: "free",
  stubNote:
    "Set meetingUrl in the integration config to your public Cal.com event link.",
} as const satisfies IntegrationManifest;

export const calcomIntegration = {
  manifest: calcomManifest,
} as const satisfies IntegrationModule;

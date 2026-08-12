import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const calcomManifest = {
  id: "calcom",
  name: "Cal.com",
  description:
    "Let the Booking Agent share your Cal.com scheduling link so visitors can pick a time.",
  dataMode: "connect",
  connectable: true,
  planBadge: "free",
  stubNote:
    "Set bookingUrl in the integration config to your public Cal.com event link.",
} as const satisfies IntegrationManifest;

export const calcomIntegration = {
  manifest: calcomManifest,
} as const satisfies IntegrationModule;

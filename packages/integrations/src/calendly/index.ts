import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const calendlyManifest = {
  id: "calendly",
  name: "Calendly",
  description:
    "Let the Booking Agent share your Calendly (or Cal.com) scheduling link so visitors can pick a time.",
  dataMode: "connect",
  connectable: true,
  planBadge: "free",
  stubNote:
    "Set bookingUrl in the integration config to your public Calendly or Cal.com event link.",
} as const satisfies IntegrationManifest;

export const calendlyIntegration = {
  manifest: calendlyManifest,
} as const satisfies IntegrationModule;

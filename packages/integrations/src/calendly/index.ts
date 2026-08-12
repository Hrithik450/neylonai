import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const calendlyManifest = {
  id: "calendly",
  name: "Calendly",
  description: "Optional Calendly connect integration (not used by Booking Agent).",
  dataMode: "connect",
  connectable: true,
  planBadge: "free",
} as const satisfies IntegrationManifest;

export const calendlyIntegration = {
  manifest: calendlyManifest,
} as const satisfies IntegrationModule;

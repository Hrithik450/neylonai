import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const whatsappManifest = {
  id: "whatsapp",
  name: "WhatsApp",
  description:
    "Send and receive WhatsApp Business conversations. Not available yet.",
  dataMode: "sync",
  connectable: false,
  planBadge: "free",
  stubNote: "Coming soon — Connect is unavailable.",
} as const satisfies IntegrationManifest;

export const whatsappIntegration = {
  manifest: whatsappManifest,
} as const satisfies IntegrationModule;

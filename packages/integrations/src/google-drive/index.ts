import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const googleDriveManifest = {
  id: "google_drive",
  name: "Google Drive",
  description:
    "Connect Google Drive to sync selected documents into your knowledge base. OAuth account linking is required before sync can run.",
  dataMode: "import",
  connectable: false,
  planBadge: "free",
  ingestKind: "oauth",
  stubNote:
    "Google Drive OAuth is not configured on this deployment yet. The integration is listed so you can plan for it — Connect stays unavailable until Drive OAuth ships.",
} as const satisfies IntegrationManifest;

export const googleDriveIntegration = {
  manifest: googleDriveManifest,
} as const satisfies IntegrationModule;

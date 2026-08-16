/**
 * Web Search — optional Connect integration.
 * When enabled, Main Agent may use the web_search tool (Tavily-backed).
 * Disabled by default; never exposed to the model until the org enables it.
 */

import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const webSearchManifest = {
  id: "web_search",
  name: "Web Search",
  description:
    "Allow the Main Agent to search the open web for current events and topics outside your knowledge base. Uses the platform search provider when enabled.",
  dataMode: "connect",
  connectable: true,
  planBadge: "starter",
  stubNote:
    "Enable to give Main Agent the web_search tool. Search runs through the platform provider (Tavily).",
} as const satisfies IntegrationManifest;

export const webSearchIntegration = {
  manifest: webSearchManifest,
} as const satisfies IntegrationModule;

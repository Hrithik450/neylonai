/**
 * Evently — customer Connect integration + first-party analytics adapter.
 * Tracking is currently a no-op until Evently is re-enabled; call sites may remain.
 */

import type { IntegrationManifest } from "../catalog/types";
import type { IntegrationModule } from "../catalog/module";

export const eventlyManifest = {
  id: "evently",
  name: "Evently",
  description:
    "First-party analytics destination. Events are forwarded when server credentials are present.",
  dataMode: "connect",
  connectable: true,
  planBadge: "free",
  stubNote:
    "Uses server Evently credentials when present. Enabling records Evently as an active destination for this workspace.",
} as const satisfies IntegrationManifest;

export type NeylonAnalyticsEvent =
  | "widget_impression"
  | "widget_opened"
  | "widget_closed"
  | "suggestion_shown"
  | "suggestion_clicked"
  | "suggestion_dismissed"
  | "conversation_started"
  | "message_sent"
  | "message_received"
  | "agent_selected"
  | "agent_completed"
  | "lead_created"
  | "integration_used"
  | "widget_config_changed"
  | "api_key_created"
  | "api_key_revoked"
  | "subscription_started"
  | "subscription_upgraded"
  | "subscription_downgraded"
  | "subscription_cancelled"
  | "ticket_created"
  | "ticket_assigned"
  | "ticket_resolved";

export interface TrackEventInput {
  event: NeylonAnalyticsEvent | string;
  organizationId?: string | null;
  projectId?: string | null;
  sessionId?: string | null;
  visitorId?: string | null;
  pagePath?: string | null;
  suggestionId?: string | null;
  agentId?: string | null;
  integrationId?: string | null;
  properties?: Record<string, string | number | boolean | null | undefined>;
  timestamp?: string;
}

export async function trackEvently(_input: TrackEventInput): Promise<void> {
  // Intentionally empty until Evently is re-enabled.
}

export function trackEventlySafe(_input: TrackEventInput): void {
  // Intentionally empty until Evently is re-enabled.
}

export const eventlyIntegration = {
  manifest: eventlyManifest,
  track: trackEvently,
  trackSafe: trackEventlySafe,
} as const satisfies IntegrationModule & {
  track: typeof trackEvently;
  trackSafe: typeof trackEventlySafe;
};

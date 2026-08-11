import type { AgentDefinition } from "../../domain/types";
import { prompts } from "../../lib/prompts";
import { provideBookingLinkTool } from "./provide-booking-link.tool";

/**
 * Booking Agent — domain workflow for scheduling.
 * Support Agent orchestrates: detect intent → confirm → delegate here when enabled.
 */
export const bookingAgent: AgentDefinition = {
  id: "booking",
  name: "Booking Agent",
  purpose: "Schedules demos and meetings",
  description:
    "Collects booking intent and shares your Calendly or Cal.com link so visitors can pick a time. Requires the Calendly integration with a booking URL.",
  builtIn: false,
  defaultActive: false,
  runnable: true,
  tier: "advanced",
  outcomeMetric: { key: "meetings_booked", label: "Meetings booked" },
  integrationIds: ["calendly", "slack", "webhooks"],
  requiredIntegrationIds: ["calendly"],
  activityKinds: ["booked_meeting"],
  configSchema: [
    {
      key: "bookingAgentEnabled",
      label: "Enable Booking Agent",
      type: "boolean",
      defaultValue: false,
    },
  ],
  systemPrompt: prompts.bookingAgentSystem,
  tools: [provideBookingLinkTool],
};

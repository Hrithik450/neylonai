import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { listOrgIntegrations } from "@neylonai/domain/billing";
import { getAgentTurnContext } from "../../infrastructure/agent-turn-context";

function bookingUrlFromConfig(
  config: Record<string, unknown> | null | undefined,
): string | null {
  if (!config) return null;
  for (const key of [
    "bookingUrl",
    "booking_url",
    "url",
    "eventUrl",
    "event_url",
  ] as const) {
    const v = config[key];
    if (typeof v === "string" && v.trim().startsWith("http")) {
      return v.trim();
    }
  }
  return null;
}

/**
 * Booking Agent tool — surfaces the org's Cal.com scheduling link.
 * Only bound when Booking Agent is enabled and Cal.com integration is on.
 */
export const provideBookingLinkTool = tool(
  async ({ intent }: { intent?: string }) => {
    const organizationId = getAgentTurnContext().organizationId?.trim();
    if (!organizationId) {
      return "Booking is unavailable (missing organization context).";
    }

    const rows = await listOrgIntegrations(organizationId);
    const calcom = rows.find(
      (r) => r.integration_type === "calcom" && r.enabled,
    );
    if (!calcom) {
      return "Cal.com is not connected. Ask the workspace admin to enable Cal.com under Integrations and set bookingUrl.";
    }

    const url = bookingUrlFromConfig(
      (calcom.config ?? {}) as Record<string, unknown>,
    );
    if (!url) {
      return "Cal.com is enabled but bookingUrl is not configured. Ask the workspace admin to set the public scheduling link.";
    }

    const note = intent?.trim()
      ? ` (for: ${intent.trim().slice(0, 120)})`
      : "";
    return `Share this scheduling link with the visitor${note}: ${url}

Ask them to pick a time that works. Once they confirm on the calendar page, the meeting is booked. You do not need to invent availability slots.`;
  },
  {
    name: "provide_booking_link",
    description:
      "Provide the workspace Cal.com scheduling link so the visitor can pick a time and book. Use after the visitor confirmed they want to book.",
    schema: z.object({
      intent: z
        .string()
        .optional()
        .describe("Short note about what they want to book (demo, call, etc.)"),
    }),
  },
);

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { listOrgIntegrations } from "@neylonai/domain/billing";
import { getAgentTurnContext } from "../../infrastructure/agent-turn-context";

function bookingUrlFromConfig(config: Record<string, unknown> | null | undefined): string | null {
  if (!config) return null;
  for (const key of ["bookingUrl", "booking_url", "url", "eventUrl", "event_url"] as const) {
    const v = config[key];
    if (typeof v === "string" && v.trim().startsWith("http")) {
      return v.trim();
    }
  }
  return null;
}

/**
 * Booking Agent tool — surfaces the org's configured Calendly/Cal.com link.
 * Only bound when Booking Agent is enabled and calendly integration is on.
 */
export const provideBookingLinkTool = tool(
  async ({ intent }: { intent?: string }) => {
    const organizationId = getAgentTurnContext().organizationId?.trim();
    if (!organizationId) {
      return "Booking is unavailable (missing organization context).";
    }

    const rows = await listOrgIntegrations(organizationId);
    const calendly = rows.find(
      (r) => r.integration_type === "calendly" && r.enabled,
    );
    if (!calendly) {
      return "No calendar booking integration is connected. Ask the workspace admin to enable Calendly under Integrations and set bookingUrl.";
    }

    const url = bookingUrlFromConfig(
      (calendly.config ?? {}) as Record<string, unknown>,
    );
    if (!url) {
      return "Calendly is enabled but bookingUrl is not configured. Ask the workspace admin to set the public scheduling link.";
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
      "Provide the workspace scheduling link (Calendly / Cal.com) so the visitor can pick a time and book. Use after the visitor confirmed they want to book.",
    schema: z.object({
      intent: z
        .string()
        .optional()
        .describe("Short note about what they want to book (demo, call, etc.)"),
    }),
  },
);

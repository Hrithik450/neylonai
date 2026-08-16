import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { listOrgIntegrations } from "@neylonai/domain/billing";
import { getAgentTurnContext } from "../agent-turn-context";

function meetingUrlFromConfig(
  config: Record<string, unknown> | null | undefined,
): string | null {
  if (!config) return null;
  for (const key of [
    "meetingUrl",
    "meeting_url",
    "url",
    "eventUrl",
    "event_url",
  ] as const) {
    const value = config[key];
    if (typeof value !== "string") continue;
    try {
      const parsed = new URL(value.trim());
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return parsed.toString();
      }
    } catch {
      // Try the next supported config key.
    }
  }
  return null;
}

/**
 * Returns the workspace's configured meeting URL.
 * This does not check availability, collect details, or book anything.
 */
export const provideMeetingLinkTool = tool(
  async () => {
    const organizationId = getAgentTurnContext().organizationId?.trim();
    if (!organizationId) {
      return "A meeting link is unavailable because workspace context is missing.";
    }

    const integrations = await listOrgIntegrations(organizationId);
    const calcom = integrations.find(
      (row) => row.integration_id === "calcom" && row.enabled,
    );
    const url = meetingUrlFromConfig(
      (calcom?.config ?? {}) as Record<string, unknown>,
    );

    if (!url) {
      return "No meeting URL is configured for this workspace.";
    }

    return `Share this meeting URL with the visitor: ${url}`;
  },
  {
    name: "provide_meeting_link",
    description:
      "Return the workspace's configured meeting URL when a visitor asks to schedule a meeting. Share the URL directly; do not claim to check availability or complete scheduling.",
    schema: z.object({}),
  },
);

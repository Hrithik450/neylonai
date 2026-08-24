import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { notificationProviders } from "@neylonai/integrations";
import { getAgentTurnContext } from "../agent-turn-context";

/**
 * Silent internal FYI to the team's notification channel (e.g. a webhook).
 *
 * This is NOT a human handoff and does NOT change the conversation — use
 * escalate_to_human for that. It reports honestly whether the alert was
 * actually sent, so the model never tells a visitor the team was notified when
 * no channel is configured or the send failed.
 */
export const notifyTeamTool = tool(
  async ({ summary }: { summary: string }) => {
    const { threadId } = getAgentTurnContext();
    const provider = notificationProviders.getDefault();
    if (!provider) {
      return "No notification channel is configured, so nothing was sent. Do NOT tell the visitor the team was notified.";
    }
    try {
      await provider.notify({ summary, referenceId: threadId });
      return "Internal alert sent to the team's channel. This is an FYI only — it does not hand the conversation to a human or guarantee a reply here.";
    } catch (error) {
      console.error("notify_team failed:", error);
      return "The internal alert could not be sent due to a system error. Do NOT tell the visitor the team was notified.";
    }
  },
  {
    name: "notify_team",
    description:
      "Send a silent internal FYI to the team's notification channel about something worth their awareness. This is NOT a human handoff and does not change the conversation or guarantee a reply — if the visitor wants to reach a person, use escalate_to_human instead. Never tell the visitor the team was notified unless this tool's result confirms the alert was sent.",
    schema: z.object({
      summary: z
        .string()
        .describe(
          "A concise summary of why the team should be aware and any relevant visitor context",
        ),
    }),
  },
);

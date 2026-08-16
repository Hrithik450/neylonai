import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { notificationProviders } from "@neylonai/integrations";
import { getAgentTurnContext } from "../agent-turn-context";

export const notifyTeamTool = tool(
  async ({ summary }: { summary: string }) => {
    console.log("notify_team called with summary:", summary);
    const { threadId } = getAgentTurnContext();
    const provider = notificationProviders.getDefault();
    if (provider) {
      await provider.notify({
        summary,
        referenceId: threadId,
      });
    }
    return "Team has been notified.";
  },
  {
    name: "notify_team",
    description:
      "Notify the workspace team about something important from this conversation — for example a demo request, urgent issue, or information the team should follow up on.",
    schema: z.object({
      summary: z
        .string()
        .describe(
          "A concise summary of why the team should be notified and any relevant visitor context",
        ),
    }),
  },
);

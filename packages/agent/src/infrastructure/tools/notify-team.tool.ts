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
    return "Team has been notified about this lead.";
  },
  {
    name: "notify_team",
    description:
      "Notify the Neylon AI sales team about a qualified lead. Call this when the user has provided their budget, timeline, or explicitly requested a demo — i.e. when there is enough information to qualify them as a serious lead.",
    schema: z.object({
      summary: z
        .string()
        .describe(
          "A concise summary of the lead including their name, company, interest, budget, and timeline if available",
        ),
    }),
  },
);

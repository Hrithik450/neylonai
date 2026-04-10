import { tool } from "@langchain/core/tools";
import { z } from "zod";

async function sendTeamNotification(summary: string, threadId?: string): Promise<void> {
  const webhookUrl = process.env.TEAM_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🚨 New Lead Alert\n\n${summary}${threadId ? `\n\nThread ID: ${threadId}` : ""}`,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("notify_team webhook failed:", error);
  }
}

let currentThreadId: string | undefined;

export function setNotifyToolThreadId(threadId: string | undefined) {
  currentThreadId = threadId;
}

export const notifyTeamTool = tool(
  async ({ summary }: { summary: string }) => {
    console.log("notify_team called with summary:", summary);
    await sendTeamNotification(summary, currentThreadId);
    return "Team has been notified about this lead.";
  },
  {
    name: "notify_team",
    description:
      "Notify the Neylon-AI sales team about a qualified lead. Call this when the user has provided their budget, timeline, or explicitly requested a demo — i.e. when there is enough information to qualify them as a serious lead.",
    schema: z.object({
      summary: z
        .string()
        .describe(
          "A concise summary of the lead including their name, company, interest, budget, and timeline if available",
        ),
    }),
  },
);

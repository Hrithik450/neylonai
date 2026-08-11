import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
  escalateConversation,
  getEngagementSettings,
  type EscalationTrigger,
} from "@neylonai/domain";
import { getAgentTurnContext } from "../agent-turn-context";

export const escalateToHumanTool = tool(
  async (input: {
    reason: string;
    trigger: EscalationTrigger;
    summary?: string;
  }) => {
    const escalateCtx = getAgentTurnContext();
    if (!escalateCtx.organizationId || !escalateCtx.threadId) {
      return "Escalation unavailable (missing conversation context).";
    }

    const settings = await getEngagementSettings(escalateCtx.organizationId);
    if (!settings.humanHandoffEnabled) {
      return "Human handoff is disabled for this workspace.";
    }

    const result = await escalateConversation({
      organizationId: escalateCtx.organizationId,
      threadId: escalateCtx.threadId,
      reason: input.reason,
      trigger: input.trigger,
      summary: input.summary,
      escalatedByAgentId: escalateCtx.agentId ?? "neylonai-chatbot",
      context: {
        agentName: "Support Agent",
      },
    });

    return [
      "Conversation escalated for team follow-up (not live chat).",
      `reference=${result.reference}`,
      "Reply to the customer with EXACTLY this message and nothing else:",
      "",
      result.customerMessage,
    ].join("\n");
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate this conversation for async team follow-up with context. Use when the visitor asks for a human, is frustrated, or you cannot safely help. Never claim a human is online or chatting live — only a short customer-safe reason and summary.",
    schema: z.object({
      reason: z
        .string()
        .describe("Short customer-safe reason for the escalation"),
      trigger: z.enum([
        "customer_request",
        "unhelpful",
        "frustration",
        "business_rule",
        "low_confidence",
        "configured",
      ]),
      summary: z
        .string()
        .optional()
        .describe("Concise conversation summary for the support team"),
    }),
  },
);

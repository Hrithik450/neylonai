import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { escalateConversation } from "@neylonai/domain/conversations";
import { getAgentTurnContext } from "../agent-turn-context";

/**
 * Real human handoff — the one action that actually reaches a person.
 *
 * Unlike an alert, this changes conversation state: it flags the thread for the
 * team, records it in the dashboard inbox, and stops the AI from answering on
 * the next turn. The visitor is NOT talking to a human yet — a person follows
 * up. The tool returns instructions for the model, not visitor-facing copy.
 */
export const escalateToHumanTool = tool(
  async ({ summary, contact }: { summary: string; contact?: string }) => {
    const { organizationId, threadId } = getAgentTurnContext();
    if (!organizationId || !threadId) {
      return "Handoff is unavailable right now because the conversation context is missing. Do NOT tell the visitor a human was contacted; ask them to try again in a moment.";
    }

    const trimmedContact = contact?.trim() || undefined;
    try {
      const result = await escalateConversation({
        organizationId,
        threadId,
        reason: "Visitor asked to reach a person on the team",
        trigger: "customer_request",
        summary,
        providedContact: trimmedContact,
      });

      if (result.contactRequired) {
        return "Handoff started — the conversation is now flagged for the team and a contact form has opened for the visitor. In your reply: confirm you're connecting them with a person, and ask them to share an email (or another way to reach them, e.g. LinkedIn or GitHub). Do NOT try to answer their original request yourself, and do NOT claim a human is online right now.";
      }
      return "Handoff complete — the conversation has been routed to the human team with the visitor's context. In your reply: let them know a person will review the conversation and follow up shortly. Do NOT keep trying to answer the request yourself, and do NOT claim a human is chatting live right now.";
    } catch (error) {
      console.error("escalate_to_human failed:", error);
      return "The handoff could not be completed due to a system error. Apologize briefly, ask the visitor to leave an email so the team can reach them, and do NOT claim a human has been notified.";
    }
  },
  {
    name: "escalate_to_human",
    description:
      "Hand this conversation off to a human on the workspace team. Use it whenever the visitor wants to talk to a person or the team, asks to be contacted, is clearly frustrated, or wants to discuss pricing, a partnership, collaboration, a demo, or a sales conversation with someone. If the visitor has already shared a way to reach them (email, LinkedIn, GitHub, phone…), pass it as `contact`. This performs the REAL handoff: it flags the conversation for the team, records it in their inbox, and stops the AI from answering further. It does not let you speak as a human.",
    schema: z.object({
      summary: z
        .string()
        .describe(
          "A concise summary of what the visitor needs and why they want a person, to brief the team.",
        ),
      contact: z
        .string()
        .optional()
        .describe(
          "Any contact detail the visitor has already provided in the chat — an email, LinkedIn/GitHub handle, phone number, etc. Omit if they have not shared one yet.",
        ),
    }),
  },
);

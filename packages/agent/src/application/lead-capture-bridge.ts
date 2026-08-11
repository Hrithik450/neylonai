import { getLeadAgentSettings } from "../agents/lead/settings";
import { upsertLeadRecord } from "../agents/lead/persistence";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

/**
 * Orchestrator bridge: when Lead Agent is enabled, persist obvious contact
 * fields from the user message via Lead Agent persistence. Does not live
 * inside the chatbot AgentDefinition.
 */
export async function maybeCaptureLeadFromUserMessage(input: {
  organizationId: string;
  threadId: string;
  userInput: string;
}): Promise<{ captured: boolean; leadId?: string }> {
  try {
    const settings = await getLeadAgentSettings(input.organizationId);
    if (!settings.enabled) return { captured: false };

    const allowed = new Set(settings.leadFields);
    const email = allowed.has("email")
      ? input.userInput.match(EMAIL_RE)?.[0]
      : undefined;
    const phone = allowed.has("phone")
      ? input.userInput.match(PHONE_RE)?.[0]?.replace(/\s+/g, " ").trim()
      : undefined;

    if (!email && !phone) return { captured: false };

    const result = await upsertLeadRecord(
      {
        email,
        phone,
        organization_id: input.organizationId,
        thread_id: input.threadId,
        source_agent_id: "lead",
        status: "new",
      },
      input.threadId,
    );
    return { captured: true, leadId: result.id };
  } catch (error) {
    console.error("[maybeCaptureLeadFromUserMessage]", error);
    return { captured: false };
  }
}

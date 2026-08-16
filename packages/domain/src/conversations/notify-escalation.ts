import { notificationProviders } from "@neylonai/integrations";

/**
 * Fire-and-forget alert after a conversation is escalated for follow-up.
 */
export async function notifyEscalation(input: {
  organizationId: string;
  threadId: string;
  reason: string;
  summary?: string | null;
}): Promise<void> {
  const lines = [
    `Thread: ${input.threadId}`,
    `Reason: ${input.reason}`,
    input.summary ? `Summary: ${input.summary}` : null,
  ].filter(Boolean);

  const summary = lines.join("\n");
  const title = "Conversation needs follow-up";

  try {
    const provider = notificationProviders.getDefault();
    if (provider) {
      await provider.notify({
        title,
        summary,
        referenceId: input.threadId,
      });
    }
  } catch (error) {
    console.error("[notifyEscalation] provider failed:", error);
  }
}

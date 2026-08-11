import { notificationProviders } from "@neylonai/integrations";
import { getWorkspaceSettings } from "../workspace/service";

/**
 * Fire-and-forget team alert after a conversation is escalated for follow-up.
 */
export async function notifyEscalation(input: {
  organizationId: string;
  reference: string;
  threadId: string;
  reason: string;
  assignedTeam: string | null;
  summary?: string | null;
}): Promise<void> {
  const lines = [
    `Reference: ${input.reference}`,
    `Thread: ${input.threadId}`,
    input.assignedTeam ? `Team: ${input.assignedTeam}` : null,
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
        referenceId: input.reference,
      });
    }
  } catch (error) {
    console.error("[notifyEscalation] provider failed:", error);
  }

  try {
    const workspace = await getWorkspaceSettings(input.organizationId);
    if (!workspace.webhookUrl) return;

    await fetch(workspace.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "conversation_escalated",
        title,
        text: `${title}\n\n${summary}`,
        reference: input.reference,
        threadId: input.threadId,
        organizationId: input.organizationId,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error("[notifyEscalation] workspace webhook failed:", error);
  }
}

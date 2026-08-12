import { NextResponse } from "next/server";
import { getConversationStateByThread } from "@neylonai/domain/conversations";

/**
 * Ensure the thread is bound to the API key's organization.
 * Threads without a conversation state are treated as not found (no cross-org leak).
 */
export async function assertThreadBelongsToOrg(
  threadId: string,
  organizationId: string,
): Promise<NextResponse | null> {
  const state = await getConversationStateByThread(threadId);
  if (!state || state.organizationId !== organizationId) {
    return NextResponse.json(
      { success: false, error: "Thread not found" },
      { status: 404 },
    );
  }
  return null;
}

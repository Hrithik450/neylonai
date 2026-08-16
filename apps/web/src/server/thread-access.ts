import { NextResponse } from "next/server";
import { getThreadOrganizationId } from "@neylonai/domain/conversations";

/**
 * Ensure the thread is bound to the API key's organization via its participant.
 */
export async function assertThreadBelongsToOrg(
  threadId: string,
  organizationId: string,
): Promise<NextResponse | null> {
  const orgId = await getThreadOrganizationId(threadId);
  if (!orgId || orgId !== organizationId) {
    return NextResponse.json(
      { success: false, error: "Thread not found" },
      { status: 404 },
    );
  }
  return null;
}

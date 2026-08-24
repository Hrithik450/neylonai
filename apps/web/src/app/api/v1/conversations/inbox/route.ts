import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import { loadConversationsInbox } from "@/components/dashboard/conversations/load-conversations-inbox";

/**
 * Dashboard inbox snapshot for client polling — same payload the page loads
 * server-side, so a conversation that just escalated surfaces without a reload.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
    const org = await getOrganizationForUser(session.id);
    if (!org) {
      return NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      );
    }

    const data = await loadConversationsInbox({
      organizationId: org.organizationId,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load inbox",
      },
      { status: 500 },
    );
  }
}

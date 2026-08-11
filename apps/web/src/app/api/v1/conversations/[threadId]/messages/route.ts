import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import { loadConversationMessages } from "@/components/dashboard/conversations/load-conversations-inbox";

type Params = { params: Promise<{ threadId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
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

    const { threadId } = await params;
    if (!threadId?.trim()) {
      return NextResponse.json(
        { success: false, error: "threadId required" },
        { status: 400 },
      );
    }

    const messages = await loadConversationMessages(
      org.organizationId,
      threadId.trim(),
    );
    if (!messages) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: { messages } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load messages",
      },
      { status: 500 },
    );
  }
}

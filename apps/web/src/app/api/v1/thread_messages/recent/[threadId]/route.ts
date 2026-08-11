import { NextRequest, NextResponse } from "next/server";
import { ThreadMessagesService } from "@neylonai/domain/chat";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";
import { assertThreadBelongsToOrg } from "@/server/thread-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const { threadId } = await params;
    const denied = await assertThreadBelongsToOrg(
      threadId,
      auth.organizationId,
    );
    if (denied) return denied;

    const result = await ThreadMessagesService.listRecentMessages(threadId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 },
    );
  }
}

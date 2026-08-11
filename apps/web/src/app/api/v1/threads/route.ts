import { NextRequest, NextResponse } from "next/server";
import { ThreadsService } from "@neylonai/domain/chat";
import { ensureConversationState } from "@neylonai/domain/conversations";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const body = await req.json();
    const { user_id, title } = body as { user_id?: string; title?: string };

    if (!user_id || !title) {
      return NextResponse.json(
        { success: false, error: "user_id and title are required" },
        { status: 400 },
      );
    }

    if (user_id.length > 128 || title.length > 200) {
      return NextResponse.json(
        { success: false, error: "user_id or title exceeds maximum length" },
        { status: 400 },
      );
    }

    const result = await ThreadsService.createThread({ user_id, title });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    await ensureConversationState({
      organizationId: auth.organizationId,
      threadId: result.data.id,
    });
    await ThreadsService.invalidateUserThreadCaches(
      user_id,
      auth.organizationId,
    );

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

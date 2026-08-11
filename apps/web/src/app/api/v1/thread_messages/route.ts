import { NextRequest, NextResponse } from "next/server";
import { ThreadMessagesService } from "@neylonai/domain/chat";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";
import { assertThreadBelongsToOrg } from "@/server/thread-access";

const ALLOWED_ROLES = new Set(["user", "assistant"]);

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const body = await req.json();
    const { thread_id, role, content } = body as {
      thread_id?: string;
      role?: string;
      content?: string;
    };

    if (!thread_id || !role || !content) {
      return NextResponse.json(
        { success: false, error: "thread_id, role, and content are required" },
        { status: 400 },
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { success: false, error: "role must be 'user' or 'assistant'" },
        { status: 400 },
      );
    }

    const denied = await assertThreadBelongsToOrg(
      thread_id,
      auth.organizationId,
    );
    if (denied) return denied;

    const result = await ThreadMessagesService.createMessage({
      thread_id,
      role,
      content,
      // Clients must not inject provenance; server owns metadata.
      metadata: {},
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    const publicMessage = result.data
      ? {
          id: result.data.id,
          thread_id: result.data.thread_id,
          role: result.data.role,
          content: result.data.content,
          created_at: result.data.created_at,
        }
      : undefined;

    return NextResponse.json(
      { success: true, data: publicMessage },
      { status: 201 },
    );
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

import { NextRequest, NextResponse } from "next/server";
import { ThreadMessagesService } from "@neylonai/domain/chat";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";
import { assertThreadBelongsToOrg } from "@/server/thread-access";
import { validateUUID, validateEnum, validateContent, InputValidationError } from "@/lib/input-validation";

const ALLOWED_ROLES = ["user", "assistant"] as const;

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

    let validatedThreadId: string;
    let validatedRole: typeof ALLOWED_ROLES[number];
    let validatedContent: string;

    try {
      validatedThreadId = validateUUID(thread_id, "thread_id");
      validatedRole = validateEnum(role, "role", ALLOWED_ROLES);
      validatedContent = validateContent(content, "content", 50000);
    } catch (error) {
      if (error instanceof InputValidationError) {
        return NextResponse.json(
          { success: false, error: error.errors[0]?.message || "Invalid input" },
          { status: 400 },
        );
      }
      throw error;
    }

    const denied = await assertThreadBelongsToOrg(
      validatedThreadId,
      auth.organizationId,
    );
    if (denied) return denied;

    const result = await ThreadMessagesService.createMessage({
      thread_id: validatedThreadId,
      role: validatedRole,
      content: validatedContent,
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

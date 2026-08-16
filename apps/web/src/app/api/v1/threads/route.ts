import { NextRequest, NextResponse } from "next/server";
import { ThreadsService } from "@neylonai/domain/chat";
import {
  ParticipantsService,
  parseChatUserPayload,
} from "@neylonai/domain/participants";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";
import { validateString, validateContent, InputValidationError } from "@/lib/input-validation";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const body = await req.json();
    const { user, title } = body as { user?: unknown; title?: string };

    const chatUser = parseChatUserPayload(user);
    if (!chatUser) {
      return NextResponse.json({ success: false, error: "valid user object is required" }, { status: 400 });
    }

    let validatedTitle: string;
    try {
      validatedTitle = validateString(title, "title", { minLength: 1, maxLength: 200 });
    } catch (error) {
      if (error instanceof InputValidationError) {
        return NextResponse.json(
          { success: false, error: error.errors[0]?.message || "Invalid title" },
          { status: 400 },
        );
      }
      throw error;
    }

    const ensured = await ParticipantsService.ensureParticipant(auth.organizationId, {
      externalId: chatUser.id,
      name: chatUser.name,
      email: chatUser.email,
      profileImage: chatUser.profile_image,
      anonymous: chatUser.anonymous ?? !chatUser.email,
    });
    if (!ensured.success || !ensured.data) {
      return NextResponse.json({ success: false, error: ensured.error ?? "Invalid participant" }, { status: 400 });
    }

    const result = await ThreadsService.createThread({
      organization_id: auth.organizationId,
      participant_id: ensured.data.id,
      title: validatedTitle,
    });

    if (!result.success || !result.data) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    await ThreadsService.invalidateParticipantThreadCaches(ensured.data.external_id, auth.organizationId);

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

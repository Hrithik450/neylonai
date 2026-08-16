import { NextRequest, NextResponse } from "next/server";
import { ThreadMessagesService } from "@neylonai/domain/chat";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";
import { assertThreadBelongsToOrg } from "@/server/thread-access";
import { and, eq } from "drizzle-orm";
import {
  db,
  organizationParticipants,
  threads,
} from "@neylonai/database";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const { threadId } = await params;
    const visitorId = req.nextUrl.searchParams.get("visitorId")?.trim();
    if (!visitorId) {
      return NextResponse.json(
        { success: false, error: "visitorId is required" },
        { status: 400 },
      );
    }
    const denied = await assertThreadBelongsToOrg(
      threadId,
      auth.organizationId,
    );
    if (denied) return denied;

    const [owned] = await db
      .select({ id: threads.id })
      .from(threads)
      .innerJoin(
        organizationParticipants,
        eq(threads.participant_id, organizationParticipants.id),
      )
      .where(
        and(
          eq(threads.id, threadId),
          eq(threads.organization_id, auth.organizationId),
          eq(organizationParticipants.external_id, visitorId),
        ),
      )
      .limit(1);
    if (!owned) {
      return NextResponse.json(
        { success: false, error: "Conversation not found" },
        { status: 404 },
      );
    }

    const result = await ThreadMessagesService.listMessagesPublic(threadId);

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

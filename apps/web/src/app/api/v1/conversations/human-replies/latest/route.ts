import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  organizationParticipants,
  threadMessages,
  threads,
} from "@neylonai/database";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;
    const visitorId = req.nextUrl.searchParams.get("visitorId")?.trim();
    if (!visitorId) {
      return NextResponse.json(
        { success: false, error: "visitorId is required" },
        { status: 400 },
      );
    }

    const [reply] = await db
      .select({
        messageId: threadMessages.id,
        threadId: threads.id,
        threadTitle: threads.title,
        content: threadMessages.content,
        createdAt: threadMessages.created_at,
      })
      .from(threadMessages)
      .innerJoin(threads, eq(threadMessages.thread_id, threads.id))
      .innerJoin(
        organizationParticipants,
        eq(threads.participant_id, organizationParticipants.id),
      )
      .where(
        and(
          eq(threads.organization_id, auth.organizationId),
          eq(organizationParticipants.external_id, visitorId),
          eq(threadMessages.role, "human"),
        ),
      )
      .orderBy(desc(threadMessages.created_at))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: reply
        ? {
            ...reply,
            createdAt: (reply.createdAt ?? new Date()).toISOString(),
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load replies",
      },
      { status: 500 },
    );
  }
}

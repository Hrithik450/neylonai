import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import {
  db,
  messageFeedback,
  organizationParticipants,
  threadMessages,
  threads,
} from "@neylonai/database";
import { recordKnowledgeGapEvent } from "@neylonai/domain/engagement";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";

type FeedbackBody = {
  messageId?: string;
  visitorId?: string;
  helpful?: boolean;
  comment?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;
    const body = (await req.json()) as FeedbackBody;
    if (
      !body.messageId?.trim() ||
      !body.visitorId?.trim() ||
      typeof body.helpful !== "boolean"
    ) {
      return NextResponse.json(
        { success: false, error: "messageId, visitorId and helpful are required" },
        { status: 400 },
      );
    }

    const [owned] = await db
      .select({
        messageId: threadMessages.id,
        participantId: organizationParticipants.id,
        threadId: threads.id,
        inReplyToMessageId: threadMessages.in_reply_to_message_id,
      })
      .from(threadMessages)
      .innerJoin(threads, eq(threadMessages.thread_id, threads.id))
      .innerJoin(
        organizationParticipants,
        eq(threads.participant_id, organizationParticipants.id),
      )
      .where(
        and(
          eq(threadMessages.id, body.messageId),
          eq(threads.organization_id, auth.organizationId),
          eq(organizationParticipants.external_id, body.visitorId),
          eq(threadMessages.role, "assistant"),
        ),
      )
      .limit(1);
    if (!owned) {
      return NextResponse.json(
        { success: false, error: "Message not found" },
        { status: 404 },
      );
    }

    const comment = body.comment?.trim().slice(0, 500) || null;
    const [saved] = await db
      .insert(messageFeedback)
      .values({
        organization_id: auth.organizationId,
        message_id: owned.messageId,
        participant_id: owned.participantId,
        helpful: body.helpful,
        comment,
      })
      .onConflictDoUpdate({
        target: [messageFeedback.message_id, messageFeedback.participant_id],
        set: {
          helpful: body.helpful,
          comment,
          updated_at: new Date(),
        },
      })
      .returning({
        helpful: messageFeedback.helpful,
        comment: messageFeedback.comment,
      });

    if (!body.helpful) {
      let sampleQuestion = comment ?? "";
      let pagePath: string | null = null;
      if (owned.inReplyToMessageId) {
        const [userMsg] = await db
          .select({
            content: threadMessages.content,
            pagePath: threadMessages.page_path,
          })
          .from(threadMessages)
          .where(eq(threadMessages.id, owned.inReplyToMessageId))
          .limit(1);
        if (userMsg?.content?.trim()) {
          sampleQuestion = userMsg.content.trim();
        }
        pagePath = userMsg?.pagePath ?? null;
      }
      void recordKnowledgeGapEvent({
        organizationId: auth.organizationId,
        gapType: "negative_feedback",
        sampleQuestion: sampleQuestion || "Negative feedback",
        messageId: owned.messageId,
        threadId: owned.threadId,
        participantId: owned.participantId,
        pagePath,
      });
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Feedback failed",
      },
      { status: 500 },
    );
  }
}

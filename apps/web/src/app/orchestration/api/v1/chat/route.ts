import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { streamConversation } from "@neylonai/agent";
import { ThreadMessagesService } from "@neylonai/domain/chat";
import {
  ApiAuthError,
  assertCanConsumeConversation,
  recordProductUsageSafe,
} from "@neylonai/domain/billing";
import { trackEventlySafe } from "@neylonai/integrations/evently";
import {
  isApiKeyAuthContext,
  requireApiKeyAuth,
} from "@/server/api-key-auth";
import { assertThreadBelongsToOrg } from "@/server/thread-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const body = await req.json();
    const { input, senderId, threadId } = body as {
      input: string;
      senderId?: string;
      threadId?: string;
    };

    if (!input) {
      return NextResponse.json(
        { success: false, error: "input is required" },
        { status: 400 },
      );
    }

    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const resolvedSenderId =
      typeof senderId === "string" && UUID_RE.test(senderId.trim())
        ? senderId.trim()
        : null;

    if (!resolvedSenderId && !threadId) {
      return NextResponse.json(
        { success: false, error: "senderId is required to start a conversation" },
        { status: 400 },
      );
    }

    await assertCanConsumeConversation(
      { organizationId: auth.organizationId, plan: auth.plan },
      auth.periodStart ?? undefined,
    );

    if (threadId) {
      const denied = await assertThreadBelongsToOrg(
        threadId,
        auth.organizationId,
      );
      if (denied) return denied;
    }

    const requestId = randomUUID();

    recordProductUsageSafe({
      organizationId: auth.organizationId,
      apiKeyId: auth.apiKeyId,
      metric: "conversation_turn",
      requestId,
      threadId: threadId ?? null,
      metadata: { plan: auth.plan },
    });

    trackEventlySafe({
      event: threadId ? "message_sent" : "conversation_started",
      organizationId: auth.organizationId,
      sessionId: resolvedSenderId ?? null,
      properties: { plan: auth.plan },
    });
    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (threadId) {
      const historyResult =
        await ThreadMessagesService.listRecentMessages(threadId, 20);
      if (historyResult.success && historyResult.data?.length) {
        conversationHistory = historyResult.data.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    }

    // Fallback: client-visible turns (covers races before DB persist settles).
    const clientHistory = Array.isArray(
      (body as { conversationHistory?: unknown }).conversationHistory,
    )
      ? (
          body as {
            conversationHistory: Array<{ role?: string; content?: string }>;
          }
        ).conversationHistory
          .map((m) => ({
            role: typeof m?.role === "string" ? m.role : "",
            content: typeof m?.content === "string" ? m.content : "",
          }))
          .filter(
            (m) =>
              (m.role === "user" || m.role === "assistant") &&
              m.content.trim().length > 0,
          )
          .slice(-20)
      : [];

    if (clientHistory.length > conversationHistory.length) {
      conversationHistory = clientHistory;
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamConversation({
            userInput: input,
            threadId: threadId ?? null,
            senderId: resolvedSenderId,
            organizationId: auth.organizationId,
            requestId,
            apiKeyId: auth.apiKeyId,
            conversationHistory,
          })) {
            controller.enqueue(encoder.encode(chunk));
          }
          trackEventlySafe({
            event: "message_received",
            organizationId: auth.organizationId,
            sessionId: resolvedSenderId ?? null,
          });
        } catch (error) {
          const errChunk =
            "data: " +
            JSON.stringify({
              event: "error",
              data: {
                error:
                  error instanceof Error ? error.message : "Streaming error",
              },
            }) +
            "\n\n";
          controller.enqueue(encoder.encode(errChunk));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

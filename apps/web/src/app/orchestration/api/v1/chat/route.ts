import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { streamConversation } from "@neylonai/agent";
import { ThreadMessagesService } from "@neylonai/domain/chat";
import {
  ParticipantsService,
  parseChatUserPayload,
} from "@neylonai/domain/participants";
import {
  ApiAuthError,
  assertCanConsumeConversation,
  recordProductUsageSafe,
} from "@neylonai/domain/billing";
import { isApiKeyAuthContext, requireApiKeyAuth } from "@/server/api-key-auth";
import { assertThreadBelongsToOrg } from "@/server/thread-access";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function normalizePageContext(body: Record<string, unknown>): {
  pagePath: string | null;
  pageQuery: Record<string, string>;
  pageSection: { sectionId: string; sectionLabel?: string | null } | null;
} {
  const rawPath = typeof body.pagePath === "string" ? body.pagePath.trim() : "";
  let pagePath: string | null = null;
  if (rawPath) {
    try {
      const parsed = new URL(rawPath, "https://widget.invalid");
      pagePath = `/${parsed.pathname
        .split("/")
        .filter(Boolean)
        .map((part) => encodeURIComponent(decodeURIComponent(part)))
        .join("/")}`.slice(0, 512);
      if (pagePath === "/") pagePath = "/";
    } catch {
      pagePath = null;
    }
  }

  const pageQuery: Record<string, string> = {};
  if (
    body.pageQuery &&
    typeof body.pageQuery === "object" &&
    !Array.isArray(body.pageQuery)
  ) {
    for (const [key, value] of Object.entries(
      body.pageQuery as Record<string, unknown>,
    ).slice(0, 10)) {
      if (!/^[a-zA-Z0-9_-]{1,40}$/.test(key) || typeof value !== "string") {
        continue;
      }
      const safe = value.trim();
      if (/^[a-zA-Z0-9 _.,/-]{1,120}$/.test(safe)) pageQuery[key] = safe;
    }
  }
  let pageSection: {
    sectionId: string;
    sectionLabel?: string | null;
  } | null = null;
  if (
    body.pageSection &&
    typeof body.pageSection === "object" &&
    !Array.isArray(body.pageSection)
  ) {
    const raw = body.pageSection as Record<string, unknown>;
    const sectionId =
      typeof raw.sectionId === "string" ? raw.sectionId.trim().slice(0, 96) : "";
    if (/^[a-z0-9_.:/-]+$/.test(sectionId)) {
      const sectionLabel =
        typeof raw.sectionLabel === "string"
          ? raw.sectionLabel.replace(/\s+/g, " ").trim().slice(0, 160)
          : "";
      pageSection = { sectionId, sectionLabel: sectionLabel || null };
    }
  }
  return { pagePath, pageQuery, pageSection };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req);
    if (!isApiKeyAuthContext(auth)) return auth;

    const body = (await req.json()) as Record<string, unknown>;
    const { input, user, threadId } = body as {
      input: string;
      user?: unknown;
      threadId?: string;
    };

    if (!input) {
      return NextResponse.json(
        { success: false, error: "input is required" },
        { status: 400 },
      );
    }

    const chatUser = parseChatUserPayload(user);
    const pageContext = normalizePageContext(body);
    if (!chatUser && !threadId) {
      return NextResponse.json(
        {
          success: false,
          error: "user.id is required to start a conversation",
        },
        { status: 400 },
      );
    }

    let participantId: string | null = null;
    let participantExternalId: string | null = chatUser?.id ?? null;

    if (chatUser) {
      const ensured = await ParticipantsService.ensureParticipant(
        auth.organizationId,
        {
          externalId: chatUser.id,
          name: chatUser.name,
          email: chatUser.email,
          profileImage: chatUser.profile_image,
          anonymous: chatUser.anonymous ?? !chatUser.email,
        },
      );
      if (!ensured.success || !ensured.data) {
        return NextResponse.json(
          { success: false, error: ensured.error ?? "Invalid participant" },
          { status: 400 },
        );
      }
      participantId = ensured.data.id;
      participantExternalId = ensured.data.external_id;
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

    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (threadId) {
      const historyResult = await ThreadMessagesService.listRecentMessages(
        threadId,
        20,
      );
      if (historyResult.success && historyResult.data?.length) {
        conversationHistory = historyResult.data.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamConversation({
            userInput: input,
            threadId: threadId ?? null,
            organizationId: auth.organizationId,
            participantId,
            participantExternalId,
            participantAnonymous: chatUser?.anonymous ?? true,
            participantName: chatUser?.name ?? null,
            participantEmail: chatUser?.email ?? null,
            pagePath: pageContext.pagePath,
            pageQuery: pageContext.pageQuery,
            pageSection: pageContext.pageSection,
            requestId,
            apiKeyId: auth.apiKeyId,
            conversationHistory,
          })) {
            controller.enqueue(encoder.encode(chunk));
          }

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

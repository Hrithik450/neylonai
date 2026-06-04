import { NextRequest, NextResponse } from "next/server";
import { streamAgentEvents } from "@/lib/agent/agent-stream";
import { ThreadMessagesService } from "@/actions/thread-messages/thread-messages.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
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

    let conversationHistory: Array<{ role: string; content: string }> = [];
    if (senderId && threadId) {
      const historyResult = await ThreadMessagesService.listRecentMessages(threadId);
      if (historyResult.success && historyResult.data) {
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
          for await (const chunk of streamAgentEvents(
            input,
            threadId ?? null,
            senderId ?? null,
            conversationHistory,
          )) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          const errChunk = JSON.stringify({
            event: "error",
            data: {
              error:
                error instanceof Error ? error.message : "Streaming error",
            },
          }) + "<|END_OF_EVENT|>";
          controller.enqueue(encoder.encode(errChunk));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

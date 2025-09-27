import { MessagesService } from "@/actions/thread_messages/thread_messages.service";
import { Message } from "@/actions/thread_messages/thread_messages.types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data: Partial<Message> = await request.json();
    const response = await MessagesService.createMessage(data);

    if (!response.success) {
      return NextResponse.json({ error: response.error }, { status: 400 });
    }

    return NextResponse.json(response.data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create message",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (threadId) {
      const response = await MessagesService.getMessagesByThreadId(threadId);
      return NextResponse.json(response);
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch thread_messages",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get("threadId");

    if (!threadId) {
      return NextResponse.json(
        { error: "threadId is required" },
        { status: 400 }
      );
    }

    const response = await MessagesService.deleteMessagesByThreadId(threadId);

    if (!response) {
      return NextResponse.json({ error: response }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete messages of thread_id",
      },
      { status: 500 }
    );
  }
}

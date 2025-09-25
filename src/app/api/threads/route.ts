import { ThreadsService } from "@/actions/threads/threads.service";
import { Thread } from "@/actions/threads/threads.types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data: Partial<Thread> = await request.json();
    const response = await ThreadsService.createThread(data);

    if (!response.success) {
      return NextResponse.json({ error: response.error }, { status: 400 });
    }

    return NextResponse.json(response.data, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create thread",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
      const response = await ThreadsService.listThreadsByUserId(userId);
      return NextResponse.json(response);
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch threads",
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

    const response = await ThreadsService.deleteThread(threadId);

    if (!response) {
      return NextResponse.json({ error: response }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete thread",
      },
      { status: 500 }
    );
  }
}

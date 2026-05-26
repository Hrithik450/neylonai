import { NextRequest, NextResponse } from "next/server";
import { ThreadMessagesService } from "@/actions/thread-messages/thread-messages.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { thread_id, role, content } = body;

    if (!thread_id || !role || !content) {
      return NextResponse.json(
        { success: false, error: "thread_id, role, and content are required" },
        { status: 400 },
      );
    }

    const result = await ThreadMessagesService.createMessage({ thread_id, role, content });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

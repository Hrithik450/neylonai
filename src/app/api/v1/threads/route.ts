import { NextRequest, NextResponse } from "next/server";
import { ThreadsService } from "@/actions/threads/threads.service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, title } = body;

    if (!user_id || !title) {
      return NextResponse.json(
        { success: false, error: "user_id and title are required" },
        { status: 400 },
      );
    }

    const result = await ThreadsService.createThread({ user_id, title });

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

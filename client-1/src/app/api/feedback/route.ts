import { FeedbackService } from "@/actions/feedback/feedback.service";
import { NewFeedback } from "@/actions/feedback/feedback.types";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data: NewFeedback = await request.json();
    const response = await FeedbackService.createFeedback(data);

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
    const userId = searchParams.get("userId");
    const feedbackId = searchParams.get("feedbackId");

    if (feedbackId) {
      const response = await FeedbackService.getFeedbackById(feedbackId);
      return NextResponse.json(response, { status: 200 });
    }

    if (userId) {
      const response = await FeedbackService.getFeedbackByUserId(userId);
      return NextResponse.json(response, { status: 200 });
    }

    const response = await FeedbackService.listAllFeedbacks();
    return NextResponse.json(response, { status: 200 });
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

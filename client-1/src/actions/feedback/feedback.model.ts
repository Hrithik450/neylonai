import { db } from "@/lib/db";
import { Feedback, NewFeedback } from "@/actions/feedback/feedback.types";
import { feedback } from "@/lib/drizzle/schema";
import { revalidateTag, unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";

export class FeedbackModel {
  static async createFeedback(data: NewFeedback): Promise<Feedback> {
    const [feedback_data] = await db.insert(feedback).values(data).returning();
    revalidateTag(`feedback:${feedback.user_id}`);
    return feedback_data;
  }

  static async getFeedbackById(feedback_id: string): Promise<Feedback | null> {
    const cachedFn = unstable_cache(
      async () => {
        return await db
          .select()
          .from(feedback)
          .where(eq(feedback.id, feedback_id));
      },
      [feedback_id],
      {
        tags: [`feedback:${feedback_id}`],
        revalidate: 3600,
      }
    );

    const [thread] = await cachedFn();
    return thread || null;
  }

  static async getFeedbackByUserId(userId: string): Promise<Feedback[]> {
    return await db.select().from(feedback).where(eq(feedback.user_id, userId));
  }

  static async listAllFeedbacks(): Promise<Feedback[]> {
    return await db.select().from(feedback);
  }
}

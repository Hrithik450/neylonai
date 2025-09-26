import { db } from "@/lib/db";
import { threadMessages } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import {
  Message,
  NewMessage,
} from "@/actions/thread_messages/thread_messages.types";
import { unstable_cache } from "next/cache";

export class MessagesModel {
  static async createMessage(data: NewMessage): Promise<Message> {
    const [message] = await db.insert(threadMessages).values(data).returning();
    return message;
  }

  static async getMessageById(id: string): Promise<Message | null> {
    const [message] = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.id, id));
    return message || null;
  }

  static async getMessageByThreadId(threadId: string) {
    const cachedMessages = unstable_cache(
      async () => {
        try {
          return await db
            .select()
            .from(threadMessages)
            .where(eq(threadMessages.thread_id, threadId));
        } catch (error) {
          return [];
        }
      },
      [threadId],
      {
        revalidate: 10,
        tags: [`thread-${threadId}`],
      }
    );

    return await cachedMessages();
  }

  static async deleteMessagesByThreadId(threadId: string): Promise<boolean> {
    const result = await db
      .delete(threadMessages)
      .where(eq(threadMessages.thread_id, threadId));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

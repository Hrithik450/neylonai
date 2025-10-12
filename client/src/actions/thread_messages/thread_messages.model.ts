import { db } from "@/lib/db";
import { threadMessages } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import {
  Message,
  NewMessage,
} from "@/actions/thread_messages/thread_messages.types";

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

  static async listMessagesByThreadId(
    threadId: string
  ): Promise<Message[] | []> {
    // const cacheKey = `thread:${threadId}:thread_messages`;

    // const cachedValue = await redis.get(cacheKey);
    // console.log(cachedValue);
    // if (cachedValue) {
    //   try {
    //     const cachedData = JSON.parse(cachedValue);
    //     return cachedData;
    //   } catch (error) {
    //     console.error("Error parsing in the cached thread_messages: ", error);
    //   }
    // }

    // Fetch from DB if not cached
    const thread_messages = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.threadId, threadId));

    // await redis.set(cacheKey, JSON.stringify(thread_messages), "EX", 3600);
    return thread_messages;
  }

  static async deleteMessagesByThreadId(threadId: string): Promise<boolean> {
    const result = await db
      .delete(threadMessages)
      .where(eq(threadMessages.threadId, threadId));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

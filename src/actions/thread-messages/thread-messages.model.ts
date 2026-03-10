import { db } from "@/lib/db";
import { threadMessages } from "@/lib/drizzle/schema";
import { eq, asc, desc } from "drizzle-orm";
import type { ThreadMessage, CreateThreadMessageInput } from "./thread-messages.types";

function rowToMessage(row: typeof threadMessages.$inferSelect): ThreadMessage {
  return {
    id: row.id,
    thread_id: row.thread_id,
    role: row.role,
    content: row.content,
    created_at: row.created_at!.toISOString(),
  };
}

export class ThreadMessagesModel {
  static async createMessage(data: CreateThreadMessageInput): Promise<ThreadMessage> {
    const [row] = await db
      .insert(threadMessages)
      .values(data)
      .returning();
    return rowToMessage(row);
  }

  static async listMessages(threadId: string): Promise<ThreadMessage[]> {
    const rows = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.thread_id, threadId))
      .orderBy(asc(threadMessages.created_at));
    return rows.map(rowToMessage);
  }

  static async listRecentMessages(
    threadId: string,
    limit: number = 8,
  ): Promise<ThreadMessage[]> {
    const rows = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.thread_id, threadId))
      .orderBy(desc(threadMessages.created_at))
      .limit(limit);
    return rows.reverse().map(rowToMessage);
  }
}

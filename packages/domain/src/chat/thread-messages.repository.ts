import { db, schema } from "@neylonai/database";
import { eq, asc, desc } from "drizzle-orm";
import type {
  ThreadMessage,
  CreateThreadMessageInput,
} from "./thread-messages.types";

const { threadMessages } = schema;

function rowToMessage(
  row: typeof threadMessages.$inferSelect,
): ThreadMessage {
  return {
    id: row.id,
    thread_id: row.thread_id,
    role: row.role,
    content: row.content,
    in_reply_to_message_id: row.in_reply_to_message_id ?? null,
    page_path: row.page_path ?? null,
    page_query: {},
    created_at: row.created_at!.toISOString(),
  };
}

export class ThreadMessagesRepository {
  static async createMessage(
    data: CreateThreadMessageInput,
  ): Promise<ThreadMessage> {
    const [row] = await db
      .insert(threadMessages)
      .values({
        ...(data.id ? { id: data.id } : {}),
        thread_id: data.thread_id,
        role: data.role,
        content: data.content,
        in_reply_to_message_id: data.in_reply_to_message_id ?? null,
        page_path: data.page_path ?? null,
      })
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

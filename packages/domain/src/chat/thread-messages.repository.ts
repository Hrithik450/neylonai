import { db, schema } from "@neylonai/database";
import { eq, asc, desc } from "drizzle-orm";
import type {
  ThreadMessage,
  CreateThreadMessageInput,
} from "./thread-messages.types";

const { threadMessages } = schema;

function rowToMessage(
  row: typeof threadMessages.$inferSelect,
  opts?: { includeMetadata?: boolean },
): ThreadMessage {
  const includeMetadata = opts?.includeMetadata !== false;
  return {
    id: row.id,
    thread_id: row.thread_id,
    role: row.role,
    content: row.content,
    agent_id: row.agent_id ?? null,
    ...(includeMetadata
      ? {
          metadata: (row.metadata ?? {}) as Record<string, unknown>,
        }
      : {}),
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
        thread_id: data.thread_id,
        role: data.role,
        content: data.content,
        agent_id: data.agent_id ?? null,
        metadata: data.metadata ?? {},
      })
      .returning();
    return rowToMessage(row);
  }

  static async listMessages(
    threadId: string,
    opts?: { includeMetadata?: boolean },
  ): Promise<ThreadMessage[]> {
    const rows = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.thread_id, threadId))
      .orderBy(asc(threadMessages.created_at));
    return rows.map((row) => rowToMessage(row, opts));
  }

  static async listRecentMessages(
    threadId: string,
    limit: number = 8,
    opts?: { includeMetadata?: boolean },
  ): Promise<ThreadMessage[]> {
    const rows = await db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.thread_id, threadId))
      .orderBy(desc(threadMessages.created_at))
      .limit(limit);
    return rows.reverse().map((row) => rowToMessage(row, opts));
  }
}

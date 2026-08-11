import { db, schema, conversationStates } from "@neylonai/database";
import { and, eq, desc } from "drizzle-orm";
import type { Thread, CreateThreadInput, UpdateThreadInput } from "./threads.types";

const { threads } = schema;

function rowToThread(row: typeof threads.$inferSelect): Thread {
  return {
    id: row.id,
    user: row.user_id,
    title: row.title,
    created_at: row.created_at!.toISOString(),
  };
}

export class ThreadsRepository {
  static async createThread(data: CreateThreadInput): Promise<Thread> {
    const [row] = await db
      .insert(threads)
      .values({ user_id: data.user_id, title: data.title })
      .returning();
    return rowToThread(row);
  }

  static async getThreadById(threadId: string): Promise<Thread | null> {
    const [row] = await db
      .select()
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1);
    return row ? rowToThread(row) : null;
  }

  static async listThreadsByUser(userId: string): Promise<Thread[]> {
    const rows = await db
      .select()
      .from(threads)
      .where(eq(threads.user_id, userId))
      .orderBy(desc(threads.created_at));
    return rows.map(rowToThread);
  }

  /**
   * Threads for a user that belong to the API key's organization
   * (via conversation_states.organization_id). Never returns cross-tenant rows.
   */
  static async listThreadsByUserForOrg(
    userId: string,
    organizationId: string,
  ): Promise<Thread[]> {
    const rows = await db
      .select({
        id: threads.id,
        user_id: threads.user_id,
        title: threads.title,
        created_at: threads.created_at,
      })
      .from(threads)
      .innerJoin(
        conversationStates,
        eq(conversationStates.thread_id, threads.id),
      )
      .where(
        and(
          eq(threads.user_id, userId),
          eq(conversationStates.organization_id, organizationId),
        ),
      )
      .orderBy(desc(threads.created_at));

    return rows.map((row) =>
      rowToThread({
        id: row.id,
        user_id: row.user_id,
        title: row.title,
        created_at: row.created_at,
      }),
    );
  }

  static async updateThread(
    threadId: string,
    data: UpdateThreadInput,
  ): Promise<Thread | null> {
    const [row] = await db
      .update(threads)
      .set(data)
      .where(eq(threads.id, threadId))
      .returning();
    return row ? rowToThread(row) : null;
  }

  static async deleteThread(threadId: string): Promise<boolean> {
    const result = await db
      .delete(threads)
      .where(eq(threads.id, threadId))
      .returning();
    return result.length > 0;
  }
}

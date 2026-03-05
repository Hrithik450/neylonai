import { db } from "@/lib/db";
import { threads } from "@/lib/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { Thread, CreateThreadInput, UpdateThreadInput } from "./threads.types";

function rowToThread(row: typeof threads.$inferSelect): Thread {
  return {
    id: row.id,
    user: row.user_id,
    title: row.title,
    created_at: row.created_at!.toISOString(),
  };
}

export class ThreadsModel {
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

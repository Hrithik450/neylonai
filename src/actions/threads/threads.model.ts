import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { thread as db_thread } from "@/lib/drizzle/schema";
import { Thread, NewThread } from "@/actions/threads/threads.types";
import { revalidateTag, unstable_cache } from "next/cache";

export class ThreadsModel {
  static async createThread(data: NewThread): Promise<Thread> {
    const [thread] = await db.insert(db_thread).values(data).returning();
    revalidateTag(`threads:${thread.user_id}`);
    return thread;
  }

  static async updateThread(
    id: string,
    data: Partial<NewThread>
  ): Promise<Thread | null> {
    const [thread] = await db
      .update(db_thread)
      .set({ ...data })
      .where(eq(db_thread.id, id))
      .returning();
    revalidateTag(`thread:${thread.user_id}`);
    return thread || null;
  }

  static async getThreadById(id: string): Promise<Thread | null> {
    const cachedFn = unstable_cache(
      async () => {
        return await db.select().from(db_thread).where(eq(db_thread.id, id));
      },
      [id],
      {
        tags: [`thread:${id}`],
        revalidate: 3600,
      }
    );

    const [thread] = await cachedFn();
    return thread || null;
  }

  static async listThreadsByUserId(userId: string): Promise<Thread[]> {
    const cachedFn = unstable_cache(
      async () => {
        return await db.query.thread.findMany({
          where: (db_thread, { eq }) => eq(db_thread.user_id, userId),
          orderBy: (db_thread, { desc }) => desc(db_thread.created_at),
        });
      },
      [userId],
      {
        tags: [`threads:${userId}`],
        revalidate: 3600,
      }
    );

    const cached_threads = await cachedFn();
    return cached_threads;
  }

  static async listThreads(): Promise<Thread[]> {
    return await db.select().from(db_thread);
  }

  static async deleteThread(id: string): Promise<boolean> {
    const result = await db.delete(db_thread).where(eq(db_thread.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

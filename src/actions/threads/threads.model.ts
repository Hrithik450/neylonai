import { db } from "@/lib/db";
import { threads } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import { Thread, NewThread } from "@/actions/threads/threads.types";

export class ThreadsModel {
  static async createThread(data: NewThread): Promise<Thread> {
    const [chat] = await db.insert(threads).values(data).returning();
    return chat;
  }

  static async updateThread(
    id: string,
    data: Partial<NewThread>
  ): Promise<Thread | null> {
    const [thread] = await db
      .update(threads)
      .set({ ...data })
      .where(eq(threads.id, id))
      .returning();
    return thread || null;
  }

  static async getThreadById(id: string): Promise<Thread | null> {
    const [chat] = await db.select().from(threads).where(eq(threads.id, id));
    return chat || null;
  }

  static async listThreadsByUserId(userId: string): Promise<Thread[]> {
    const threads = await db.query.threads.findMany({
      where: (threads, { eq }) => eq(threads.userId, userId),
    });
    return threads;
  }

  static async listThreads(): Promise<Thread[]> {
    return await db.select().from(threads);
  }

  static async deleteThread(id: string): Promise<boolean> {
    const result = await db.delete(threads).where(eq(threads.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

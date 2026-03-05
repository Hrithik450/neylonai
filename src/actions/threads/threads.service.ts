import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { ThreadsModel } from "./threads.model";
import type {
  CreateThreadInput,
  UpdateThreadInput,
  ThreadResponse,
  ThreadsResponse,
} from "./threads.types";

export class ThreadsService {
  static async createThread(data: CreateThreadInput): Promise<ThreadResponse> {
    try {
      const thread = await ThreadsModel.createThread(data);
      await cacheDel(`user:${data.user_id}:user_threads`);
      return { success: true, data: thread };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create thread",
      };
    }
  }

  static async getThreadById(threadId: string): Promise<ThreadResponse> {
    try {
      const cacheKey = `thread:${threadId}:user_thread`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const thread = await ThreadsModel.getThreadById(threadId);
      if (!thread) return { success: false, error: `Thread ${threadId} not found` };

      await cacheSet(cacheKey, JSON.stringify(thread));
      return { success: true, data: thread };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch thread",
      };
    }
  }

  static async listThreads(userId: string): Promise<ThreadsResponse> {
    try {
      const cacheKey = `user:${userId}:user_threads`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const threads = await ThreadsModel.listThreadsByUser(userId);
      await cacheSet(cacheKey, JSON.stringify(threads));
      return { success: true, data: threads };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch threads",
      };
    }
  }

  static async updateThread(
    threadId: string,
    data: UpdateThreadInput,
  ): Promise<ThreadResponse> {
    try {
      const thread = await ThreadsModel.updateThread(threadId, data);
      if (!thread) return { success: false, error: `Thread ${threadId} not found` };

      await cacheDel(`thread:${threadId}:user_thread`);
      return { success: true, data: thread };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update thread",
      };
    }
  }
}

import { cacheGet, cacheSet, cacheDel } from "@neylonai/database";
import { ThreadsRepository } from "./threads.repository";
import type {
  CreateThreadInput,
  UpdateThreadInput,
  ThreadResponse,
  ThreadsResponse,
} from "./threads.types";

export class ThreadsService {
  static async createThread(data: CreateThreadInput): Promise<ThreadResponse> {
    try {
      const thread = await ThreadsRepository.createThread(data);
      await cacheDel(`user:${data.user_id}:user_threads`);
      return { success: true, data: thread };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create thread",
      };
    }
  }

  /** Drop cached thread lists after a new thread is bound to an org. */
  static async invalidateUserThreadCaches(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    await cacheDel(`user:${userId}:user_threads`);
    await cacheDel(`user:${userId}:org:${organizationId}:user_threads`);
  }

  static async getThreadById(threadId: string): Promise<ThreadResponse> {
    try {
      const cacheKey = `thread:${threadId}:user_thread`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const thread = await ThreadsRepository.getThreadById(threadId);
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

      const threadList = await ThreadsRepository.listThreadsByUser(userId);
      await cacheSet(cacheKey, JSON.stringify(threadList));
      return { success: true, data: threadList };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch threads",
      };
    }
  }

  /** Tenant-scoped list for API-key authenticated embeds. */
  static async listThreadsForOrg(
    userId: string,
    organizationId: string,
  ): Promise<ThreadsResponse> {
    try {
      const cacheKey = `user:${userId}:org:${organizationId}:user_threads`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const threadList = await ThreadsRepository.listThreadsByUserForOrg(
        userId,
        organizationId,
      );
      await cacheSet(cacheKey, JSON.stringify(threadList));
      return { success: true, data: threadList };
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
      const thread = await ThreadsRepository.updateThread(threadId, data);
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

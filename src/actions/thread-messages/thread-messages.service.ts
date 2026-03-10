import { cacheGet, cacheSet, cacheDel } from "@/lib/redis";
import { ThreadMessagesModel } from "./thread-messages.model";
import type {
  CreateThreadMessageInput,
  ThreadMessageResponse,
  ThreadMessagesResponse,
} from "./thread-messages.types";

export class ThreadMessagesService {
  static async createMessage(
    data: CreateThreadMessageInput,
  ): Promise<ThreadMessageResponse> {
    try {
      const message = await ThreadMessagesModel.createMessage(data);
      await cacheDel(`thread:${data.thread_id}:thread_messages`);
      await cacheDel(`thread:${data.thread_id}:recent_thread_messages`);
      return { success: true, data: message };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save message",
      };
    }
  }

  static async listMessages(threadId: string): Promise<ThreadMessagesResponse> {
    try {
      const cacheKey = `thread:${threadId}:thread_messages`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const messages = await ThreadMessagesModel.listMessages(threadId);
      await cacheSet(cacheKey, JSON.stringify(messages));
      return { success: true, data: messages };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch messages",
      };
    }
  }

  static async listRecentMessages(threadId: string): Promise<ThreadMessagesResponse> {
    try {
      const cacheKey = `thread:${threadId}:recent_thread_messages`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const messages = await ThreadMessagesModel.listRecentMessages(threadId);
      await cacheSet(cacheKey, JSON.stringify(messages));
      return { success: true, data: messages };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch recent messages",
      };
    }
  }
}

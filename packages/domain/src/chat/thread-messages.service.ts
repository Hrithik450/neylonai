import { cacheGet, cacheSet, cacheDel } from "@neylonai/database";
import { ThreadMessagesRepository } from "./thread-messages.repository";
import type {
  CreateThreadMessageInput,
  ThreadMessage,
  ThreadMessageResponse,
  ThreadMessagesResponse,
} from "./thread-messages.types";

function forPublicClient(messages: ThreadMessage[]): ThreadMessage[] {
  return messages.map((m) => ({
    id: m.id,
    thread_id: m.thread_id,
    role: m.role,
    content: m.content,
    created_at: m.created_at,
  }));
}

async function invalidateMessageCaches(threadId: string): Promise<void> {
  await cacheDel(`thread:${threadId}:thread_messages`);
  await cacheDel(`thread:${threadId}:thread_messages:dash`);
  await cacheDel(`thread:${threadId}:thread_messages:public`);
  await cacheDel(`thread:${threadId}:recent_thread_messages`);
  await cacheDel(`thread:${threadId}:recent_thread_messages:8`);
  await cacheDel(`thread:${threadId}:recent_thread_messages:20`);
  await cacheDel(`thread:${threadId}:recent_thread_messages:public:8`);
  await cacheDel(`thread:${threadId}:recent_thread_messages:public:20`);
}

export class ThreadMessagesService {
  static async createMessage(
    data: CreateThreadMessageInput,
  ): Promise<ThreadMessageResponse> {
    try {
      const message = await ThreadMessagesRepository.createMessage(data);
      await invalidateMessageCaches(data.thread_id);
      return { success: true, data: message };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save message",
      };
    }
  }

  /**
   * Full messages including provenance metadata — dashboard / internal only.
   */
  static async listMessages(threadId: string): Promise<ThreadMessagesResponse> {
    try {
      const cacheKey = `thread:${threadId}:thread_messages:dash`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const messages = await ThreadMessagesRepository.listMessages(threadId, {
        includeMetadata: true,
      });
      await cacheSet(cacheKey, JSON.stringify(messages));
      return { success: true, data: messages };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch messages",
      };
    }
  }

  /**
   * Public/widget listing — content only, never provenance or private source ids.
   */
  static async listMessagesPublic(
    threadId: string,
  ): Promise<ThreadMessagesResponse> {
    try {
      const cacheKey = `thread:${threadId}:thread_messages:public`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const messages = forPublicClient(
        await ThreadMessagesRepository.listMessages(threadId, {
          includeMetadata: false,
        }),
      );
      await cacheSet(cacheKey, JSON.stringify(messages));
      return { success: true, data: messages };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch messages",
      };
    }
  }

  static async listRecentMessages(
    threadId: string,
    limit = 8,
  ): Promise<ThreadMessagesResponse> {
    try {
      const cacheKey = `thread:${threadId}:recent_thread_messages:public:${limit}`;
      const cached = await cacheGet(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const messages = forPublicClient(
        await ThreadMessagesRepository.listRecentMessages(threadId, limit, {
          includeMetadata: false,
        }),
      );
      await cacheSet(cacheKey, JSON.stringify(messages));
      return { success: true, data: messages };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch recent messages",
      };
    }
  }
}

import { ThreadsModel } from "@/actions/threads/threads.model";
import {
  Thread,
  ThreadResponse,
  ThreadsResponse,
  threadSchema,
} from "@/actions/threads/threads.types";

export class ThreadsService {
  static async createThread(data: Partial<Thread>): Promise<ThreadResponse> {
    try {
      const validatedData = threadSchema.parse(data);

      const thread = await ThreadsModel.createThread(validatedData);
      return {
        success: true,
        data: thread,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create thread",
      };
    }
  }

  static async updateThread(
    id: string,
    data: Partial<Thread>
  ): Promise<ThreadResponse> {
    try {
      const validatedData = threadSchema.partial().parse(data);

      const thread = await ThreadsModel.updateThread(id, validatedData);
      if (!thread)
        return {
          success: false,
          error: "Thread not found",
        };

      return {
        success: true,
        data: thread,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update thread",
      };
    }
  }

  static async getThreadById(id: string): Promise<ThreadResponse> {
    try {
      const thread = await ThreadsModel.getThreadById(id);
      if (!thread)
        return {
          success: false,
          error: "Thread not found",
        };

      return {
        success: true,
        data: thread,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get thread",
      };
    }
  }

  static async listThreadsByUserId(userId: string): Promise<ThreadsResponse> {
    try {
      const threads = await ThreadsModel.listThreadsByUserId(userId);
      return {
        success: true,
        data: threads,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get threads",
      };
    }
  }

  static async deleteThread(id: string): Promise<ThreadResponse> {
    try {
      const success = await ThreadsModel.deleteThread(id);
      if (!success)
        return {
          success: false,
          error: "Thread not found",
        };

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Thread to delete chat",
      };
    }
  }
}

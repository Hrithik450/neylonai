import { MessagesModel } from "@/actions/thread_messages/thread_messages.model";
import {
  Message,
  MessageResponse,
  messageSchema,
  MessagesResponse,
} from "@/actions/thread_messages/thread_messages.types";

export class MessagesService {
  static async createMessage(data: Partial<Message>): Promise<MessageResponse> {
    try {
      const validatedData = messageSchema.parse(data);

      const message = await MessagesModel.createMessage(validatedData);
      return {
        success: true,
        data: message,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create message",
      };
    }
  }

  static async getMessageById(id: string): Promise<MessageResponse> {
    try {
      const message = await MessagesModel.getMessageById(id);
      if (!message) {
        return {
          success: false,
          error: "Message not found",
        };
      }
      return {
        success: true,
        data: message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get message",
      };
    }
  }

  static async getMessagesByThreadId(
    threadId: string
  ): Promise<MessagesResponse> {
    try {
      const messages = await MessagesModel.listMessagesByThreadId(threadId);
      return {
        success: true,
        data: messages,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to list messages",
      };
    }
  }

  static async deleteMessagesByThreadId(
    threadId: string
  ): Promise<MessageResponse> {
    try {
      const success = await MessagesModel.deleteMessagesByThreadId(threadId);
      if (!success) {
        return {
          success: false,
          error: "Messages not found",
        };
      }
      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete messages",
      };
    }
  }
}

import { threadMessages } from "@/lib/drizzle/schema";
import { z } from "zod";

export type Message = typeof threadMessages.$inferSelect;
export type NewMessage = typeof threadMessages.$inferInsert;

export const messageSchema = z.object({
  threadId: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export type MessageResponse = {
  success: boolean;
  data?: Message;
  error?: string;
};

export type MessagesResponse = {
  success: boolean;
  data?: Message[];
  error?: string;
};

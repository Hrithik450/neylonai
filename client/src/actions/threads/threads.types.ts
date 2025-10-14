import { thread } from "@/lib/drizzle/schema";
import { z } from "zod";

export type Thread = typeof thread.$inferSelect;
export type NewThread = typeof thread.$inferInsert;

export const threadSchema = z.object({
  user_id: z.string().uuid(),
  title: z.string(),
});

export type ThreadResponse = {
  success: boolean;
  data?: Thread;
  error?: string;
};

export type ThreadsResponse = {
  success: boolean;
  data?: Thread[];
  error?: string;
};

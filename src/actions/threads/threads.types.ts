import { threads } from "@/lib/drizzle/schema";
import { z } from "zod";

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;

export const threadSchema = z.object({
  userId: z.string().uuid(),
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

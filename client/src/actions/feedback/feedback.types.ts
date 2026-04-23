import { feedback } from "@/lib/drizzle/schema";
import { z } from "zod";

export type Feedback = typeof feedback.$inferSelect;
export type NewFeedback = typeof feedback.$inferInsert;

export const feedbackSchema = z.object({
  user_id: z.number().min(1, "Invalid user ID format."),
  user_name: z.string().min(1, "User name is required."),
  content: z
    .string()
    .trim()
    .min(5, "Feedback must be at least 5 characters long.")
    .max(500, "Feedback cannot exceed 500 characters."),
});

export type FeedbackFormData = z.infer<typeof feedbackSchema>;

export type FeedbackResponse = {
  success: boolean;
  data?: Feedback;
  error?: string;
};

export type FeedbacksResponse = {
  success: boolean;
  data?: Feedback[];
  error?: string;
};

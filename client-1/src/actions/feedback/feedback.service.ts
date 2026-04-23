import {
  FeedbackResponse,
  feedbackSchema,
  FeedbacksResponse,
  NewFeedback,
} from "@/actions/feedback/feedback.types";
import { FeedbackModel } from "@/actions/feedback/feedback.model";

export class FeedbackService {
  static async createFeedback(data: NewFeedback): Promise<FeedbackResponse> {
    try {
      const validatedData = feedbackSchema.parse(data);

      const feedback = await FeedbackModel.createFeedback(validatedData);
      return {
        success: true,
        data: feedback,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create feedback",
      };
    }
  }

  static async getFeedbackById(id: string): Promise<FeedbackResponse> {
    try {
      const feedback = await FeedbackModel.getFeedbackById(id);
      if (!feedback)
        return {
          success: false,
          error: "Feedback not found",
        };

      return {
        success: true,
        data: feedback,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get feedback",
      };
    }
  }

  static async getFeedbackByUserId(userId: string): Promise<FeedbacksResponse> {
    try {
      const feedbacks = await FeedbackModel.getFeedbackByUserId(userId);
      return {
        success: true,
        data: feedbacks,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get user feedbacks",
      };
    }
  }

  static async listAllFeedbacks(): Promise<FeedbacksResponse> {
    try {
      const feedbacks = await FeedbackModel.listAllFeedbacks();
      return {
        success: true,
        data: feedbacks,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get  feedbacks",
      };
    }
  }
}

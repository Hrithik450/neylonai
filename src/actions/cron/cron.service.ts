import { UsersModel } from "@/actions/users/users.model";

export class CronService {
  static async resetDailyLimits(): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      const count = await UsersModel.resetDailyLimits();
      console.log(`Token reset successful for ${count} users`);
      return { success: true, count };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Cron job failed",
      };
    }
  }
}

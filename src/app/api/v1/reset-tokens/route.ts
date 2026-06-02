import { NextRequest, NextResponse } from "next/server";
import { CronService } from "@/actions/cron/cron.service";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await CronService.resetDailyLimits();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Cron job executed successfully. Reset ${result.count} users.`,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    );
  }
}

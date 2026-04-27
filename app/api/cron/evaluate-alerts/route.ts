import { NextRequest, NextResponse } from "next/server";
import { alertsService } from "@/lib/services/alerts.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron job endpoint to evaluate alert rules
 *
 * Scheduled in vercel.json to run hourly (0 * * * *)
 * This evaluates all enabled alert rules based on their check intervals
 *
 * Security: Protected by Vercel's cron job infrastructure
 * (only callable from Vercel's cron scheduler, no additional auth needed)
 */
export async function GET(request: NextRequest) {
  try {
    console.log("[Alert Evaluation Cron] Starting alert evaluation...");
    const startTime = Date.now();

    // Evaluate all alert rules
    await alertsService.evaluateAllRules();

    const duration = Date.now() - startTime;
    console.log(`[Alert Evaluation Cron] Completed in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: "Alert evaluation completed",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Alert Evaluation Cron] Error:", error);
    return NextResponse.json(
      {
        error: "Alert evaluation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { alertsService } from "@/lib/services/alerts.service";

/**
 * Cron job endpoint to evaluate alert rules
 *
 * Can be triggered by:
 * - Vercel Cron Jobs (via vercel.json)
 * - External cron service (e.g., EasyCron, AWS EventBridge)
 * - Manual API call
 *
 * Authorization: Expects CRON_SECRET in Authorization header
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization using CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

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

/**
 * POST endpoint for manual trigger
 */
export async function POST(request: NextRequest) {
  return GET(request);
}

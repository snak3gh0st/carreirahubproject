import { NextRequest, NextResponse } from "next/server";
import { alertsService } from "@/lib/services/alerts.service";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withCronTelemetry("evaluate-alerts", async (_request) => {
  try {
    console.log("[Alert Evaluation Cron] Starting alert evaluation...");
    const startTime = Date.now();

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
        success: false,
        error: "Alert evaluation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
});

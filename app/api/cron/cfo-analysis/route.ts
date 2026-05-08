import { NextRequest, NextResponse } from "next/server";
import { generateAndCacheCfoInsight } from "@/lib/services/cfo-analysis";
import { refreshQbCfoReports } from "@/lib/services/qb-cfo-reports";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function refreshQbReports(): Promise<void> {
  try {
    await refreshQbCfoReports();
    console.log("[CFO-CRON] QB reports cached successfully");
  } catch (error) {
    console.error("[CFO-CRON] Failed to refresh QB reports:", error);
  }
}

export const GET = withCronTelemetry("cfo-analysis", async (_request) => {
  try {
    await refreshQbReports();

    await Promise.all([
      generateAndCacheCfoInsight("last30"),
      generateAndCacheCfoInsight("thisYear"),
    ]);

    return NextResponse.json({ success: true, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[CFO-ANALYSIS-CRON] Error:", error);
    return NextResponse.json({ success: false, error: "Failed to generate CFO analysis" }, { status: 500 });
  }
});

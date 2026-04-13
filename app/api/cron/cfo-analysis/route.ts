import { NextRequest, NextResponse } from "next/server";
import { generateAndCacheCfoInsight } from "@/lib/services/cfo-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await Promise.all([
      generateAndCacheCfoInsight("last30"),
      generateAndCacheCfoInsight("thisYear"),
    ]);

    return NextResponse.json({ success: true, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("[CFO-ANALYSIS-CRON] Error:", error);
    return NextResponse.json({ error: "Failed to generate CFO analysis" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { generateAndCacheCfoInsight } from "@/lib/services/cfo-analysis";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { parseProfitAndLoss, parseBalanceSheet } from "@/lib/services/qb-report-parser";
import { prisma } from "@/lib/db";
import { format, startOfYear } from "date-fns";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function refreshQbReports(): Promise<void> {
  try {
    const now = new Date();
    const yearStart = format(startOfYear(now), "yyyy-MM-dd");
    const today = format(now, "yyyy-MM-dd");

    const [pnlRaw, bsRaw] = await Promise.all([
      quickbooksService.getProfitAndLossReport(yearStart, today),
      quickbooksService.getBalanceSheetReport(today),
    ]);

    const pnlParsed = parseProfitAndLoss(pnlRaw);
    const bsParsed = parseBalanceSheet(bsRaw);

    await Promise.all([
      prisma.qbReportCache.upsert({
        where: { reportType: "ProfitAndLoss" },
        update: {
          data: JSON.stringify(pnlParsed),
          parameters: JSON.stringify({ startDate: yearStart, endDate: today }),
          fetchedAt: now,
        },
        create: {
          reportType: "ProfitAndLoss",
          data: JSON.stringify(pnlParsed),
          parameters: JSON.stringify({ startDate: yearStart, endDate: today }),
        },
      }),
      prisma.qbReportCache.upsert({
        where: { reportType: "BalanceSheet" },
        update: {
          data: JSON.stringify(bsParsed),
          parameters: JSON.stringify({ asOfDate: today }),
          fetchedAt: now,
        },
        create: {
          reportType: "BalanceSheet",
          data: JSON.stringify(bsParsed),
          parameters: JSON.stringify({ asOfDate: today }),
        },
      }),
    ]);

    console.log("[CFO-CRON] QB reports cached successfully");
  } catch (error) {
    console.error("[CFO-CRON] Failed to refresh QB reports:", error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await refreshQbReports();

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

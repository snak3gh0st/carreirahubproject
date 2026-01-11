import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { collectionCallService } from "@/lib/services/collection-call.service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60 seconds for processing

/**
 * GET /api/cron/collection-calls
 * Automatically initiate collection calls for overdue invoices
 * Schedule: Daily at 10:00 AM (during business hours)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[COLLECTION_CALLS_CRON] Starting automatic collection calls...");

    // Check if service is configured
    if (!collectionCallService.isConfigured()) {
      console.log("[COLLECTION_CALLS_CRON] Service not configured, skipping");
      return NextResponse.json({
        success: false,
        message: "Collection call service is not configured",
        initiated: 0,
        skipped: 0,
      });
    }

    // Process automatic calls
    const summary = await collectionCallService.processAutomaticCalls();

    // Log the cron execution
    await prisma.integrationLog.create({
      data: {
        service: "RETELL",
        action: "CRON_COLLECTION_CALLS",
        status: summary.errors.length > 0 ? "PARTIAL" : "SUCCESS",
        payload: {
          initiated: summary.initiated,
          skipped: summary.skipped,
          errors: summary.errors,
        } as any,
      },
    });

    console.log(
      `[COLLECTION_CALLS_CRON] Completed: ${summary.initiated} initiated, ${summary.skipped} skipped`
    );

    return NextResponse.json({
      success: true,
      message: "Collection calls processed",
      initiated: summary.initiated,
      skipped: summary.skipped,
      errors: summary.errors.length > 0 ? summary.errors : undefined,
    });
  } catch (error) {
    console.error("[COLLECTION_CALLS_CRON_ERROR]", error);

    // Log the error
    await prisma.integrationLog.create({
      data: {
        service: "RETELL",
        action: "CRON_COLLECTION_CALLS_FAILED",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron job failed" },
      { status: 500 }
    );
  }
}

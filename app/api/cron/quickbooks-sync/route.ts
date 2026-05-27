import { NextRequest, NextResponse } from "next/server";
import { telegramService } from "@/lib/services/telegram.service";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";
import {
  enqueueQuickBooksFullSyncJob,
  enqueueQuickBooksIncrementalReconcileJob,
} from "@/lib/utils/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withCronTelemetry("quickbooks-sync", async (request) => {
  const start = Date.now();
  let mode: "full" | "incremental" = "incremental";
  let requestBody: Record<string, unknown> = {};
  try {
    const body = await request.json().catch(() => ({}));
    requestBody = body;
    const useFull = body.full === true;

    if (useFull) {
      mode = "full";
      console.log("[QuickBooks Cron] Queueing full sync job...");
      await enqueueQuickBooksFullSyncJob();
      return NextResponse.json({ success: true, mode: "full", queued: true });
    }

    console.log("[QuickBooks Cron] Queueing CDC incremental reconciliation job...");
    await enqueueQuickBooksIncrementalReconcileJob();

    return NextResponse.json({
      success: true,
      mode: "incremental",
      queued: true,
    });
  } catch (error: any) {
    console.error("[QuickBooks Cron] Error:", error);
    await telegramService.alertSyncError("QuickBooks", error, {
      Route: "/api/cron/quickbooks-sync",
      Method: request.method,
      Mode: mode,
      Duration: `${Date.now() - start}ms`,
      RequestBody: requestBody,
    });
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync QuickBooks" },
      { status: 500 }
    );
  }
});

export const POST = GET;

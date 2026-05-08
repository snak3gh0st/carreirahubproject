import { NextRequest, NextResponse } from "next/server";
import { quickbooksSyncService } from "@/lib/services/quickbooks-sync.service";
import { telegramService } from "@/lib/services/telegram.service";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

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
      console.log("[QuickBooks Cron] Full sync requested");
      const result = await quickbooksSyncService.sync({
        syncCustomers: true,
        syncInvoices: true,
        syncPayments: true,
        syncItems: false,
        syncPriceLevels: false,
        syncPaymentTerms: false,
        maxResults: 1000,
        incremental: false,
      });
      return NextResponse.json({ success: true, mode: "full", result });
    }

    console.log("[QuickBooks Cron] Starting CDC incremental sync...");
    const result = await quickbooksSyncService.syncIncremental();

    console.log("[QuickBooks Cron] CDC sync completed:", {
      duration: result.duration,
      customers: result.customers,
      invoices: result.invoices,
      payments: result.payments,
    });

    return NextResponse.json({
      success: true,
      mode: "incremental",
      result: {
        duration: result.duration,
        customers: result.customers,
        invoices: result.invoices,
        payments: result.payments,
        startTime: result.startTime,
        endTime: result.endTime,
      },
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

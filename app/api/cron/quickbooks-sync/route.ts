import { NextRequest, NextResponse } from "next/server";
import { quickbooksSyncService } from "@/lib/services/quickbooks-sync.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const useFull = body.full === true;

    if (useFull) {
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
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync QuickBooks" },
      { status: 500 }
    );
  }
}


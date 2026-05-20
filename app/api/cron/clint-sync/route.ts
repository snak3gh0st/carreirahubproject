import { NextRequest, NextResponse } from "next/server";
import { clintSyncService } from "@/lib/services/clint-sync.service";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = "force-dynamic";

export const GET = withCronTelemetry("clint-sync", async (request) => {
  const start = Date.now();
  try {
    if (!process.env.CLINT_API_KEY?.trim()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: "CLINT_API_KEY not configured",
        duration: `${Date.now() - start}ms`,
      });
    }

    const url = new URL(request.url);
    const maxPagesParam = url.searchParams.get("maxPages");
    const maxPages = maxPagesParam ? Math.max(Number(maxPagesParam), 1) : undefined;
    const result = await clintSyncService.syncAll({ maxPages });
    return NextResponse.json({ success: true, ...result, duration: `${Date.now() - start}ms` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
});

export const POST = GET;

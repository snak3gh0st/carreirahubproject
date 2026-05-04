import { NextResponse } from "next/server";
import { clintSyncService } from "@/lib/services/clint-sync.service";
import { telegramService } from "@/lib/services/telegram.service";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  try {
    const url = new URL(request.url);
    const maxPagesParam = url.searchParams.get("maxPages");
    const maxPages = maxPagesParam ? Math.max(Number(maxPagesParam), 1) : undefined;
    const result = await clintSyncService.syncAll({ maxPages });
    await telegramService.alertSyncComplete("Clint CRM", {
      ...Object.fromEntries(
        Object.entries(result).filter(([, v]) => typeof v === "number" || typeof v === "string")
      ),
      duration: `${Date.now() - start}ms`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    await telegramService.alertSyncError("Clint CRM", err, {
      Route: "/api/cron/clint-sync",
      Method: request.method,
      Duration: `${Date.now() - start}ms`,
    });
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

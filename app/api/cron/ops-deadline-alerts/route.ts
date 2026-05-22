import { NextResponse } from "next/server";
import { createOpsDeadlineAlerts } from "@/lib/ops/deadline-alerts";
import { isMissingOpsNativeTable } from "@/lib/ops/native-schema";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = "force-dynamic";

export const GET = withCronTelemetry("ops-deadline-alerts", async () => {
  try {
    const result = await createOpsDeadlineAlerts();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (isMissingOpsNativeTable(error)) {
      return NextResponse.json({ success: true, skipped: true, migrationRequired: true });
    }

    console.error("[OpsDeadlineAlerts] Failed:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
});

export const POST = GET;

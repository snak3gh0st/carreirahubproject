import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { telegramService } from "@/lib/services/telegram.service";

interface CronResult {
  success: boolean;
  [key: string]: unknown;
}

export function withCronTelemetry(
  cronName: string,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Auth
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const vercelHeader = request.headers.get("x-vercel-cron-secret");
      if (authHeader !== `Bearer ${cronSecret}` && vercelHeader !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const start = Date.now();
    let status = "SUCCESS";
    let errorMsg: string | undefined;

    try {
      const response = await handler(request);
      const duration = Date.now() - start;
      const body: CronResult = await response.clone().json().catch(() => ({ success: true }));

      const failed = body.success === false || response.status >= 400;
      if (failed) {
        status = "ERROR";
        errorMsg = typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
        await telegramService.alertCronError(cronName, new Error(errorMsg), {
          Route: request.nextUrl.pathname,
          Status: response.status,
          Duration: `${duration}ms`,
        });
      }

      // Write IntegrationLog for every run
      await prisma.integrationLog.create({
        data: {
          service: "CRON",
          action: cronName.toUpperCase().replace(/-/g, "_"),
          status,
          error: errorMsg,
          durationMs: duration,
          errorCategory: "CRON_RUN",
          errorSeverity: failed ? "error" : "info",
          metadata: { cronName, route: request.nextUrl.pathname },
        },
      }).catch(() => {}); // never fail the cron because of logging

      return response;
    } catch (err) {
      const duration = Date.now() - start;
      const errMsg = err instanceof Error ? err.message : String(err);

      await telegramService.alertCronError(cronName, err, {
        Route: request.nextUrl.pathname,
        Duration: `${duration}ms`,
      });

      await prisma.integrationLog.create({
        data: {
          service: "CRON",
          action: cronName.toUpperCase().replace(/-/g, "_"),
          status: "ERROR",
          error: errMsg,
          durationMs: duration,
          errorCategory: "CRON_RUN",
          errorSeverity: "critical",
          metadata: { cronName, route: request.nextUrl.pathname, thrown: true },
        },
      }).catch(() => {});

      throw err;
    }
  };
}

// backward-compat alias
export const cronWithTelegram = withCronTelemetry;

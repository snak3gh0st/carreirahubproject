import { NextRequest, NextResponse } from "next/server";
import { telegramService } from "@/lib/services/telegram.service";

interface CronResult {
  success: boolean;
  [key: string]: any;
}

export function cronWithTelegram(
  cronName: string,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const start = Date.now();
    try {
      const response = await handler(request);
      const duration = Date.now() - start;

      const body: CronResult = await response.clone().json().catch(() => ({ success: true }));

      if (body.success === false || response.status >= 400) {
        await telegramService.alertCronError(cronName, new Error(body.error || `HTTP ${response.status}`), {
          Route: request.nextUrl.pathname,
          Method: request.method,
          Status: response.status,
          Duration: `${duration}ms`,
          Response: body,
        });
      } else {
        const summaryParts: string[] = [];
        for (const [k, v] of Object.entries(body)) {
          if (k === "success" || k === "timestamp") continue;
          if (typeof v === "number") summaryParts.push(`${k}: ${v}`);
          else if (typeof v === "string" && v.length < 100) summaryParts.push(`${k}: ${v}`);
        }
        summaryParts.push(`Duration: ${duration}ms`);
        await telegramService.alertCronSuccess(cronName, summaryParts.join(" · "));
      }

      return response;
    } catch (error) {
      await telegramService.alertCronError(cronName, error, {
        Route: request.nextUrl.pathname,
        Method: request.method,
        Duration: `${Date.now() - start}ms`,
      });
      throw error;
    }
  };
}

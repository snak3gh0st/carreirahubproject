import { NextResponse } from "next/server";
import { calculateWebhookHealth } from "@/lib/utils/webhook-health";
import { telegramService } from "@/lib/services/telegram.service";

/**
 * GET /api/webhooks/health
 *
 * Public endpoint for webhook system health monitoring.
 * Returns per-service success rates, error counts, and overall system status.
 *
 * This endpoint is PUBLIC (no authentication required) so it can be used by
 * uptime monitoring tools like UptimeRobot, Pingdom, etc.
 *
 * Response format:
 * {
 *   "status": "healthy" | "degraded" | "unhealthy",
 *   "timestamp": "2026-01-10T12:00:00Z",
 *   "services": {
 *     "clint": { "status": "healthy", "successRate": 0.98, "recentErrors": 2, "totalEvents": 100 },
 *     ...
 *   },
 *   "deadLetterCount": 12,
 *   "pendingRetries": 8
 * }
 *
 * Status calculation:
 * - "healthy": successRate >= 0.95 for all services
 * - "degraded": at least one service has 0.80 <= successRate < 0.95
 * - "unhealthy": any service has successRate < 0.80
 */
export async function GET() {
  try {
    const health = await calculateWebhookHealth();

    if (health.status === "unhealthy") {
      const degraded = Object.entries(health.services || {})
        .filter(([, s]: [string, any]) => s.status !== "healthy")
        .map(([name, s]: [string, any]) => `${name}: ${Math.round((s.successRate ?? 0) * 100)}%`)
        .join(", ");
      await telegramService.alertError("Webhook Health", new Error(`System UNHEALTHY — ${degraded}`), {
        Route: "/api/webhooks/health",
        Method: "GET",
        "Dead Letters": String(health.deadLetterCount ?? 0),
        "Pending Retries": String(health.pendingRetries ?? 0),
      });
    } else if (health.status === "degraded") {
      const degraded = Object.entries(health.services || {})
        .filter(([, s]: [string, any]) => s.status !== "healthy")
        .map(([name, s]: [string, any]) => `${name}: ${Math.round((s.successRate ?? 0) * 100)}%`)
        .join(", ");
      await telegramService.alertWarning("Webhook Health", `System DEGRADED — ${degraded}`);
    }

    // Return 200 OK for healthy/degraded, 503 Service Unavailable for unhealthy
    // This allows monitoring tools to alert on HTTP status code
    const httpStatus = health.status === "unhealthy" ? 503 : 200;

    return NextResponse.json(health, { status: httpStatus });
  } catch (error: any) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error("[WEBHOOK_HEALTH] Error calculating health:", error);

    await telegramService.alertError("Webhook Health Route", error, {
      Route: "/api/webhooks/health",
      Method: "GET",
    });

    // Return 500 for system errors
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

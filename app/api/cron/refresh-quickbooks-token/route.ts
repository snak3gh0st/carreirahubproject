import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { telegramService } from "@/lib/services/telegram.service";

/**
 * GET/POST /api/cron/refresh-quickbooks-token
 *
 * Automatically refreshes QuickBooks OAuth access tokens via cron job.
 * Runs daily at 2 AM UTC (configured in vercel.json).
 *
 * QuickBooks OAuth token lifecycle:
 * - Access tokens: Valid for ~60 days, required for API calls
 * - Refresh tokens: Valid for ~100 years, used to get new access tokens
 * - This cron prevents access token expiration by refreshing daily
 *
 * Security:
 * - Validates Vercel cron secret from x-vercel-cron-secret header
 * - Returns 403 if secret missing or invalid
 *
 * Logging:
 * - All refresh attempts logged to IntegrationLog table
 * - Status: "success" if token refreshed, "error" if refresh failed or no tokens configured
 * - Includes error details for debugging failed refreshes
 *
 * Execution constraints:
 * - Vercel timeout: 10 seconds
 * - Never throws errors (returns 200 even on failure)
 * - Cron should not fail, all issues logged for monitoring
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Accept CRON_SECRET (host scheduler, Bearer) or VERCEL_CRON_SECRET (Vercel overlap, x-vercel-cron-secret or Bearer)
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const vercelHeader = request.headers.get("x-vercel-cron-secret");
      if (authHeader !== `Bearer ${cronSecret}` && vercelHeader !== cronSecret) {
        console.warn("[CRON] Unauthorized refresh-quickbooks-token request (invalid secret)");
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    console.log("[CRON] Starting QuickBooks token refresh");

    // Fetch current SystemConfig to check if tokens are configured
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    // If no SystemConfig or no tokens configured, nothing to do
    if (!config || !config.quickbooks_access_token || !config.quickbooks_refresh_token) {
      console.log("[CRON] No QuickBooks tokens configured, skipping refresh");

      // Log this as an info entry (nothing to do, not an error)
      try {
        await prisma.integrationLog.create({
          data: {
            service: "QUICKBOOKS",
            action: "QB_TOKEN_REFRESH_CRON",
            status: "SUCCESS",
            durationMs: Date.now() - startTime,
            errorCategory: "QB_TOKEN_REFRESH",
            errorSeverity: "info",
            metadata: {
              message: "No QuickBooks tokens configured, skipping refresh",
              tokensRefreshed: false,
            },
          },
        });
      } catch (logError) {
        console.error("[CRON] Failed to log token refresh skipped:", logError);
      }

      return NextResponse.json(
        {
          success: true,
          message: "No QuickBooks tokens configured, skipping refresh",
          tokensRefreshed: false,
        },
        { status: 200 }
      );
    }

    // Initialize quickbooks service and attempt token refresh
    await quickbooksService.initialize();

    try {
      // Call the public refresh method (we need to expose it or use internal logic)
      // For now, we'll call the refresh directly via the service
      await quickbooksService.refreshAccessTokenDirect();

      const durationMs = Date.now() - startTime;
      console.log(`[CRON] QuickBooks token refreshed successfully (${durationMs}ms)`);

      // Log success to IntegrationLog
      try {
        const updatedConfig = await prisma.systemConfig.findUnique({
          where: { id: "system" },
        });

        await prisma.integrationLog.create({
          data: {
            service: "QUICKBOOKS",
            action: "QB_TOKEN_REFRESH_CRON",
            status: "SUCCESS",
            durationMs,
            errorCategory: "QB_TOKEN_REFRESH",
            errorSeverity: "info",
            metadata: {
              message: "Token refresh successful",
              tokensRefreshed: true,
              expiresAt: updatedConfig?.quickbooks_token_expires_at?.toISOString() || null,
            },
          },
        });
      } catch (logError) {
        console.error("[CRON] Failed to log token refresh success:", logError);
      }

      await telegramService.alertCronSuccess("refresh-qb-token", "Token refreshed OK");

      return NextResponse.json(
        {
          success: true,
          message: "QuickBooks token refreshed successfully",
          tokensRefreshed: true,
        },
        { status: 200 }
      );
    } catch (refreshError) {
      const durationMs = Date.now() - startTime;
      const errorMessage = refreshError instanceof Error ? refreshError.message : String(refreshError);

      console.error(`[CRON] QuickBooks token refresh failed: ${errorMessage}`);

      // Log error to IntegrationLog for monitoring and debugging
      try {
        await prisma.integrationLog.create({
          data: {
            service: "QUICKBOOKS",
            action: "QB_TOKEN_REFRESH_CRON",
            status: "ERROR",
            error: errorMessage,
            durationMs,
            errorCategory: "QB_TOKEN_REFRESH",
            errorSeverity: "error",
            metadata: {
              message: "Token refresh failed",
              tokensRefreshed: false,
              errorName: refreshError instanceof Error ? refreshError.name : "Unknown",
            },
          },
        });
      } catch (logError) {
        console.error("[CRON] Failed to log token refresh error:", logError);
      }

      await telegramService.alertCronError("refresh-qb-token", refreshError, {
        Route: request.nextUrl.pathname,
        Method: request.method,
        Duration: `${durationMs}ms`,
        ReportedStatus: 200,
      });

      // Return 200 even on failure (cron endpoint should not fail)
      // Details logged to IntegrationLog for operator monitoring
      return NextResponse.json(
        {
          success: false,
          message: "QuickBooks token refresh failed",
          tokensRefreshed: false,
          error: errorMessage,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error(`[CRON] Unexpected error in refresh-quickbooks-token: ${errorMessage}`);

    // Log unexpected error
    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUICKBOOKS",
          action: "QB_TOKEN_REFRESH_CRON",
          status: "ERROR",
          error: errorMessage,
          durationMs,
          errorCategory: "QB_TOKEN_REFRESH",
          errorSeverity: "critical",
          metadata: {
            message: "Unexpected error during token refresh",
            errorName: error instanceof Error ? error.name : typeof error,
          },
        },
      });
    } catch (logError) {
      console.error("[CRON] Failed to log unexpected error:", logError);
    }

    await telegramService.alertCronError("refresh-qb-token", error, {
      Route: request.nextUrl.pathname,
      Method: request.method,
      Duration: `${durationMs}ms`,
      ReportedStatus: 200,
    });

    // Return 200 even on unexpected error
    return NextResponse.json(
      {
        success: false,
        message: "Unexpected error during token refresh",
        tokensRefreshed: false,
        error: errorMessage,
      },
      { status: 200 }
    );
  }
}

// Also support POST for compatibility
export async function POST(request: NextRequest) {
  return GET(request);
}

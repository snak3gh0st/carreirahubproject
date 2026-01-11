import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { UserRole } from "@prisma/client";

/**
 * POST /api/quickbooks/refresh-token
 *
 * Manually refresh QuickBooks OAuth access token (user-initiated).
 * Can be triggered from admin dashboard when token is expiring soon.
 *
 * Authentication:
 * - Requires authenticated session
 * - Requires ADMIN role (token configuration is admin-only)
 * - Returns 401 if not authenticated, 403 if insufficient role
 *
 * Implementation:
 * - Calls QuickBooksService.refreshAccessTokenDirect()
 * - Logs to IntegrationLog with action "QB_TOKEN_REFRESH_MANUAL"
 * - Returns updated expiration time on success
 * - Returns user-friendly error message on failure
 *
 * Possible failure reasons:
 * - Refresh token invalid or revoked
 * - Refresh token expired (extremely rare, ~100 year lifespan)
 * - Network error or QuickBooks API unavailable
 * - Client credentials invalid
 *
 * Failure recovery:
 * - User must reconnect via OAuth flow at /api/quickbooks/auth/callback
 * - Link provided in error message
 *
 * Used by:
 * - Admin dashboard "Refresh Now" button
 * - Manual token refresh when expiration imminent
 */
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get session and verify authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for ADMIN role
    const userRole = (session.user as any)?.role;
    if (userRole !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden - ADMIN role required" },
        { status: 403 }
      );
    }

    // Initialize QuickBooks service with current tokens from database
    await quickbooksService.initialize();

    // Attempt to refresh the token
    try {
      await quickbooksService.refreshAccessTokenDirect();

      const durationMs = Date.now() - startTime;

      // Fetch updated expiration time
      const config = await prisma.systemConfig.findUnique({
        where: { id: "system" },
      });

      const expiresAt = config?.quickbooks_token_expires_at?.toISOString() || null;

      // Log success to IntegrationLog
      try {
        await prisma.integrationLog.create({
          data: {
            service: "QUICKBOOKS",
            action: "QB_TOKEN_REFRESH_MANUAL",
            status: "SUCCESS",
            durationMs,
            errorCategory: "QB_TOKEN_REFRESH",
            errorSeverity: "info",
            metadata: {
              initiatedBy: (session.user as any)?.email,
              expiresAt,
            },
          },
        });
      } catch (logError) {
        console.error("[Token Refresh] Failed to log success:", logError);
      }

      console.log(`[Token Refresh] Manual token refresh successful (${durationMs}ms)`);

      return NextResponse.json(
        {
          success: true,
          message: "QuickBooks token refreshed successfully",
          expiresAt,
        },
        { status: 200 }
      );
    } catch (refreshError) {
      const durationMs = Date.now() - startTime;
      const errorMessage = refreshError instanceof Error ? refreshError.message : String(refreshError);

      console.error(`[Token Refresh] Manual refresh failed: ${errorMessage}`);

      // Log error to IntegrationLog
      try {
        await prisma.integrationLog.create({
          data: {
            service: "QUICKBOOKS",
            action: "QB_TOKEN_REFRESH_MANUAL",
            status: "ERROR",
            error: errorMessage,
            durationMs,
            errorCategory: "QB_TOKEN_REFRESH",
            errorSeverity: "error",
            metadata: {
              initiatedBy: (session.user as any)?.email,
              errorName: refreshError instanceof Error ? refreshError.name : "Unknown",
            },
          },
        });
      } catch (logError) {
        console.error("[Token Refresh] Failed to log error:", logError);
      }

      // Return user-friendly error message
      let userMessage = "Failed to refresh QuickBooks token";

      if (errorMessage.includes("refresh token not configured")) {
        userMessage = "QuickBooks is not configured. Please connect via OAuth first.";
      } else if (
        errorMessage.includes("invalid") ||
        errorMessage.includes("revoked") ||
        errorMessage.includes("unauthorized")
      ) {
        userMessage =
          "Refresh token is invalid or revoked. Please reconnect QuickBooks: /api/quickbooks/auth/callback";
      } else if (errorMessage.includes("Failed to refresh")) {
        userMessage = "QuickBooks API error. Please try again later or reconnect.";
      }

      return NextResponse.json(
        {
          success: false,
          message: userMessage,
          error: errorMessage, // Include raw error for debugging in logs
        },
        { status: 200 } // Return 200 even on failure (user can see error response)
      );
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error(`[Token Refresh] Unexpected error: ${errorMessage}`);

    // Log unexpected error
    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUICKBOOKS",
          action: "QB_TOKEN_REFRESH_MANUAL",
          status: "ERROR",
          error: errorMessage,
          durationMs,
          errorCategory: "QB_TOKEN_REFRESH",
          errorSeverity: "critical",
          metadata: {
            errorName: error instanceof Error ? error.name : typeof error,
          },
        },
      });
    } catch (logError) {
      console.error("[Token Refresh] Failed to log unexpected error:", logError);
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to refresh QuickBooks token",
      },
      { status: 500 }
    );
  }
}

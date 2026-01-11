import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

/**
 * GET /api/quickbooks/token-status
 *
 * Returns QuickBooks OAuth token status for dashboard display.
 * Shows token expiration, health, and refresh status.
 *
 * Authentication:
 * - Requires authenticated session
 * - Requires ADMIN role (token configuration is admin-only)
 * - Returns 401 if not authenticated, 403 if insufficient role
 *
 * Response includes:
 * - configured: Whether QB is connected
 * - hasAccessToken: Whether access token is stored
 * - hasRefreshToken: Whether refresh token is stored
 * - expiresAt: Token expiration timestamp (ISO 8601)
 * - expiresInDays: Days until token expires (null if expired)
 * - isExpired: Whether token has already expired
 * - expiringWithin24Hours: Whether token will expire in next 24 hours
 * - lastRefreshAttempt: Timestamp of last refresh attempt
 *
 * Used by:
 * - Admin dashboard for token health monitoring
 * - UI to show warning when token expiring soon
 * - Manual refresh endpoint to display current status
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

    // Fetch SystemConfig from database
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    // Calculate token status
    const hasAccessToken = !!config?.quickbooks_access_token;
    const hasRefreshToken = !!config?.quickbooks_refresh_token;
    const expiresAt = config?.quickbooks_token_expires_at;
    const isConfigured = hasAccessToken && hasRefreshToken && config?.quickbooks_is_authenticated;

    // Calculate expiration info
    let expiresInDays: number | null = null;
    let isExpired = false;
    let expiringWithin24Hours = false;

    if (expiresAt) {
      const now = new Date();
      const expirationTime = expiresAt.getTime() - now.getTime();
      isExpired = expirationTime < 0;

      if (!isExpired) {
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        expiresInDays = Math.ceil(expirationTime / millisecondsPerDay);
        expiringWithin24Hours = expirationTime < 24 * 60 * 60 * 1000;
      }
    }

    // Find the most recent token refresh attempt (success or failure)
    const lastRefreshLog = await prisma.integrationLog.findFirst({
      where: {
        service: "QUICKBOOKS",
        action: {
          in: ["QB_TOKEN_REFRESH_MANUAL", "QB_TOKEN_REFRESH_CRON"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
        status: true,
      },
    });

    const lastRefreshAttempt = lastRefreshLog?.createdAt?.toISOString() || null;

    return NextResponse.json({
      configured: isConfigured,
      hasAccessToken,
      hasRefreshToken,
      expiresAt: expiresAt?.toISOString() || null,
      expiresInDays,
      isExpired,
      expiringWithin24Hours,
      lastRefreshAttempt,
    });
  } catch (error) {
    console.error("[Token Status] Error retrieving token status:", error);

    // Log error but don't expose details to user
    try {
      await prisma.integrationLog.create({
        data: {
          service: "QUICKBOOKS",
          action: "GET_TOKEN_STATUS",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          errorCategory: "QB_TOKEN_STATUS",
          errorSeverity: "error",
          metadata: {
            errorName: error instanceof Error ? error.name : typeof error,
          },
        },
      });
    } catch (logError) {
      console.error("[Token Status] Failed to log error:", logError);
    }

    return NextResponse.json(
      { error: "Failed to retrieve token status" },
      { status: 500 }
    );
  }
}

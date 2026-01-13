import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { integrationLogger } from "@/lib/utils/logger";

// Force dynamic rendering (uses getServerSession which reads headers)
export const dynamic = 'force-dynamic';

/**
 * GET /api/webhooks/dead-letter
 *
 * Retrieve all webhook events in the dead letter queue (permanently failed)
 *
 * Query parameters:
 * - limit: Maximum number of results (default: 50, max: 200)
 * - offset: Number of results to skip for pagination (default: 0)
 * - service: Optional service filter (e.g., "pipedrive", "quickbooks")
 *
 * Authentication: ADMIN or OPERATIONAL roles required
 *
 * Returns:
 * - events: Array of dead letter webhook events
 * - total: Total count of dead letter events
 * - limit: Applied limit
 * - offset: Applied offset
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;

    // Check authorization (ADMIN or OPERATIONAL roles only)
    if (userRole !== "ADMIN" && userRole !== "OPERATIONAL") {
      await integrationLogger.logError(
        "WEBHOOK_DEAD_LETTER",
        "UNAUTHORIZED_ACCESS",
        "User does not have permission to access dead letter queue",
        {
          userId: (session.user as any).id,
          userRole,
        }
      );

      return NextResponse.json(
        { error: "Forbidden: ADMIN or OPERATIONAL role required" },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limitParam = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const service = searchParams.get("service") || undefined;

    // Validate and cap limit
    const limit = Math.min(Math.max(limitParam, 1), 200);

    // Build where clause
    const where: any = {
      status: "dead_letter",
    };

    if (service) {
      where.service = service;
    }

    // Query dead letter events
    const [events, total] = await Promise.all([
      prisma.webhookEvent.findMany({
        where,
        orderBy: {
          created_at: "desc",
        },
        take: limit,
        skip: offset,
        select: {
          id: true,
          service: true,
          event_type: true,
          event_id: true,
          payload: true,
          last_error: true,
          retry_count: true,
          created_at: true,
          updated_at: true,
        },
      }),
      prisma.webhookEvent.count({ where }),
    ]);

    await integrationLogger.logSuccess(
      "WEBHOOK_DEAD_LETTER",
      "QUERY_SUCCESS",
      {
        userId: (session.user as any).id,
        service,
        limit,
        offset,
        resultCount: events.length,
        total,
      }
    );

    return NextResponse.json({
      events,
      total,
      limit,
      offset,
      hasMore: offset + events.length < total,
    });
  } catch (error: any) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    await integrationLogger.logError(
      "WEBHOOK_DEAD_LETTER",
      "QUERY_ERROR",
      errorMessage
    );

    console.error("[DEAD_LETTER] Query error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

/**
 * GET /api/integrations/sync-status
 * Get sync health status for all integrations
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permissions (ADMIN, FINANCE only)
    const userRole = (session.user as any).role as UserRole;
    if (userRole !== "ADMIN" && userRole !== "FINANCE") {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to view sync status" },
        { status: 403 }
      );
    }

    // Get system config for last sync times
    const systemConfig = await prisma.systemConfig.findUnique({
      where: { id: "system" },
      select: {
        last_qb_sync: true,
        last_pipedrive_sync: true,
        quickbooks_is_authenticated: true,
      },
    });

    // Get recent integration logs (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      pipedriveSuccessCount,
      pipedriveErrorCount,
      quickbooksSuccessCount,
      quickbooksErrorCount,
      recentErrors,
      bulkImportStats,
    ] = await Promise.all([
      // Pipedrive success count
      prisma.integrationLog.count({
        where: {
          service: { contains: "PIPEDRIVE" },
          status: "SUCCESS",
          createdAt: { gte: oneDayAgo },
        },
      }),

      // Pipedrive error count
      prisma.integrationLog.count({
        where: {
          service: { contains: "PIPEDRIVE" },
          status: "ERROR",
          createdAt: { gte: oneDayAgo },
        },
      }),

      // QuickBooks success count
      prisma.integrationLog.count({
        where: {
          service: { contains: "QUICKBOOKS" },
          status: "SUCCESS",
          createdAt: { gte: oneDayAgo },
        },
      }),

      // QuickBooks error count
      prisma.integrationLog.count({
        where: {
          service: { contains: "QUICKBOOKS" },
          status: "ERROR",
          createdAt: { gte: oneDayAgo },
        },
      }),

      // Recent errors (last 10)
      prisma.integrationLog.findMany({
        where: {
          status: "ERROR",
          createdAt: { gte: oneDayAgo },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          service: true,
          action: true,
          error: true,
          createdAt: true,
        },
      }),

      // Bulk import statistics
      prisma.bulkImport.groupBy({
        by: ["status"],
        _count: {
          status: true,
        },
      }),
    ]);

    // Calculate success rates
    const pipedriveTotal = pipedriveSuccessCount + pipedriveErrorCount;
    const pipedriveSuccessRate =
      pipedriveTotal > 0
        ? Math.round((pipedriveSuccessCount / pipedriveTotal) * 100)
        : 100;

    const quickbooksTotal = quickbooksSuccessCount + quickbooksErrorCount;
    const quickbooksSuccessRate =
      quickbooksTotal > 0
        ? Math.round((quickbooksSuccessCount / quickbooksTotal) * 100)
        : 100;

    // Format bulk import stats
    const bulkImportStatsByStatus = bulkImportStats.reduce(
      (acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      syncStatus: {
        pipedrive: {
          lastSync: systemConfig?.last_pipedrive_sync,
          successRate: pipedriveSuccessRate,
          successCount: pipedriveSuccessCount,
          errorCount: pipedriveErrorCount,
          total: pipedriveTotal,
          status: pipedriveSuccessRate >= 95 ? "healthy" : pipedriveSuccessRate >= 80 ? "warning" : "error",
        },
        quickbooks: {
          lastSync: systemConfig?.last_qb_sync,
          isAuthenticated: systemConfig?.quickbooks_is_authenticated || false,
          successRate: quickbooksSuccessRate,
          successCount: quickbooksSuccessCount,
          errorCount: quickbooksErrorCount,
          total: quickbooksTotal,
          status: quickbooksSuccessRate >= 95 ? "healthy" : quickbooksSuccessRate >= 80 ? "warning" : "error",
        },
        bulkImports: {
          running: bulkImportStatsByStatus.RUNNING || 0,
          completed: bulkImportStatsByStatus.COMPLETED || 0,
          failed: bulkImportStatsByStatus.FAILED || 0,
          cancelled: bulkImportStatsByStatus.CANCELLED || 0,
        },
        recentErrors,
        timeframe: "Last 24 hours",
      },
    });
  } catch (error) {
    console.error("[API] Error getting sync status:", error);

    return NextResponse.json(
      {
        error: "Failed to get sync status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

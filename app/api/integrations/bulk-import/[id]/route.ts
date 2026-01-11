import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bulkImportService } from "@/lib/services/bulk-import.service";
import { UserRole } from "@prisma/client";

/**
 * GET /api/integrations/bulk-import/:id
 * Get import status and progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const importId = params.id;

    // Get import status
    const bulkImport = await bulkImportService.getImportStatus(importId);

    if (!bulkImport) {
      return NextResponse.json(
        { error: "Import not found" },
        { status: 404 }
      );
    }

    // Calculate progress percentage
    const progressPercentage =
      bulkImport.totalRecords > 0
        ? Math.round((bulkImport.processedRecords / bulkImport.totalRecords) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      import: {
        id: bulkImport.id,
        source: bulkImport.source,
        type: bulkImport.type,
        status: bulkImport.status,
        totalRecords: bulkImport.totalRecords,
        processedRecords: bulkImport.processedRecords,
        successCount: bulkImport.successCount,
        errorCount: bulkImport.errorCount,
        errors: bulkImport.errors,
        progressPercentage,
        startedAt: bulkImport.startedAt,
        completedAt: bulkImport.completedAt,
        initiator: (bulkImport as any).initiator
          ? {
              id: (bulkImport as any).initiator.id,
              name: (bulkImport as any).initiator.name,
              email: (bulkImport as any).initiator.email,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[API] Error getting import status:", error);

    return NextResponse.json(
      {
        error: "Failed to get import status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/integrations/bulk-import/:id
 * Cancel running import
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permissions (ADMIN and FINANCE only)
    const userRole = (session.user as any).role as UserRole;
    if (userRole !== "ADMIN" && userRole !== "FINANCE") {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN and FINANCE roles can cancel imports" },
        { status: 403 }
      );
    }

    const importId = params.id;

    // Cancel import
    await bulkImportService.cancelImport(importId);

    return NextResponse.json({
      success: true,
      message: "Import cancelled successfully",
      importId,
    });
  } catch (error) {
    console.error("[API] Error cancelling import:", error);

    return NextResponse.json(
      {
        error: "Failed to cancel import",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

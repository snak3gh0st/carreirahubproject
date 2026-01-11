import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bulkImportService } from "@/lib/services/bulk-import.service";
import { addBulkImportJob } from "@/lib/utils/queue";
import { UserRole } from "@prisma/client";

/**
 * POST /api/integrations/bulk-import/pipedrive
 * Start bulk import from Pipedrive
 * Body: { importPersons: boolean, importDeals: boolean }
 */
export async function POST(request: NextRequest) {
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
        { error: "Forbidden: Only ADMIN and FINANCE roles can start bulk imports" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { importPersons, importDeals } = body;

    // Validate input
    if (!importPersons && !importDeals) {
      return NextResponse.json(
        { error: "Must select at least one entity to import (persons or deals)" },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id;

    // Start import
    const importId = await bulkImportService.startPipedriveImport({
      importPersons: !!importPersons,
      importDeals: !!importDeals,
      startedBy: userId,
    });

    // Determine type for queue
    let type = "";
    if (importPersons && importDeals) {
      type = "PERSONS_AND_DEALS";
    } else if (importPersons) {
      type = "PERSONS";
    } else {
      type = "DEALS";
    }

    // Queue import job
    await addBulkImportJob({
      importId,
      source: "PIPEDRIVE",
      type,
    });

    return NextResponse.json({
      success: true,
      message: "Pipedrive import started successfully",
      importId,
      status: "RUNNING",
    });
  } catch (error) {
    console.error("[API] Error starting Pipedrive import:", error);

    return NextResponse.json(
      {
        error: "Failed to start Pipedrive import",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

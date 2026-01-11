import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { bulkImportService } from "@/lib/services/bulk-import.service";
import { addBulkImportJob } from "@/lib/utils/queue";
import { UserRole } from "@prisma/client";

/**
 * POST /api/integrations/bulk-import/quickbooks
 * Start bulk import from QuickBooks
 * Body: { importCustomers: boolean, importInvoices: boolean, importItems: boolean }
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
    const { importCustomers, importInvoices, importItems } = body;

    // Validate input
    if (!importCustomers && !importInvoices && !importItems) {
      return NextResponse.json(
        { error: "Must select at least one entity to import (customers, invoices, or items)" },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id;

    // Start import
    const importId = await bulkImportService.startQuickBooksImport({
      importCustomers: !!importCustomers,
      importInvoices: !!importInvoices,
      importItems: !!importItems,
      startedBy: userId,
    });

    // Determine type for queue
    const types: string[] = [];
    if (importCustomers) types.push("CUSTOMERS");
    if (importInvoices) types.push("INVOICES");
    if (importItems) types.push("ITEMS");
    const type = types.join("_AND_");

    // Queue import job with options
    await addBulkImportJob({
      importId,
      source: "QUICKBOOKS",
      type,
      options: {
        syncCustomers: !!importCustomers,
        syncInvoices: !!importInvoices,
        syncItems: !!importItems,
        incremental: false, // Full import
      },
    });

    return NextResponse.json({
      success: true,
      message: "QuickBooks import started successfully",
      importId,
      status: "RUNNING",
    });
  } catch (error) {
    console.error("[API] Error starting QuickBooks import:", error);

    return NextResponse.json(
      {
        error: "Failed to start QuickBooks import",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/invoices/delete
 * Delete an invoice from QuickBooks by ID
 *
 * Body:
 * {
 *   "qbInvoiceId": "17024"
 * }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "FINANCE"].includes(role)) {
    return NextResponse.json({ error: "Forbidden - ADMIN or FINANCE required" }, { status: 403 });
  }

  try {
    const { qbInvoiceId } = await request.json();

    if (!qbInvoiceId) {
      return NextResponse.json({ error: "Missing qbInvoiceId" }, { status: 400 });
    }

    console.log(`[DELETE_INVOICE] Deleting QB invoice ${qbInvoiceId}...`);

    // Initialize QB service
    await quickbooksService.initialize();

    // Delete from QB
    const deleteResult = await quickbooksService.deleteInvoice(qbInvoiceId);

    console.log(`[DELETE_INVOICE] ✓ QB invoice ${qbInvoiceId} deleted successfully`);

    // Delete from local database
    const localInvoice = await prisma.invoice.findFirst({
      where: { quickbooks_invoice_id: qbInvoiceId },
    });

    if (localInvoice) {
      await prisma.invoice.delete({
        where: { id: localInvoice.id },
      });
      console.log(`[DELETE_INVOICE] ✓ Local invoice ${localInvoice.id} deleted`);
    }

    // Log operation
    await prisma.integrationLog.create({
      data: {
        service: "quickbooks",
        action: "invoice_deleted",
        status: "SUCCESS",
        payload: {
          qbInvoiceId,
          deletedAt: new Date(),
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invoice deleted successfully",
      qbInvoiceId,
      result: deleteResult,
    });
  } catch (error: any) {
    console.error("[DELETE_INVOICE] Error:", error);

    await prisma.integrationLog.create({
      data: {
        service: "quickbooks",
        action: "invoice_delete_failed",
        status: "ERROR",
        error: error.message || "Delete failed",
        payload: {
          errorStack: error.stack,
        } as any,
      },
    });

    return NextResponse.json(
      { error: error.message || "Failed to delete invoice" },
      { status: 500 }
    );
  }
}

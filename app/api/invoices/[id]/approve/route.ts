import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { invoiceApprovalService } from "@/lib/services/invoice-approval.service";
import { UserRole } from "@prisma/client";

/**
 * POST /api/invoices/:id/approve
 * Approve an invoice (FINANCE and ADMIN roles only)
 */
export async function POST(
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

    // Check if user has permission to approve invoices
    const userRole = (session.user as any).role as UserRole;
    if (userRole !== "FINANCE" && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only FINANCE and ADMIN roles can approve invoices" },
        { status: 403 }
      );
    }

    const invoiceId = params.id;
    const userId = (session.user as any).id;

    // Approve invoice
    const invoice = await invoiceApprovalService.approveInvoice(invoiceId, userId);

    return NextResponse.json({
      success: true,
      message: "Invoice approved successfully",
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        status: invoice.status,
        approvalStatus: invoice.approvalStatus,
        approvedBy: invoice.approvedBy,
        approvedAt: invoice.approvedAt,
        quickbooks_invoice_id: invoice.quickbooks_invoice_id,
      },
    });
  } catch (error) {
    console.error("[API] Error approving invoice:", error);

    return NextResponse.json(
      {
        error: "Failed to approve invoice",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

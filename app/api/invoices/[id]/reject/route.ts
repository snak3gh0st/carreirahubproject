import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { invoiceApprovalService } from "@/lib/services/invoice-approval.service";
import { UserRole } from "@prisma/client";

/**
 * POST /api/invoices/:id/reject
 * Reject an invoice (FINANCE and ADMIN roles only)
 * Body: { reason: string }
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

    // Check if user has permission to reject invoices
    const userRole = (session.user as any).role as UserRole;
    if (userRole !== "FINANCE" && userRole !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only FINANCE and ADMIN roles can reject invoices" },
        { status: 403 }
      );
    }

    const invoiceId = params.id;
    const userId = (session.user as any).id;

    // Parse request body
    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Rejection reason is required" },
        { status: 400 }
      );
    }

    // Reject invoice
    const invoice = await invoiceApprovalService.rejectInvoice(
      invoiceId,
      userId,
      reason.trim()
    );

    return NextResponse.json({
      success: true,
      message: "Invoice rejected successfully",
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        status: invoice.status,
        approvalStatus: invoice.approvalStatus,
        approvedBy: invoice.approvedBy,
        approvedAt: invoice.approvedAt,
        rejectedReason: invoice.rejectedReason,
      },
    });
  } catch (error) {
    console.error("[API] Error rejecting invoice:", error);

    return NextResponse.json(
      {
        error: "Failed to reject invoice",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/invoices/delete
 * Void an invoice in QuickBooks by ID
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

    console.log(`[VOID_INVOICE] Voiding QB invoice ${qbInvoiceId}...`);

    // Initialize QB service
    await quickbooksService.initialize();

    // Void in QB
    const voidResult = await quickbooksService.voidInvoice(qbInvoiceId);

    console.log(`[VOID_INVOICE] ✓ QB invoice ${qbInvoiceId} voided successfully`);

    // Delete from local database
    const localInvoice = await prisma.invoice.findFirst({
      where: { quickbooks_invoice_id: qbInvoiceId },
    });

    if (localInvoice) {
      await prisma.invoice.delete({
        where: { id: localInvoice.id },
      });
      console.log(`[VOID_INVOICE] ✓ Local invoice ${localInvoice.id} deleted`);
    }

    // Log operation
    await prisma.integrationLog.create({
      data: {
        service: "quickbooks",
        action: "invoice_voided",
        status: "SUCCESS",
        payload: {
          qbInvoiceId,
          voidedAt: new Date(),
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invoice voided successfully in QuickBooks",
      qbInvoiceId,
      result: voidResult,
    });
  } catch (error: any) {
    console.error("[VOID_INVOICE] Error:", error);

    await prisma.integrationLog.create({
      data: {
        service: "quickbooks",
        action: "invoice_void_failed",
        status: "ERROR",
        error: error.message || "Void failed",
        payload: {
          errorStack: error.stack,
        } as any,
      },
    });

    return NextResponse.json(
      { error: error.message || "Failed to void invoice" },
      { status: 500 }
    );
  }
}

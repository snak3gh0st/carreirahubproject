import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/[id]/send-payment-link
 * Re-send QB invoice email to customer (includes card + PayPal payment options)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN" && userRole !== "FINANCE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === InvoiceStatus.PAID) {
      return NextResponse.json(
        { error: "Invoice is already paid" },
        { status: 400 }
      );
    }

    if (invoice.status === InvoiceStatus.VOID) {
      return NextResponse.json(
        { error: "Invoice is voided" },
        { status: 400 }
      );
    }

    if (!invoice.quickbooks_invoice_id) {
      return NextResponse.json(
        { error: "Invoice is not synced to QuickBooks" },
        { status: 400 }
      );
    }

    // Initialize QB and re-send invoice email
    await quickbooksService.initialize();
    await quickbooksService.sendInvoice(
      invoice.quickbooks_invoice_id,
      invoice.customer.email
    );

    // Log the action
    await prisma.integrationLog.create({
      data: {
        service: "QUICKBOOKS",
        action: "INVOICE_EMAIL_RESENT",
        status: "SUCCESS",
        payload: {
          invoiceId: params.id,
          qbInvoiceId: invoice.quickbooks_invoice_id,
          sentBy: (session.user as any).id,
          recipientEmail: invoice.customer.email,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Invoice email sent successfully via QuickBooks",
    });
  } catch (error) {
    console.error("[SEND_INVOICE_EMAIL_ERROR]", error);

    await prisma.integrationLog.create({
      data: {
        service: "QUICKBOOKS",
        action: "INVOICE_EMAIL_RESEND_FAILED",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        payload: { invoiceId: params.id } as any,
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send invoice email" },
      { status: 500 }
    );
  }
}

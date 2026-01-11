import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { paymentWorkflowService } from "@/lib/services/payment-workflow.service";
import { ContractStatus, InvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/[id]/send-payment-link
 * Send or resend payment link to customer
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
      include: {
        contract: true,
        customer: true,
      },
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

    if (!invoice.contract || invoice.contract.status !== ContractStatus.SIGNED) {
      return NextResponse.json(
        { error: "Contract must be signed before sending payment link" },
        { status: 400 }
      );
    }

    // Send payment link
    await paymentWorkflowService.sendPaymentLinkAfterSignature(
      {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        stripePaymentLinkId: invoice.stripePaymentLinkId,
        paymentReminderCount: invoice.paymentReminderCount,
        customer: {
          id: invoice.customer.id,
          name: invoice.customer.name,
          email: invoice.customer.email,
          stripe_id: invoice.customer.stripe_id,
          quickbooks_id: invoice.customer.quickbooks_id,
        },
      },
      {
        id: invoice.contract!.id,
        status: invoice.contract!.status,
      }
    );

    // Log the action
    await prisma.integrationLog.create({
      data: {
        service: "PAYMENT_WORKFLOW",
        action: "MANUAL_PAYMENT_LINK_SENT",
        status: "SUCCESS",
        payload: {
          invoiceId: params.id,
          sentBy: (session.user as any).id,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payment link sent successfully",
    });
  } catch (error) {
    console.error("[SEND_PAYMENT_LINK_ERROR]", error);

    // Log the error
    await prisma.integrationLog.create({
      data: {
        service: "PAYMENT_WORKFLOW",
        action: "MANUAL_PAYMENT_LINK_FAILED",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        payload: { invoiceId: params.id } as any,
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send payment link" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contractWorkflowService } from "@/lib/services/contract-workflow.service";
import { ContractStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/[id]/resend-contract
 * Resend contract reminder to customer
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

    if (!invoice.contract) {
      return NextResponse.json(
        { error: "No contract found for this invoice" },
        { status: 400 }
      );
    }

    if (invoice.contract.status !== ContractStatus.SENT_FOR_SIGNATURE) {
      return NextResponse.json(
        { error: "Contract is not in pending signature status" },
        { status: 400 }
      );
    }

    // Send reminder
    await contractWorkflowService.sendReminderForContract(invoice.contract);

    // Log the action
    await prisma.integrationLog.create({
      data: {
        service: "CONTRACT_WORKFLOW",
        action: "MANUAL_REMINDER_SENT",
        status: "SUCCESS",
        payload: {
          invoiceId: params.id,
          contractId: invoice.contract.id,
          sentBy: (session.user as any).id,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Contract reminder sent successfully",
    });
  } catch (error) {
    console.error("[RESEND_CONTRACT_ERROR]", error);

    // Log the error
    await prisma.integrationLog.create({
      data: {
        service: "CONTRACT_WORKFLOW",
        action: "MANUAL_REMINDER_FAILED",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        payload: { invoiceId: params.id } as any,
      },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send reminder" },
      { status: 500 }
    );
  }
}

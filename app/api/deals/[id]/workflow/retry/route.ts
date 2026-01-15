import { NextRequest, NextResponse } from "next/server";
import { workflowStatusService } from "@/lib/services/workflow-status.service";
import { prisma } from "@/lib/db";
import { invoiceWorkflowService } from "@/lib/services/invoice-workflow.service";

/**
 * POST /api/deals/:id/workflow/retry
 *
 * Retry the entire failed workflow for a deal
 * This endpoint is called from the dashboard UI forms
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dealId = params.id;

    // Get deal
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: true,
      },
    });

    if (!deal) {
      return NextResponse.json(
        {
          success: false,
          error: "Deal not found",
        },
        { status: 404 }
      );
    }

    if (deal.workflowStatus !== "FAILED") {
      return NextResponse.json(
        {
          success: false,
          error: "Workflow is not in FAILED state",
        },
        { status: 400 }
      );
    }

    // Reset workflow status to retry
    await prisma.deal.update({
      where: { id: dealId },
      data: {
        workflowStatus: "IN_PROGRESS",
        workflowError: null,
      },
    });

    // Re-trigger the entire workflow
    try {
      await invoiceWorkflowService.processDealWon(dealId);

      return NextResponse.json({
        success: true,
        message: "Workflow retry initiated successfully",
      });
    } catch (error) {
      // Mark as failed again with new error
      await prisma.deal.update({
        where: { id: dealId },
        data: {
          workflowStatus: "FAILED",
          workflowError:
            error instanceof Error ? error.message : "Retry failed",
        },
      });

      throw error;
    }
  } catch (error) {
    console.error("[Workflow Retry API] POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retry workflow",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { workflowStatusService } from "@/lib/services/workflow-status.service";

/**
 * GET /api/deals/:id/workflow
 *
 * Get current workflow status for a deal
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dealId = params.id;

    const status = await workflowStatusService.getWorkflowStatus(dealId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error("[Workflow Status API] GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get workflow status",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/deals/:id/workflow/retry
 *
 * Retry a failed workflow step
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const dealId = params.id;
    const body = await request.json();
    const { step } = body;

    if (!step || (step !== "invoice" && step !== "contract")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid step. Must be 'invoice' or 'contract'",
        },
        { status: 400 }
      );
    }

    const result = await workflowStatusService.retryFailedStep(dealId, step);

    return NextResponse.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    console.error("[Workflow Status API] POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retry workflow step",
      },
      { status: 500 }
    );
  }
}

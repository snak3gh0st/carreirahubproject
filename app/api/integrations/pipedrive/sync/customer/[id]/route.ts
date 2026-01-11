import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addPipedriveReverseSyncJob } from "@/lib/utils/queue";
import { UserRole } from "@prisma/client";

/**
 * POST /api/integrations/pipedrive/sync/customer/:id
 * Manually trigger Customer → Pipedrive sync
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

    // Check permissions (ADMIN, FINANCE, SALES only)
    const userRole = (session.user as any).role as UserRole;
    if (userRole !== "ADMIN" && userRole !== "FINANCE" && userRole !== "SALES") {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to trigger sync" },
        { status: 403 }
      );
    }

    const customerId = params.id;

    // Queue sync job
    await addPipedriveReverseSyncJob({
      type: "customer",
      entityId: customerId,
    });

    return NextResponse.json({
      success: true,
      message: "Customer sync to Pipedrive queued successfully",
      customerId,
    });
  } catch (error) {
    console.error("[API] Error syncing customer to Pipedrive:", error);

    return NextResponse.json(
      {
        error: "Failed to sync customer to Pipedrive",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

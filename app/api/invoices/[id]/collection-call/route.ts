import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { collectionCallService } from "@/lib/services/collection-call.service";
import { InvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/[id]/collection-call
 * Trigger a collection call for an overdue invoice
 * Auth: FINANCE or ADMIN role required
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

    // Check if service is configured
    if (!collectionCallService.isConfigured()) {
      return NextResponse.json(
        { error: "Collection call service is not configured" },
        { status: 503 }
      );
    }

    // Get invoice to validate
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== InvoiceStatus.OVERDUE) {
      return NextResponse.json(
        { error: "Invoice must be overdue to initiate a collection call" },
        { status: 400 }
      );
    }

    if (!invoice.customer.phone) {
      return NextResponse.json(
        { error: "Customer has no phone number" },
        { status: 400 }
      );
    }

    // Initiate the call
    const result = await collectionCallService.initiateCollectionCall({
      invoiceId: params.id,
      initiatedBy: (session.user as any).id,
    });

    return NextResponse.json({
      success: true,
      message: "Collection call initiated",
      callId: result.id,
      externalCallId: result.externalCallId,
      status: result.status,
    });
  } catch (error) {
    console.error("[COLLECTION_CALL_ERROR]", error);

    // Return specific error messages for known cases
    if (error instanceof Error) {
      if (error.message.includes("last 24 hours")) {
        return NextResponse.json(
          { error: "Customer was called recently. Please wait 24 hours between calls." },
          { status: 429 }
        );
      }
      if (error.message.includes("Maximum call attempts")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      if (error.message.includes("calling hours")) {
        return NextResponse.json(
          { error: "Outside of calling hours (9 AM - 6 PM Brazil time)" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate call" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invoices/[id]/collection-call
 * Get collection call history for an invoice
 */
export async function GET(
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

    // Verify invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Get call history
    const calls = await collectionCallService.getCallHistory(params.id);

    return NextResponse.json({
      success: true,
      calls,
      totalCalls: calls.length,
      configured: collectionCallService.isConfigured(),
    });
  } catch (error) {
    console.error("[COLLECTION_CALL_HISTORY_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch call history" },
      { status: 500 }
    );
  }
}

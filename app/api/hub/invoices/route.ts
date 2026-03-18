import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/invoices
 * List all invoices for the authenticated client user's customer.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { customerId: auth.customerId },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        amountPaid: true,
        status: true,
        dueDate: true,
        paidAt: true,
        paymentMethod: true,
      },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("[Hub Invoices] Error listing invoices:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

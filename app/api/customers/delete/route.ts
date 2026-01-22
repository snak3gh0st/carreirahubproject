import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

/**
 * DELETE /api/customers/delete
 * Delete a customer from QuickBooks by QB Customer ID
 *
 * Body:
 * {
 *   "qbCustomerId": "1462"
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
    const { qbCustomerId } = await request.json();

    if (!qbCustomerId) {
      return NextResponse.json({ error: "Missing qbCustomerId" }, { status: 400 });
    }

    console.log(`[DELETE_CUSTOMER] Deleting QB customer ${qbCustomerId}...`);

    // Initialize QB service
    await quickbooksService.initialize();

    // Delete from QB
    const deleteResult = await quickbooksService.deleteCustomer(qbCustomerId);

    console.log(`[DELETE_CUSTOMER] ✓ QB customer ${qbCustomerId} deleted successfully`);

    // Delete from local database
    const localCustomer = await prisma.customer.findFirst({
      where: { quickbooks_id: qbCustomerId },
    });

    if (localCustomer) {
      // Also delete related invoices
      await prisma.invoice.deleteMany({
        where: { customerId: localCustomer.id },
      });

      // Delete the customer
      await prisma.customer.delete({
        where: { id: localCustomer.id },
      });

      console.log(`[DELETE_CUSTOMER] ✓ Local customer ${localCustomer.id} and related invoices deleted`);
    }

    // Log operation
    await prisma.integrationLog.create({
      data: {
        service: "quickbooks",
        action: "customer_deleted",
        status: "SUCCESS",
        payload: {
          qbCustomerId,
          deletedAt: new Date(),
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully",
      qbCustomerId,
      result: deleteResult,
    });
  } catch (error: any) {
    console.error("[DELETE_CUSTOMER] Error:", error);

    await prisma.integrationLog.create({
      data: {
        service: "quickbooks",
        action: "customer_delete_failed",
        status: "ERROR",
        error: error.message || "Delete failed",
        payload: {
          errorStack: error.stack,
        } as any,
      },
    });

    return NextResponse.json(
      { error: error.message || "Failed to delete customer" },
      { status: 500 }
    );
  }
}

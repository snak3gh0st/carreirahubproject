import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { validateCustomerDeleteConfirmation } from "@/lib/customers/delete-policy";

/**
 * POST /api/customers/delete
 * Deletes a customer from external systems when available, then removes the
 * local customer graph after an exact-name confirmation.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "FINANCE"].includes(role)) {
    return NextResponse.json(
      { error: "Forbidden - ADMIN or FINANCE required" },
      { status: 403 }
    );
  }

  try {
    const { customerId, confirmName } = (await request.json()) as {
      customerId?: string;
      confirmName?: string;
    };

    if (!customerId || !confirmName) {
      return NextResponse.json(
        { error: "Missing customerId or confirmName" },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        quickbooks_id: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const confirmation = validateCustomerDeleteConfirmation(
      customer.name,
      confirmName
    );
    if (!confirmation.allowed) {
      return NextResponse.json(
        { error: confirmation.reason },
        { status: 400 }
      );
    }

    let quickbooksDeleted = false;
    if (customer.quickbooks_id) {
      await quickbooksService.initialize();
      await quickbooksService.deleteCustomer(customer.quickbooks_id);
      quickbooksDeleted = true;
    }

    const deletionCounts = await prisma.$transaction(async (tx) => {
      const counts: Record<string, number> = {};
      const enrollmentIds = (
        await tx.mentorshipEnrollment.findMany({
          where: { customerId },
          select: { id: true },
        })
      ).map((enrollment) => enrollment.id);

      async function record(
        key: string,
        action: Promise<{ count: number }>
      ) {
        const result = await action;
        counts[key] = result.count;
      }

      await record(
        "opsThreadsUnlinked",
        tx.opsDigisacThread.updateMany({
          where: {
            OR: [
              { customerId },
              ...(enrollmentIds.length > 0
                ? [{ enrollmentId: { in: enrollmentIds } }]
                : []),
            ],
          },
          data: { customerId: null, enrollmentId: null },
        })
      );

      await record(
        "notifications",
        tx.notification.deleteMany({
          where: {
            OR: [
              { customerId },
              { invoice: { is: { customerId } } },
              { contract: { is: { customerId } } },
            ],
          },
        })
      );

      await record(
        "alerts",
        tx.alert.deleteMany({
          where: {
            OR: [
              { customerId },
              { invoice: { is: { customerId } } },
              { deal: { is: { customerId } } },
            ],
          },
        })
      );

      await record("payments", tx.payment.deleteMany({ where: { customerId } }));
      await record(
        "collectionCalls",
        tx.collectionCall.deleteMany({ where: { customerId } })
      );
      await record(
        "formSubmissions",
        tx.formSubmission.deleteMany({ where: { customerId } })
      );
      await record(
        "formAssignments",
        tx.formAssignment.deleteMany({ where: { customerId } })
      );
      await record(
        "placementTests",
        tx.placementTest.deleteMany({ where: { customerId } })
      );
      await record(
        "clientUsers",
        tx.clientUser.deleteMany({ where: { customerId } })
      );

      if (enrollmentIds.length > 0) {
        await record(
          "mentorshipSessions",
          tx.mentorshipSession.deleteMany({
            where: { enrollmentId: { in: enrollmentIds } },
          })
        );
        await record(
          "phaseTransitions",
          tx.phaseTransition.deleteMany({
            where: { enrollmentId: { in: enrollmentIds } },
          })
        );
        await record(
          "phaseChecklistProgress",
          tx.phaseChecklistProgress.deleteMany({
            where: { enrollmentId: { in: enrollmentIds } },
          })
        );
        await record(
          "opsStudentComments",
          tx.opsStudentComment.deleteMany({
            where: { enrollmentId: { in: enrollmentIds } },
          })
        );
      }

      await record(
        "mentorshipEnrollments",
        tx.mentorshipEnrollment.deleteMany({ where: { customerId } })
      );
      await record("invoices", tx.invoice.deleteMany({ where: { customerId } }));
      await record("contracts", tx.contract.deleteMany({ where: { customerId } }));
      await record("deals", tx.deal.deleteMany({ where: { customerId } }));
      await tx.customer.delete({ where: { id: customerId } });
      counts.customers = 1;

      return counts;
    });

    await prisma.integrationLog.create({
      data: {
        service: "customer",
        action: "customer_deleted",
        status: "SUCCESS",
        payload: {
          customerId,
          customerEmail: customer.email,
          quickbooksDeleted,
          quickbooksId: customer.quickbooks_id,
          deletionCounts,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer deleted successfully",
      quickbooksDeleted,
      deletionCounts,
    });
  } catch (error: any) {
    console.error("[DELETE_CUSTOMER] Error:", error);

    await prisma.integrationLog.create({
      data: {
        service: "customer",
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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMissingOpsNativeTable } from "@/lib/ops/native-schema";
import { isOperationalAccessRole } from "@/lib/roles";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role as string;
  if (!isOperationalAccessRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollmentInclude = {
    customer: {
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        qbBalance: true,
        invoices: {
          orderBy: { createdAt: "desc" as const },
          take: 8,
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
            amountPaid: true,
            dueDate: true,
            status: true,
          },
        },
        contracts: {
          where: { status: "SIGNED" as const, signedAt: { not: null } },
          orderBy: { signedAt: "desc" as const },
          take: 1,
          select: {
            id: true,
            status: true,
            sentAt: true,
            signedAt: true,
            docusign_env_id: true,
          },
        },
      },
    },
    assignedTo: {
      select: { id: true, name: true },
    },
    transitions: {
      orderBy: { createdAt: "desc" as const },
      take: 1,
      select: { createdAt: true },
    },
    sessions: {
      orderBy: { sessionDate: "desc" as const },
      take: 1,
      select: { sessionDate: true },
    },
    checklistProgress: {
      where: { completedAt: { not: null } },
      select: { phaseKey: true, itemKey: true, completedAt: true },
    },
    _count: { select: { sessions: true } },
  };

  try {
    const phases = await prisma.mentorshipPhase.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            ...enrollmentInclude,
            opsProfile: {
              select: {
                renewalDate: true,
                renewalState: true,
                lastOperationalContactAt: true,
                coachCohort: true,
              },
            },
            opsActivities: {
              orderBy: { activityDate: "desc" as const },
              take: 3,
              select: {
                type: true,
                activityDate: true,
                company: true,
                roleTitle: true,
                outcome: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(phases, { status: 200 });
  } catch (error) {
    if (!isMissingOpsNativeTable(error)) throw error;
  }

  const phases = await prisma.mentorshipPhase.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: enrollmentInclude,
      },
    },
  });

  return NextResponse.json(
    phases.map((phase) => ({
      ...phase,
      enrollments: phase.enrollments.map((enrollment) => ({
        ...enrollment,
        opsProfile: null,
        opsActivities: [],
      })),
    })),
    { status: 200 }
  );
}

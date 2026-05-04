import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "OPERATIONAL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const phases = await prisma.mentorshipPhase.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      enrollments: {
        where: { status: "ACTIVE" },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              qbBalance: true,
              invoices: {
                orderBy: { createdAt: "desc" },
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
            },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          transitions: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
          sessions: {
            orderBy: { sessionDate: "desc" },
            take: 1,
            select: { sessionDate: true },
          },
          checklistProgress: {
            where: { completedAt: { not: null } },
            select: { phaseKey: true, itemKey: true, completedAt: true },
          },
          _count: { select: { sessions: true } },
        },
      },
    },
  });

  return NextResponse.json(phases, { status: 200 });
}

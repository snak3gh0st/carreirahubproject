import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.id },
    include: {
      customer: {
        select: { id: true, name: true, email: true, phone: true },
      },
      currentPhase: { select: { id: true, label: true, sortOrder: true } },
      assignedTo: { select: { id: true, name: true } },
      transitions: {
        orderBy: { createdAt: "asc" },
        include: {
          fromPhase: { select: { label: true } },
          toPhase: { select: { label: true } },
          triggeredBy: { select: { name: true } },
        },
      },
      sessions: {
        orderBy: { sessionDate: "desc" },
        take: 20,
        include: {
          conductor: { select: { name: true } },
        },
      },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  // Fetch most recent placement test for the customer
  const placementTest = await prisma.placementTest.findFirst({
    where: { customerId: enrollment.customer.id },
    orderBy: { createdAt: "desc" },
    select: { cefrLevel: true, displayLevel: true, percentage: true, createdAt: true },
  });

  // Total session count for pagination metadata
  const totalSessions = await prisma.mentorshipSession.count({
    where: { enrollmentId: params.id },
  });

  return NextResponse.json({ enrollment, placementTest, totalSessions });
}

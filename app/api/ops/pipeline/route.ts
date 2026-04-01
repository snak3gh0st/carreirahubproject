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
              qbBalance: true,
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
        },
      },
    },
  });

  return NextResponse.json(phases, { status: 200 });
}

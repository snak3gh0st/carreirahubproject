import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Return customers who have no active MentorshipEnrollment
  const customers = await prisma.customer.findMany({
    where: {
      mentorshipEnrollments: {
        none: {
          status: "ACTIVE",
        },
      },
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      placementTests: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { cefrLevel: true },
      },
    },
  });

  return NextResponse.json({
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      cefrLevel: c.placementTests[0]?.cefrLevel ?? null,
    })),
  });
}

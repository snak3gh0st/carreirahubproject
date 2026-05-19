import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  if (q.length < 2) {
    return NextResponse.json({ customers: [] });
  }

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    include: {
      placementTests: {
        where: { totalScore: { not: -1 } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      englishRealtimeTests: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    take: 10,
  });

  return NextResponse.json({
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      cefrLevel:
        customer.englishRealtimeTests[0] &&
        (!customer.placementTests[0] ||
          customer.englishRealtimeTests[0].createdAt > customer.placementTests[0].createdAt)
          ? customer.englishRealtimeTests[0].cefrLevel
          : customer.placementTests[0]?.cefrLevel ?? null,
    })),
  });
}

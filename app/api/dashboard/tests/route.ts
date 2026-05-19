import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    const whereClause: any = {};
    if (customerId) {
      whereClause.customerId = customerId;
    }

    const tests = await prisma.placementTest.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const realtimeTests = await prisma.englishRealtimeTest.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
        NOT: { model: { startsWith: "voice-turn:" } },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      tests: tests.map((test) => ({
        id: test.id,
        section1Score: test.section1Score,
        section2Score: test.section2Score,
        section3Score: test.section3Score,
        section4Score: test.section4Score,
        section5Score: test.section5Score,
        totalScore: test.totalScore,
        percentage: test.percentage,
        cefrLevel: test.cefrLevel,
        displayLevel: test.displayLevel,
        timeSpentSeconds: test.timeSpentSeconds,
        createdAt: test.createdAt,
        customerId: test.customerId,
        customer: test.customer,
      })),
      realtimeTests: realtimeTests.map((test) => ({
        id: test.id,
        status: test.status,
        cefrLevel: test.cefrLevel,
        displayLevel: test.displayLevel,
        score: test.score,
        durationSeconds: test.durationSeconds,
        createdAt: test.createdAt,
        completedAt: test.completedAt,
        customerId: test.customerId,
        customer: test.customer,
      })),
    });
  } catch (error) {
    console.error("[Dashboard Tests Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch placement tests" },
      { status: 500 }
    );
  }
}

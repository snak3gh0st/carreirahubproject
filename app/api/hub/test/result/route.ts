import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/test/result
 * Get the latest completed placement test result for the authenticated client.
 * Excludes pending tests (totalScore: -1).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const test = await prisma.placementTest.findFirst({
      where: { customerId: auth.customerId, totalScore: { not: -1 } },
      orderBy: { createdAt: "desc" },
    });

    if (!test) {
      return NextResponse.json({ result: null });
    }

    return NextResponse.json({
      result: {
        section1Score: test.section1Score,
        section2Score: test.section2Score,
        section3Score: test.section3Score,
        section4Score: test.section4Score,
        section5Score: test.section5Score,
        totalScore: test.totalScore,
        questionCount: test.questionCount,
        percentage: test.percentage,
        cefrLevel: test.cefrLevel,
        displayLevel: test.displayLevel,
        timeSpentSeconds: test.timeSpentSeconds,
        createdAt: test.createdAt,
      },
    });
  } catch (error) {
    console.error("[Hub Test] Error fetching test result:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

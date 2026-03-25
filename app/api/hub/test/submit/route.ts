import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { calculateScore } from "@/lib/hub/english-test";

export const dynamic = "force-dynamic";

/**
 * POST /api/hub/test/submit
 * Submit test answers, calculate score, persist result.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const body = await request.json();
    const { answers, timeSpentSeconds } = body as {
      answers: Record<string, number>;
      timeSpentSeconds?: number;
    };

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid answers" },
        { status: 400 }
      );
    }

    // Calculate score using the contiguous algorithm
    const score = calculateScore(answers);

    // Persist placement test result
    await prisma.placementTest.create({
      data: {
        customerId: auth.customerId,
        section1Score: score.sectionScores[0],
        section2Score: score.sectionScores[1],
        section3Score: score.sectionScores[2],
        section4Score: score.sectionScores[3],
        section5Score: score.sectionScores[4],
        totalScore: score.totalScore,
        percentage: score.percentage,
        cefrLevel: score.cefrLevel,
        displayLevel: score.displayLevel,
        timeSpentSeconds: timeSpentSeconds ?? null,
        answers,
      },
    });

    // Invalidate cached pages so dashboard shows updated test result
    revalidatePath("/hub");
    revalidatePath("/hub/status");
    revalidatePath("/hub/test/result");

    return NextResponse.json({
      result: {
        sectionScores: score.sectionScores,
        totalScore: score.totalScore,
        percentage: score.percentage,
        cefrLevel: score.cefrLevel,
        displayLevel: score.displayLevel,
        displayLevelPt: score.displayLevelPt,
      },
    });
  } catch (error) {
    console.error("[Hub Test] Error submitting test:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

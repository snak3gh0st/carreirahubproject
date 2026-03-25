import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { scoreAnswers } from "@/lib/hub/question-bank";

export const dynamic = "force-dynamic";

/**
 * POST /api/hub/test/submit
 * Submit test answers, score against the specific questions served, persist result.
 * Requires a valid testId matching a pending PlacementTest record.
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
    const { answers, timeSpentSeconds, testId } = body as {
      answers: Record<string, number>;
      timeSpentSeconds?: number;
      testId?: string;
    };

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid answers" },
        { status: 400 }
      );
    }

    if (!testId) {
      return NextResponse.json(
        { error: "Missing testId" },
        { status: 400 }
      );
    }

    // Find the pending test for this student
    const pendingTest = await prisma.placementTest.findFirst({
      where: { id: testId, customerId: auth.customerId, totalScore: -1 },
    });

    if (!pendingTest) {
      return NextResponse.json(
        { error: "No pending test found or already submitted" },
        { status: 400 }
      );
    }

    // Score using the specific questions that were served
    const result = scoreAnswers(answers, pendingTest.questionIds);

    // Update the pending record (not create a new one)
    await prisma.placementTest.update({
      where: { id: pendingTest.id },
      data: {
        section1Score: result.sectionScores[0],
        section2Score: result.sectionScores[1],
        section3Score: result.sectionScores[2],
        section4Score: result.sectionScores[3],
        section5Score: result.sectionScores[4],
        totalScore: result.totalScore,
        percentage: result.percentage,
        cefrLevel: result.cefrLevel,
        displayLevel: result.displayLevel,
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
        sectionScores: result.sectionScores,
        sectionMaxes: result.sectionMaxes,
        totalScore: result.totalScore,
        questionCount: pendingTest.questionCount,
        percentage: result.percentage,
        cefrLevel: result.cefrLevel,
        displayLevel: result.displayLevel,
        displayLevelPt: result.displayLevelPt,
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

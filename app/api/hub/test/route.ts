import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import {
  generateTest,
  toClientQuestion,
  getQuestionsByIds,
} from "@/lib/hub/question-bank";
import { canStartPlacementTest } from "@/lib/hub/placement-test-policy";

export const dynamic = "force-dynamic";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * GET /api/hub/test
 * Returns a randomized 25-question set for the authenticated student.
 * - Returns the same pending test if one exists (< 24 hours old).
 * - Generates a new test with no-repeat guarantee against prior tests.
 * - Never sends correctIndex to the client.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const priorTests = await prisma.placementTest.findMany({
      where: { customerId: auth.customerId, totalScore: { not: -1 } },
      select: { questionIds: true },
    });
    const testPolicy = canStartPlacementTest(priorTests.length);
    if (!testPolicy.allowed) {
      return NextResponse.json(
        { error: testPolicy.reason, code: "RETAKE_LIMIT_REACHED" },
        { status: 403 }
      );
    }

    // Check for an existing pending test (totalScore: -1 = sentinel for pending)
    const pendingTest = await prisma.placementTest.findFirst({
      where: { customerId: auth.customerId, totalScore: -1 },
      orderBy: { createdAt: "desc" },
    });

    if (pendingTest) {
      const ageMs = Date.now() - pendingTest.createdAt.getTime();

      if (ageMs < TWENTY_FOUR_HOURS_MS && pendingTest.questionIds.length > 0) {
        // Return the existing pending test
        const questions = getQuestionsByIds(pendingTest.questionIds).map(
          toClientQuestion
        );
        return NextResponse.json({ questions, testId: pendingTest.id });
      }

      // Pending test is expired (> 24 hours old) — delete it (deleteMany avoids P2025 on race)
      await prisma.placementTest.deleteMany({ where: { id: pendingTest.id } });
    }

    // Collect previously seen question IDs from completed tests
    const seenIds = new Set<string>(priorTests.flatMap((t) => t.questionIds));

    // Generate a new randomized test
    const selected = generateTest(seenIds);

    // Create a pending PlacementTest record (totalScore: -1 = not yet submitted)
    const test = await prisma.placementTest.create({
      data: {
        customerId: auth.customerId,
        questionIds: selected.map((q) => q.id),
        questionCount: selected.length,
        totalScore: -1, // sentinel: pending
        percentage: 0,
        cefrLevel: "",
        displayLevel: "",
        section1Score: 0,
        section2Score: 0,
        section3Score: 0,
        section4Score: 0,
        section5Score: 0,
        answers: {},
      },
    });

    return NextResponse.json({
      questions: selected.map(toClientQuestion),
      testId: test.id,
    });
  } catch (error) {
    console.error("[Hub Test] Error fetching questions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

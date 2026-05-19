import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await prisma.aiMockInterviewSession.findFirst({
      where: { customerId: auth.customerId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        targetRole: true,
        overallScore: true,
        communicationScore: true,
        experienceScore: true,
        problemSolvingScore: true,
        roleFitScore: true,
        executivePresenceScore: true,
        hiringSignal: true,
        summary: true,
        strengths: true,
        risks: true,
        focusAreas: true,
        suggestedPracticeQuestions: true,
        durationSeconds: true,
        completedAt: true,
      },
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[Hub AI Mock Interview] Error loading result:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import {
  AI_MOCK_INTERVIEW_MAX_TRANSCRIPT_ITEMS,
  countAiMockInterviewCandidateTurns,
  normalizeAiMockInterviewTranscript,
} from "@/lib/hub/ai-mock-interview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clampDurationSeconds(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(60 * 45, Math.round(n));
}

async function findActiveSession(customerId: string) {
  return prisma.aiMockInterviewSession.findFirst({
    where: { customerId, status: "IN_PROGRESS" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      transcript: true,
      durationSeconds: true,
      targetRole: true,
      updatedAt: true,
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activeSession = await findActiveSession(auth.customerId);
    const transcript = normalizeAiMockInterviewTranscript(activeSession?.transcript)
      .slice(-AI_MOCK_INTERVIEW_MAX_TRANSCRIPT_ITEMS);

    return NextResponse.json({
      sessionId: activeSession?.id ?? null,
      targetRole: activeSession?.targetRole ?? null,
      transcript,
      durationSeconds: activeSession?.durationSeconds ?? null,
      updatedAt: activeSession?.updatedAt?.toISOString() ?? null,
      candidateTurns: countAiMockInterviewCandidateTurns(transcript),
    });
  } catch (error) {
    console.error("[Hub AI Mock Interview] Error loading progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const existing = await prisma.aiMockInterviewSession.findFirst({
      where: { id: sessionId, customerId: auth.customerId, status: "IN_PROGRESS" },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mock interview session not found" }, { status: 404 });
    }

    const transcript = normalizeAiMockInterviewTranscript(body?.transcript)
      .slice(-AI_MOCK_INTERVIEW_MAX_TRANSCRIPT_ITEMS);
    const durationSeconds = clampDurationSeconds(body?.durationSeconds);

    await prisma.aiMockInterviewSession.update({
      where: { id: existing.id },
      data: {
        transcript: transcript as unknown as Prisma.InputJsonValue,
        ...(durationSeconds !== null ? { durationSeconds } : {}),
      },
    });

    return NextResponse.json({
      transcript,
      candidateTurns: countAiMockInterviewCandidateTurns(transcript),
    });
  } catch (error) {
    console.error("[Hub AI Mock Interview] Error saving progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

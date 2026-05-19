import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import {
  REALTIME_ENGLISH_TEST_MAX_TRANSCRIPT_ITEMS,
  getRealtimeEnglishTestProgress,
  normalizeRealtimeEnglishTranscript,
} from "@/lib/hub/realtime-english-test-flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function clampDurationSeconds(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(60 * 30, Math.round(n));
}

async function findActiveRealtimeTest(customerId: string) {
  return prisma.englishRealtimeTest.findFirst({
    where: {
      customerId,
      status: "IN_PROGRESS",
      NOT: { model: { startsWith: "voice-turn:" } },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      transcript: true,
      durationSeconds: true,
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

    const activeTest = await findActiveRealtimeTest(auth.customerId);
    const transcript = normalizeRealtimeEnglishTranscript(activeTest?.transcript)
      .slice(-REALTIME_ENGLISH_TEST_MAX_TRANSCRIPT_ITEMS);

    return NextResponse.json({
      testId: activeTest?.id ?? null,
      transcript,
      durationSeconds: activeTest?.durationSeconds ?? null,
      updatedAt: activeTest?.updatedAt?.toISOString() ?? null,
      progress: getRealtimeEnglishTestProgress(transcript),
    });
  } catch (error) {
    console.error("[Hub Realtime English] Error loading progress:", error);
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
    const testId = typeof body?.testId === "string" ? body.testId : "";
    if (!testId) {
      return NextResponse.json({ error: "Missing testId" }, { status: 400 });
    }

    const existing = await prisma.englishRealtimeTest.findFirst({
      where: {
        id: testId,
        customerId: auth.customerId,
        status: "IN_PROGRESS",
        NOT: { model: { startsWith: "voice-turn:" } },
      },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Realtime test not found" }, { status: 404 });
    }

    const transcript = normalizeRealtimeEnglishTranscript(body?.transcript)
      .slice(-REALTIME_ENGLISH_TEST_MAX_TRANSCRIPT_ITEMS);
    const durationSeconds = clampDurationSeconds(body?.durationSeconds);

    await prisma.englishRealtimeTest.update({
      where: { id: existing.id },
      data: {
        transcript: transcript as unknown as Prisma.InputJsonValue,
        ...(durationSeconds !== null ? { durationSeconds } : {}),
      },
    });

    return NextResponse.json({
      transcript,
      progress: getRealtimeEnglishTestProgress(transcript),
    });
  } catch (error) {
    console.error("[Hub Realtime English] Error saving progress:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { normalizeRealtimeEnglishResult } from "@/lib/hub/realtime-english-test";
import { handleCompletedEnglishTestOutcome } from "@/lib/hub/english-test-outcome";
import {
  WRITTEN_TEST_REQUIRED_CODE,
  getOralEnglishTestAccess,
} from "@/lib/hub/english-test-access";
import type { Language } from "@/lib/i18n/hub";

export const dynamic = "force-dynamic";

function clampDurationSeconds(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(60 * 30, Math.round(n));
}

function normalizeTranscript(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item) => item && typeof item === "object")
    .slice(-100);
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

    const oralAccess = await getOralEnglishTestAccess(
      auth.customerId,
      (auth.language || "en") as Language
    );
    if (!oralAccess.unlocked) {
      return NextResponse.json(
        {
          code: WRITTEN_TEST_REQUIRED_CODE,
          error: oralAccess.message,
          oralAccess,
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const testId = typeof body?.testId === "string" ? body.testId : "";
    if (!testId) {
      return NextResponse.json({ error: "Missing testId" }, { status: 400 });
    }

    const existing = await prisma.englishRealtimeTest.findFirst({
      where: { id: testId, customerId: auth.customerId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Realtime test not found" }, { status: 404 });
    }

    const normalized = normalizeRealtimeEnglishResult(body?.result);
    const transcript = normalizeTranscript(body?.transcript);
    const durationSeconds = clampDurationSeconds(body?.durationSeconds);

    const result = await prisma.englishRealtimeTest.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        cefrLevel: normalized.cefrLevel,
        displayLevel: normalized.displayLevel,
        score: normalized.score,
        fluencyScore: normalized.fluencyScore,
        pronunciationScore: normalized.pronunciationScore,
        grammarScore: normalized.grammarScore,
        vocabularyScore: normalized.vocabularyScore,
        comprehensionScore: normalized.comprehensionScore,
        summary: normalized.summary,
        strengths: normalized.strengths,
        focusAreas: normalized.focusAreas,
        ...(transcript ? { transcript } : {}),
        ...(durationSeconds !== null ? { durationSeconds } : {}),
        completedAt: new Date(),
      },
    });

    await handleCompletedEnglishTestOutcome({
      customerId: auth.customerId,
      testKind: "REALTIME",
      testId: result.id,
      cefrLevel: normalized.cefrLevel,
      displayLevel: normalized.displayLevel,
      score: normalized.score,
    }).catch((outcomeError) => {
      console.warn("[Hub Realtime English] Could not process English test outcome:", outcomeError);
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[Hub Realtime English] Error saving result:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await prisma.englishRealtimeTest.findFirst({
      where: { customerId: auth.customerId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[Hub Realtime English] Error loading result:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

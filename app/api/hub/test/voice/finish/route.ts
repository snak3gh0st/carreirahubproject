import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import type { Language } from "@/lib/i18n/hub";
import { createOpenAIChatCompletion } from "@/lib/services/openai-chat-completions";
import {
  buildVoiceFinalAssessmentPrompt,
  getVoiceEnglishTestModelCandidates,
  normalizeVoiceEnglishResult,
  normalizeVoiceTranscript,
} from "@/lib/hub/voice-english-test";
import {
  WRITTEN_TEST_REQUIRED_CODE,
  getOralEnglishTestAccess,
} from "@/lib/hub/english-test-access";
import { handleCompletedEnglishTestOutcome } from "@/lib/hub/english-test-outcome";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

function clampDurationSeconds(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(60 * 30, Math.round(n));
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

    const language = (auth.language || "en") as Language;
    const oralAccess = await getOralEnglishTestAccess(auth.customerId, language);
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const testId = typeof body?.testId === "string" ? body.testId : "";
    if (!testId) {
      return NextResponse.json({ error: "Missing testId" }, { status: 400 });
    }

    const existing = await prisma.englishRealtimeTest.findFirst({
      where: { id: testId, customerId: auth.customerId, status: "IN_PROGRESS" },
      select: { id: true, transcript: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Voice test not found" }, { status: 404 });
    }

    const transcript = normalizeVoiceTranscript(existing.transcript);
    const completion = await createOpenAIChatCompletion({
      models: getVoiceEnglishTestModelCandidates(),
      json: true,
      maxCompletionTokens: 900,
      messages: [
        {
          role: "system",
          content: "Return only valid JSON. You are a strict but fair CEFR English speaking evaluator.",
        },
        {
          role: "user",
          content: buildVoiceFinalAssessmentPrompt({ language, transcript }),
        },
      ],
    });

    const normalized = normalizeVoiceEnglishResult(parseJson(completion.content));
    const durationSeconds = clampDurationSeconds(body?.durationSeconds);

    const result = await prisma.englishRealtimeTest.update({
      where: { id: existing.id },
      data: {
        model: `voice-turn:${completion.model}`,
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
        transcript: transcript as unknown as Prisma.InputJsonValue,
        ...(durationSeconds !== null ? { durationSeconds } : {}),
        completedAt: new Date(),
      },
    });

    await handleCompletedEnglishTestOutcome({
      customerId: auth.customerId,
      testKind: "VOICE",
      testId: result.id,
      cefrLevel: normalized.cefrLevel,
      displayLevel: normalized.displayLevel,
      score: normalized.score,
    }).catch((outcomeError) => {
      console.warn("[Hub Voice English] Could not process English test outcome:", outcomeError);
    });

    return NextResponse.json({ result: normalized, savedResultId: result.id });
  } catch (error) {
    console.error("[Hub Voice English] Error finishing session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 502 }
    );
  }
}

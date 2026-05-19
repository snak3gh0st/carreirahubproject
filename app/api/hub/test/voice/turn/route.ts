import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import type { Language } from "@/lib/i18n/hub";
import { createOpenAIChatCompletion } from "@/lib/services/openai-chat-completions";
import {
  buildVoiceNextQuestionPrompt,
  getVoiceEnglishTestModelCandidates,
  normalizeVoiceTranscript,
  normalizeVoiceTurn,
  type VoiceInterviewTranscriptItem,
} from "@/lib/hub/voice-english-test";
import {
  WRITTEN_TEST_REQUIRED_CODE,
  getOralEnglishTestAccess,
} from "@/lib/hub/english-test-access";

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

function cleanStudentAnswer(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 3000) : "";
}

function cleanConfidence(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
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
    const studentAnswer = cleanStudentAnswer(body?.studentAnswer);
    const confidence = cleanConfidence(body?.confidence);

    if (!testId || !studentAnswer) {
      return NextResponse.json({ error: "Missing answer" }, { status: 400 });
    }

    const existing = await prisma.englishRealtimeTest.findFirst({
      where: { id: testId, customerId: auth.customerId, status: "IN_PROGRESS" },
      select: { id: true, transcript: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Voice test not found" }, { status: 404 });
    }

    const transcript = normalizeVoiceTranscript(existing.transcript);
    const nextTranscript: VoiceInterviewTranscriptItem[] = [
      ...transcript,
      {
        role: "student",
        text: studentAnswer,
        confidence,
        at: new Date().toISOString(),
      },
    ];

    const completion = await createOpenAIChatCompletion({
      models: getVoiceEnglishTestModelCandidates(),
      json: true,
      maxCompletionTokens: 300,
      messages: [
        {
          role: "system",
          content: "Return only valid JSON. You are a structured English oral interviewer.",
        },
        {
          role: "user",
          content: buildVoiceNextQuestionPrompt({
            language,
            transcript: nextTranscript,
          }),
        },
      ],
    });

    const turn = normalizeVoiceTurn(parseJson(completion.content));
    const storedTranscript: VoiceInterviewTranscriptItem[] = [
      ...nextTranscript,
      {
        role: "examiner",
        text: turn.examinerText,
        at: new Date().toISOString(),
      },
    ];

    await prisma.englishRealtimeTest.update({
      where: { id: existing.id },
      data: {
        model: `voice-turn:${completion.model}`,
        transcript: storedTranscript as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      examinerText: turn.examinerText,
      shouldFinish: turn.shouldFinish,
      transcript: storedTranscript,
    });
  } catch (error) {
    console.error("[Hub Voice English] Error processing turn:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 502 }
    );
  }
}

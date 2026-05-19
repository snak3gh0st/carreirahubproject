import { NextRequest, NextResponse } from "next/server";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import type { Language } from "@/lib/i18n/hub";
import {
  getCurrentRealtimeEnglishTestStage,
  normalizeRealtimeEnglishTranscript,
  normalizeRealtimeEnglishTurnEvaluation,
  summarizeRealtimeEnglishTranscriptForPrompt,
} from "@/lib/hub/realtime-english-test-flow";
import {
  getVoiceEnglishTestModelCandidates,
} from "@/lib/hub/voice-english-test";
import { createOpenAIChatCompletion } from "@/lib/services/openai-chat-completions";
import { recordRealtimeEnglishUsage } from "@/lib/hub/realtime-english-test-usage-store";

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

function buildTurnEvaluationPrompt(input: {
  language: Language;
  studentAnswer: string;
  transcriptSummary: string;
  stageTitle: string;
  stageFocus: string;
}) {
  return [
    "You are a strict but supportive English oral examiner for Brazilian professionals preparing for U.S. corporate interviews.",
    "Your task is not to score the full test. Your task is to decide whether the latest student answer provides acceptable evidence for the current section.",
    "Accept weak English if the answer meaningfully attempts the task. Do not reject only because grammar, pronunciation, or vocabulary is limited.",
    "Reject the answer if it is mostly noise, too short, joking, unfocused, mostly not English, a refusal, evasive, off-topic, or does not answer the current section.",
    "If the student jokes, avoids the task, or loses focus, direct the examiner to stay professional, ask the student to focus, and re-ask the section without advancing.",
    "If the answer is accepted, direct the examiner to move to the next section or ask only one concise targeted follow-up if truly needed.",
    `User language for operational fallback messages: ${input.language}. The live interview itself stays in English.`,
    `Current section: ${input.stageTitle}.`,
    `Current section focus: ${input.stageFocus}.`,
    "Recent transcript:",
    input.transcriptSummary || "(No previous transcript.)",
    "Latest student answer:",
    input.studentAnswer,
    "Return only valid JSON with this exact shape:",
    '{"acceptedEvidence":true,"issueType":"valid","reason":"string","examinerDirective":"string"}',
    "Allowed issueType values: valid, too_short, off_topic, joking, unfocused, non_english, unclear, refusal.",
  ].join("\n");
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

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_REALTIME_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI is not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const testId = typeof body?.testId === "string" ? body.testId : "";
    const studentAnswer = typeof body?.studentAnswer === "string"
      ? body.studentAnswer.trim()
      : "";

    if (!testId) {
      return NextResponse.json({ error: "Missing testId" }, { status: 400 });
    }

    if (!studentAnswer) {
      return NextResponse.json({ error: "Missing studentAnswer" }, { status: 400 });
    }

    const existing = await prisma.englishRealtimeTest.findFirst({
      where: {
        id: testId,
        customerId: auth.customerId,
        status: "IN_PROGRESS",
        NOT: { model: { startsWith: "voice-turn:" } },
      },
      select: { id: true, transcript: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Realtime test not found" }, { status: 404 });
    }

    const transcript = normalizeRealtimeEnglishTranscript(
      Array.isArray(body?.transcript) ? body.transcript : existing.transcript
    );
    const stage = getCurrentRealtimeEnglishTestStage(transcript);
    const language = (auth.language || "en") as Language;
    const transcriptSummary = summarizeRealtimeEnglishTranscriptForPrompt(transcript);

    const completion = await createOpenAIChatCompletion({
      apiKey,
      models: getVoiceEnglishTestModelCandidates(),
      json: true,
      maxCompletionTokens: 500,
      messages: [
        {
          role: "system",
          content: "Return only valid JSON. Evaluate only the latest turn for stage progression.",
        },
        {
          role: "user",
          content: buildTurnEvaluationPrompt({
            language,
            studentAnswer,
            transcriptSummary,
            stageTitle: stage.title,
            stageFocus: stage.promptFocus,
          }),
        },
      ],
    });

    const evaluation = normalizeRealtimeEnglishTurnEvaluation(
      parseJson(completion.content),
      { studentAnswer, stage }
    );
    await recordRealtimeEnglishUsage({
      testId: existing.id,
      customerId: auth.customerId,
      model: completion.model,
      source: "hub_realtime_english_turn_evaluation",
      usage: { usage: completion.usage },
    }).catch((usageError) => {
      console.warn("[Hub Realtime English] Could not record turn usage:", usageError);
    });

    return NextResponse.json({
      evaluation,
      model: completion.model,
    });
  } catch (error) {
    console.error("[Hub Realtime English] Error evaluating turn:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 502 }
    );
  }
}

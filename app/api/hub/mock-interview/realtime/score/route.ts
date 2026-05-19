import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { getAiMockInterviewAccess } from "@/lib/hub/ai-mock-interview-access";
import {
  AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS,
  buildAiMockInterviewFinalReportPrompt,
  countAiMockInterviewCandidateTurns,
  normalizeAiMockInterviewReport,
  normalizeAiMockInterviewTranscript,
} from "@/lib/hub/ai-mock-interview";
import { getVoiceEnglishTestModelCandidates } from "@/lib/hub/voice-english-test";
import { createOpenAIChatCompletion } from "@/lib/services/openai-chat-completions";
import { recordAiMockInterviewUsage } from "@/lib/hub/ai-mock-interview-usage-store";
import type { Language } from "@/lib/i18n/hub";

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
  return Math.min(60 * 45, Math.round(n));
}

function incompleteMessage(language: Language, candidateTurns: number): string {
  if (language === "pt-BR") {
    return `A entrevista ainda nao tem evidencias suficientes para gerar relatorio. Responda pelo menos ${AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS} perguntas substanciais. Capturadas ate agora: ${candidateTurns}.`;
  }

  return `The interview does not have enough evidence for a reliable report yet. Answer at least ${AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS} substantive questions. Captured so far: ${candidateTurns}.`;
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
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const existing = await prisma.aiMockInterviewSession.findFirst({
      where: { id: sessionId, customerId: auth.customerId, status: "IN_PROGRESS" },
      select: {
        id: true,
        enrollmentId: true,
        opsSessionId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mock interview session not found" }, { status: 404 });
    }

    const access = await getAiMockInterviewAccess(auth.customerId);
    if (!access) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const transcript = normalizeAiMockInterviewTranscript(body?.transcript);
    const candidateTurns = countAiMockInterviewCandidateTurns(transcript);
    const language = (auth.language || "en") as Language;
    if (candidateTurns < AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS) {
      return NextResponse.json(
        {
          code: "INCOMPLETE_MOCK_INTERVIEW",
          error: incompleteMessage(language, candidateTurns),
          candidateTurns,
          requiredCandidateTurns: AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS,
        },
        { status: 409 }
      );
    }

    const completion = await createOpenAIChatCompletion({
      apiKey,
      models: getVoiceEnglishTestModelCandidates(),
      json: true,
      maxCompletionTokens: 1200,
      messages: [
        {
          role: "system",
          content: "Return only valid JSON. You are a strict but practical U.S. corporate interview coach.",
        },
        {
          role: "user",
          content: buildAiMockInterviewFinalReportPrompt({
            language,
            context: access.context,
            transcript,
          }),
        },
      ],
    });

    const report = normalizeAiMockInterviewReport(parseJson(completion.content));
    const durationSeconds = clampDurationSeconds(body?.durationSeconds);

    await recordAiMockInterviewUsage({
      sessionId: existing.id,
      customerId: auth.customerId,
      model: completion.model,
      source: "hub_ai_mock_interview_final_report",
      usage: { usage: completion.usage },
    }).catch((usageError) => {
      console.warn("[Hub AI Mock Interview] Could not record report usage:", usageError);
    });

    let opsSessionId = existing.opsSessionId;
    if (!opsSessionId && access.enrollment) {
      const priorMockCount = await prisma.mentorshipSession.count({
        where: {
          enrollmentId: access.enrollment.id,
          sessionType: { in: ["mock_interview_1", "mock_interview_2"] },
        },
      });
      const opsSession = await prisma.mentorshipSession.create({
        data: {
          enrollmentId: access.enrollment.id,
          conductorId: access.enrollment.assignedToId,
          sessionType: priorMockCount === 0 ? "mock_interview_1" : "mock_interview_2",
          sessionDate: new Date(),
          notes: [
            "AI mock interview completed in CarreiraHub.",
            `Overall score: ${report.overallScore}/100.`,
            `Hiring signal: ${report.hiringSignal}.`,
          ].join(" "),
        },
        select: { id: true },
      });
      opsSessionId = opsSession.id;
    }

    const saved = await prisma.aiMockInterviewSession.update({
      where: { id: existing.id },
      data: {
        model: `mock-report:${completion.model}`,
        status: "COMPLETED",
        cvContext: access.context as unknown as Prisma.InputJsonValue,
        transcript: transcript as unknown as Prisma.InputJsonValue,
        report: report as unknown as Prisma.InputJsonValue,
        overallScore: report.overallScore,
        communicationScore: report.communicationScore,
        experienceScore: report.experienceScore,
        problemSolvingScore: report.problemSolvingScore,
        roleFitScore: report.roleFitScore,
        executivePresenceScore: report.executivePresenceScore,
        hiringSignal: report.hiringSignal,
        summary: report.summary,
        strengths: report.strengths,
        risks: report.risks,
        focusAreas: report.focusAreas,
        suggestedPracticeQuestions: report.suggestedPracticeQuestions,
        ...(durationSeconds !== null ? { durationSeconds } : {}),
        ...(opsSessionId ? { opsSessionId } : {}),
        completedAt: new Date(),
      },
      select: { id: true },
    });

    return NextResponse.json({ report, savedResultId: saved.id });
  } catch (error) {
    console.error("[Hub AI Mock Interview] Error scoring session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 502 }
    );
  }
}

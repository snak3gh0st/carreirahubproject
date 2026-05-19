import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { getAiMockInterviewAccess } from "@/lib/hub/ai-mock-interview-access";
import {
  buildAiMockInterviewSafetyIdentifier,
  buildAiMockInterviewSession,
  getAiMockInterviewModelCandidates,
  normalizeAiMockInterviewTranscript,
} from "@/lib/hub/ai-mock-interview";
import { summarizeAiMockInterviewContextForPrompt } from "@/lib/hub/ai-mock-interview-context";
import { buildOpenAIAuthHeaders } from "@/lib/services/openai-auth-headers";
import type { Language } from "@/lib/i18n/hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

interface RealtimeAttempt {
  model: string;
  status: number;
  code: string | null;
  message: string;
}

function getCallId(location: string | null): string | null {
  if (!location) return null;
  const parts = location.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

function parseOpenAIError(responseText: string): { code: string | null; message: string } {
  try {
    const body = JSON.parse(responseText) as {
      error?: { code?: unknown; message?: unknown };
    };
    if (typeof body.error?.message === "string") {
      return {
        code: typeof body.error.code === "string" ? body.error.code : null,
        message: body.error.message,
      };
    }
  } catch {
    // Plain-text SDP/error fallback.
  }

  return { code: null, message: responseText.slice(0, 300) };
}

function isModelUnavailableError(status: number, responseText: string): boolean {
  if (status !== 403 && status !== 404) return false;
  try {
    const body = JSON.parse(responseText) as { error?: { code?: unknown } };
    if (body.error?.code === "model_not_found") return true;
  } catch {
    // Fall back to message matching.
  }
  return /does not exist or you do not have access/i.test(responseText);
}

export async function POST(request: NextRequest) {
  let mockInterviewId: string | null = null;
  let createdForThisAttempt = false;

  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const realtimeApiKey = process.env.OPENAI_REALTIME_API_KEY || process.env.OPENAI_API_KEY;
    if (!realtimeApiKey) {
      return NextResponse.json(
        { error: "OpenAI realtime is not configured" },
        { status: 503 }
      );
    }

    const sdp = await request.text();
    if (!sdp || !sdp.includes("v=0")) {
      return NextResponse.json({ error: "Invalid SDP offer" }, { status: 400 });
    }

    const access = await getAiMockInterviewAccess(auth.customerId);
    if (!access) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason }, { status: 403 });
    }

    const language = (auth.language || "en") as Language;
    const modelCandidates = getAiMockInterviewModelCandidates();
    const primaryModel = modelCandidates[0];

    const reusableSession = await prisma.aiMockInterviewSession.findFirst({
      where: {
        customerId: auth.customerId,
        status: "IN_PROGRESS",
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, transcript: true },
    });

    const sessionRecord = reusableSession ?? await prisma.aiMockInterviewSession.create({
      data: {
        customerId: auth.customerId,
        enrollmentId: access.enrollment?.id ?? null,
        model: primaryModel,
        targetRole: access.context.targetRole,
        interviewFocus: "ai_mock_interview",
        resumeSnapshot: summarizeAiMockInterviewContextForPrompt(access.context).slice(0, 4000),
        cvContext: access.context as unknown as Prisma.InputJsonValue,
        status: "IN_PROGRESS",
      },
      select: { id: true, transcript: true },
    });

    createdForThisAttempt = !reusableSession;
    mockInterviewId = sessionRecord.id;
    const savedTranscript = normalizeAiMockInterviewTranscript(sessionRecord.transcript);
    const isResuming = savedTranscript.length > 0;
    const attempts: RealtimeAttempt[] = [];
    let failedStatus = 502;
    let failedText = "Failed to start AI mock interview";
    let failedBecauseModelUnavailable = false;

    for (const [index, model] of modelCandidates.entries()) {
      const session = buildAiMockInterviewSession({
        language,
        model,
        context: access.context,
        transcript: savedTranscript,
      });

      const body = new FormData();
      body.set("sdp", sdp);
      body.set("session", JSON.stringify(session));

      const openAiResponse = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        headers: buildOpenAIAuthHeaders({
          apiKey: realtimeApiKey,
          safetyIdentifier: buildAiMockInterviewSafetyIdentifier(auth.customerId),
        }),
        body,
      });

      const responseText = await openAiResponse.text();
      const callId = getCallId(openAiResponse.headers.get("location"));

      if (openAiResponse.ok) {
        await prisma.aiMockInterviewSession.update({
          where: { id: sessionRecord.id },
          data: {
            model,
            ...(callId ? { openaiCallId: callId } : {}),
            cvContext: access.context as unknown as Prisma.InputJsonValue,
            resumeSnapshot: summarizeAiMockInterviewContextForPrompt(access.context).slice(0, 4000),
          },
        });

        return new NextResponse(responseText, {
          status: openAiResponse.status,
          headers: {
            "content-type": "application/sdp",
            "x-mock-interview-id": sessionRecord.id,
            "x-realtime-model": model,
            "x-realtime-resumed": isResuming ? "1" : "0",
            "x-mock-interview-turns": String(savedTranscript.filter((item) => item.role === "candidate").length),
            ...(callId ? { "x-openai-call-id": callId } : {}),
          },
        });
      }

      failedStatus = openAiResponse.status;
      failedText = responseText;
      const parsedError = parseOpenAIError(responseText);
      attempts.push({
        model,
        status: openAiResponse.status,
        code: parsedError.code,
        message: parsedError.message.slice(0, 300),
      });
      failedBecauseModelUnavailable = isModelUnavailableError(openAiResponse.status, responseText);

      console.error("[Hub AI Mock Interview] OpenAI call failed:", {
        model,
        status: openAiResponse.status,
        body: responseText,
      });

      if (
        index < modelCandidates.length - 1 &&
        failedBecauseModelUnavailable
      ) {
        continue;
      }

      break;
    }

    await prisma.aiMockInterviewSession.update({
      where: { id: sessionRecord.id },
      data: {
        ...(createdForThisAttempt ? { status: "FAILED", failedAt: new Date() } : {}),
        errorMessage: failedText.slice(0, 1000),
      },
    });

    return NextResponse.json(
      {
        error: failedBecauseModelUnavailable
          ? `OpenAI API key does not have access to Realtime models. Tried: ${modelCandidates.join(", ")}.`
          : parseOpenAIError(failedText).message,
        attempts,
      },
      {
        status: failedBecauseModelUnavailable
          ? 503
          : failedStatus >= 400 && failedStatus < 500
            ? 502
            : failedStatus,
      }
    );
  } catch (error) {
    console.error("[Hub AI Mock Interview] Error starting session:", error);

    if (mockInterviewId && createdForThisAttempt) {
      await prisma.aiMockInterviewSession.update({
        where: { id: mockInterviewId },
        data: {
          status: "FAILED",
          failedAt: new Date(),
          errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
        },
      }).catch(() => undefined);
    }

    return NextResponse.json(
      { error: "Failed to start AI mock interview" },
      { status: 502 }
    );
  }
}

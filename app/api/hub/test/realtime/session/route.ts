import { NextRequest, NextResponse } from "next/server";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import {
  buildRealtimeEnglishTestSession,
  buildRealtimeSafetyIdentifier,
  getRealtimeEnglishTestModelCandidates,
} from "@/lib/hub/realtime-english-test";
import {
  getRealtimeEnglishTestProgress,
  normalizeRealtimeEnglishTranscript,
} from "@/lib/hub/realtime-english-test-flow";
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
      error?: {
        code?: unknown;
        message?: unknown;
      };
    };
    if (typeof body.error?.message === "string") {
      return {
        code: typeof body.error.code === "string" ? body.error.code : null,
        message: body.error.message,
      };
    }
  } catch {
    // Not JSON.
  }

  return {
    code: null,
    message: responseText.slice(0, 300),
  };
}

function parseOpenAIErrorMessage(responseText: string): string {
  return parseOpenAIError(responseText).message;
}

function isModelUnavailableError(status: number, responseText: string): boolean {
  if (status !== 403 && status !== 404) return false;

  try {
    const body = JSON.parse(responseText) as { error?: { code?: unknown } };
    if (body.error?.code === "model_not_found") return true;
  } catch {
    // Fall back to message matching below.
  }

  return /does not exist or you do not have access/i.test(responseText);
}

export async function POST(request: NextRequest) {
  let realtimeTestId: string | null = null;
  let createdRealtimeTestForThisAttempt = false;

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

    const modelCandidates = getRealtimeEnglishTestModelCandidates();
    const primaryModel = modelCandidates[0];
    const language = (auth.language || "en") as Language;

    const reusableRealtimeTest = await prisma.englishRealtimeTest.findFirst({
      where: {
        customerId: auth.customerId,
        status: "IN_PROGRESS",
        NOT: { model: { startsWith: "voice-turn:" } },
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, transcript: true },
    });

    const realtimeTest = reusableRealtimeTest ?? await prisma.englishRealtimeTest.create({
      data: {
        customerId: auth.customerId,
        model: primaryModel,
        status: "IN_PROGRESS",
      },
      select: { id: true, transcript: true },
    });
    const isReusedRealtimeTest = Boolean(reusableRealtimeTest);
    createdRealtimeTestForThisAttempt = !isReusedRealtimeTest;
    realtimeTestId = realtimeTest.id;
    const savedTranscript = normalizeRealtimeEnglishTranscript(realtimeTest.transcript);
    const savedProgress = getRealtimeEnglishTestProgress(savedTranscript);
    const isResuming = savedProgress.studentTurns > 0;

    let failedStatus = 502;
    let failedText = "Failed to start realtime English test";
    let failedBecauseModelUnavailable = false;
    const attempts: RealtimeAttempt[] = [];

    for (const [index, model] of modelCandidates.entries()) {
      const session = buildRealtimeEnglishTestSession({
        language,
        model,
        transcript: savedTranscript,
      });

      const body = new FormData();
      body.set("sdp", sdp);
      body.set("session", JSON.stringify(session));

      const openAiResponse = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        headers: buildOpenAIAuthHeaders({
          apiKey: realtimeApiKey,
          safetyIdentifier: buildRealtimeSafetyIdentifier(auth.customerId),
        }),
        body,
      });

      const responseText = await openAiResponse.text();
      const callId = getCallId(openAiResponse.headers.get("location"));

      if (openAiResponse.ok) {
        await prisma.englishRealtimeTest.update({
          where: { id: realtimeTest.id },
          data: {
            model,
            ...(callId ? { openaiCallId: callId } : {}),
          },
        });

        return new NextResponse(responseText, {
          status: openAiResponse.status,
          headers: {
            "content-type": "application/sdp",
            "x-realtime-test-id": realtimeTest.id,
            "x-realtime-model": model,
            "x-realtime-resumed": isResuming ? "1" : "0",
            "x-realtime-student-turns": String(savedProgress.studentTurns),
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
      failedBecauseModelUnavailable = isModelUnavailableError(
        openAiResponse.status,
        responseText
      );

      console.error("[Hub Realtime English] OpenAI call failed:", {
        model,
        status: openAiResponse.status,
        body: responseText,
      });

      const canFallback =
        index < modelCandidates.length - 1 &&
        failedBecauseModelUnavailable;

      if (canFallback) {
        console.warn("[Hub Realtime English] Falling back to realtime model:", {
          from: model,
          to: modelCandidates[index + 1],
        });
        continue;
      }

      break;
    }

    await prisma.englishRealtimeTest.update({
      where: { id: realtimeTest.id },
      data: {
        ...(isReusedRealtimeTest ? {} : { status: "FAILED", failedAt: new Date() }),
        errorMessage: failedText.slice(0, 1000),
      },
    });

    return NextResponse.json(
      {
        error: failedBecauseModelUnavailable
          ? `OpenAI API key does not have access to Realtime models. Tried: ${modelCandidates.join(", ")}.`
          : parseOpenAIErrorMessage(failedText),
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
    console.error("[Hub Realtime English] Error starting session:", error);

    if (realtimeTestId) {
      await prisma.englishRealtimeTest.update({
        where: { id: realtimeTestId },
        data: {
          ...(createdRealtimeTestForThisAttempt
            ? { status: "FAILED", failedAt: new Date() }
            : {}),
          errorMessage: error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
        },
      }).catch(() => undefined);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

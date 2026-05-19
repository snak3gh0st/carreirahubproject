import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import {
  getVoiceEnglishFirstQuestion,
  getVoiceEnglishTestModelCandidates,
  type VoiceInterviewTranscriptItem,
} from "@/lib/hub/voice-english-test";
import {
  WRITTEN_TEST_REQUIRED_CODE,
  getOralEnglishTestAccess,
} from "@/lib/hub/english-test-access";
import type { Language } from "@/lib/i18n/hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI is not configured" },
        { status: 503 }
      );
    }

    const firstQuestion = getVoiceEnglishFirstQuestion();
    const transcript: VoiceInterviewTranscriptItem[] = [
      { role: "examiner", text: firstQuestion, at: new Date().toISOString() },
    ];

    const test = await prisma.englishRealtimeTest.create({
      data: {
        customerId: auth.customerId,
        model: `voice-turn:${getVoiceEnglishTestModelCandidates()[0]}`,
        status: "IN_PROGRESS",
        transcript: transcript as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return NextResponse.json({
      testId: test.id,
      examinerText: firstQuestion,
    });
  } catch (error) {
    console.error("[Hub Voice English] Error starting session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { recordRealtimeEnglishUsage } from "@/lib/hub/realtime-english-test-usage-store";
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

    const body = await request.json();
    const testId = typeof body?.testId === "string" ? body.testId : "";
    if (!testId) {
      return NextResponse.json({ error: "Missing testId" }, { status: 400 });
    }

    const existing = await prisma.englishRealtimeTest.findFirst({
      where: {
        id: testId,
        customerId: auth.customerId,
        NOT: { model: { startsWith: "voice-turn:" } },
      },
      select: { id: true, model: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Realtime test not found" }, { status: 404 });
    }

    await recordRealtimeEnglishUsage({
      testId: existing.id,
      customerId: auth.customerId,
      model: existing.model,
      source: "hub_realtime_english_realtime",
      usage: body?.usage ?? body?.event ?? body,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Hub Realtime English] Error recording usage:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

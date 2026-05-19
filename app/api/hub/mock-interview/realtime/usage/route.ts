import { NextRequest, NextResponse } from "next/server";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { recordAiMockInterviewUsage } from "@/lib/hub/ai-mock-interview-usage-store";

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

    const body = await request.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const existing = await prisma.aiMockInterviewSession.findFirst({
      where: { id: sessionId, customerId: auth.customerId },
      select: { id: true, model: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Mock interview session not found" }, { status: 404 });
    }

    await recordAiMockInterviewUsage({
      sessionId: existing.id,
      customerId: auth.customerId,
      model: existing.model,
      source: "hub_ai_mock_interview_realtime",
      usage: body?.event ?? body?.usage ?? body,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.warn("[Hub AI Mock Interview] Could not record usage:", error);
    return NextResponse.json({ ok: true });
  }
}

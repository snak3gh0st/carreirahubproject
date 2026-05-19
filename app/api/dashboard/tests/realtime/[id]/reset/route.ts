import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole } from "@/lib/roles";
import {
  buildRealtimeEnglishResetUpdateData,
  canResetRealtimeEnglishTestStatus,
} from "@/lib/hub/realtime-english-test-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | undefined)?.role;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isOperationalAccessRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await prisma.englishRealtimeTest.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Realtime test not found" }, { status: 404 });
    }

    if (!canResetRealtimeEnglishTestStatus(existing.status)) {
      return NextResponse.json(
        { error: "Only in-progress realtime tests can be reset" },
        { status: 409 }
      );
    }

    await prisma.englishRealtimeTest.update({
      where: { id: existing.id },
      data: buildRealtimeEnglishResetUpdateData(),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Dashboard Realtime Test Reset Error]:", error);
    return NextResponse.json(
      { error: "Failed to reset realtime test" },
      { status: 500 }
    );
  }
}

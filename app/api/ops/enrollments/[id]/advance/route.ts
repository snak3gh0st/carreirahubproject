import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  mentorshipService,
  MentorshipError,
} from "@/lib/services/mentorship.service";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "OPERATIONAL") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const userId = (session.user as any).id as string;

  const body = await req.json().catch(() => null);
  const toPhaseId = body?.toPhaseId;
  if (!toPhaseId) {
    return NextResponse.json(
      { error: "toPhaseId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await mentorshipService.advancePhase({
      enrollmentId: params.id,
      toPhaseId,
      triggeredById: userId,
      triggeredByRole: role,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof MentorshipError) {
      const status = err.code === "INVALID_TRANSITION" ? 422 : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status }
      );
    }
    console.error("[advance] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

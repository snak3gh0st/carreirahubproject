import { NextResponse, NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  mentorshipService,
  MentorshipError,
} from "@/lib/services/mentorship.service";
import { prisma } from "@/lib/db";
import { slackService } from "@/lib/services/slack.service";

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

    // Notify Slack — phase advance (fire-and-forget)
    prisma.mentorshipEnrollment.findUnique({
      where: { id: params.id },
      include: { customer: true },
    }).then(async (enrollment) => {
      if (!enrollment?.customer) return;
      const [fromPhase, toPhase] = await Promise.all([
        result.transition.fromPhaseId
          ? prisma.mentorshipPhase.findUnique({ where: { id: result.transition.fromPhaseId } })
          : null,
        prisma.mentorshipPhase.findUnique({ where: { id: toPhaseId } }),
      ]);
      await slackService.notifyEnrollmentPhaseChanged(
        { id: enrollment.customer.id, name: enrollment.customer.name, email: enrollment.customer.email, phone: enrollment.customer.phone },
        enrollment.programType,
        fromPhase?.label ?? "—",
        toPhase?.label ?? toPhaseId
      );
    }).catch(() => {});

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

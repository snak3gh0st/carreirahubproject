import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mentorshipService } from "@/lib/services/mentorship.service";
import { OPS_SESSION_TYPES } from "@/lib/ops/workflow";
import { isOperationalAccessRole } from "@/lib/roles";
import { z } from "zod";

export const dynamic = "force-dynamic";

const sessionSchema = z.object({
  enrollmentId: z.string().min(1),
  sessionType: z.enum(OPS_SESSION_TYPES),
  conductorId: z.string().min(1),
  sessionDate: z.string().min(1),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;

  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { enrollmentId, sessionType, conductorId, sessionDate, notes } = parsed.data;

  try {
    const result = await mentorshipService.logSession({
      enrollmentId,
      sessionType,
      conductorId,
      sessionDate: new Date(sessionDate),
      notes,
    });
    return NextResponse.json({ session: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Enrollment not found or not active") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[Ops Sessions Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

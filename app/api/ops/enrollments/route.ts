import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mentorshipService, MentorshipError } from "@/lib/services/mentorship.service";
import { isOperationalAccessRole } from "@/lib/roles";
import { z } from "zod";

export const dynamic = "force-dynamic";

const enrollSchema = z.object({
  customerId: z.string().min(1),
  programType: z.enum(["PASS", "ADVANCED"]),
  assignedToId: z.string().min(1),
  startDate: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;

  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = enrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { customerId, programType, assignedToId, startDate } = parsed.data;

  try {
    const result = await mentorshipService.createEnrollment({
      customerId,
      programType,
      assignedToId,
      startDate: new Date(startDate),
      triggeredById: userId,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof MentorshipError && error.code === "DUPLICATE_ENROLLMENT") {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[Ops Enrollments Error]:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

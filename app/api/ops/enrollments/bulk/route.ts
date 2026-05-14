import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mentorshipService, MentorshipError } from "@/lib/services/mentorship.service";
import { isOperationalAccessRole } from "@/lib/roles";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bulkEnrollSchema = z.object({
  customerIds: z.array(z.string().min(1)).min(1),
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
  const parsed = bulkEnrollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { customerIds, programType, assignedToId, startDate } = parsed.data;

  const results = await Promise.allSettled(
    customerIds.map((customerId) =>
      mentorshipService.createEnrollment({
        customerId,
        programType,
        assignedToId,
        startDate: new Date(startDate),
        triggeredById: userId,
      })
    )
  );

  const succeeded: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      succeeded.push(customerIds[i]);
    } else if (
      result.reason instanceof MentorshipError &&
      result.reason.code === "DUPLICATE_ENROLLMENT"
    ) {
      skipped.push(customerIds[i]);
    } else {
      failed.push(customerIds[i]);
    }
  });

  return NextResponse.json({ succeeded: succeeded.length, skipped: skipped.length, failed: failed.length }, { status: 200 });
}

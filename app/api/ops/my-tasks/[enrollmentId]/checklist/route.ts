// app/api/ops/my-tasks/[enrollmentId]/checklist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";
import { z } from "zod";

const bodySchema = z.object({
  phaseKey: z.string().min(1),
  itemKey: z.string().min(1),
  completed: z.boolean(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { phaseKey, itemKey, completed } = parsed.data;
  const { enrollmentId } = params;

  // Validate item exists in the template
  const template = getPhaseChecklist(phaseKey);
  const item = template.find((i) => i.key === itemKey);
  if (!item) {
    return NextResponse.json({ error: "Unknown checklist item" }, { status: 400 });
  }

  // Prevent manual toggling of auto-complete items
  if (item.autoComplete) {
    return NextResponse.json({ error: "This item is managed automatically" }, { status: 400 });
  }

  // Verify enrollment exists
  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  try {
    const progress = await prisma.phaseChecklistProgress.upsert({
      where: { enrollmentId_phaseKey_itemKey: { enrollmentId, phaseKey, itemKey } },
      create: {
        enrollmentId,
        phaseKey,
        itemKey,
        completedAt: completed ? new Date() : null,
        completedById: completed ? userId : null,
      },
      update: {
        completedAt: completed ? new Date() : null,
        completedById: completed ? userId : null,
      },
    });
    return NextResponse.json({ progress });
  } catch (err) {
    console.error("[checklist toggle]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

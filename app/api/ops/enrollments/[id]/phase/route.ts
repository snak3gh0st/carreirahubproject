import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const phaseChangeSchema = z.object({
  toPhaseId: z.string().min(1),
  reason: z.string().trim().min(8, "Informe um motivo com pelo menos 8 caracteres."),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role as string;
  const userId = (session.user as any).id as string;
  if (!isOperationalAccessRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = phaseChangeSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const enrollment = await prisma.mentorshipEnrollment.findFirst({
    where: { id: params.id, status: "ACTIVE" },
    include: { currentPhase: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found or not active" }, { status: 404 });
  }

  const toPhase = await prisma.mentorshipPhase.findUnique({
    where: { id: parsed.data.toPhaseId },
  });
  if (!toPhase) return NextResponse.json({ error: "Phase not found" }, { status: 404 });

  const result = await prisma.$transaction(async (tx) => {
    const transition = await tx.phaseTransition.create({
      data: {
        enrollmentId: enrollment.id,
        fromPhaseId: enrollment.currentPhaseId,
        toPhaseId: toPhase.id,
        reason: parsed.data.reason,
        triggeredById: userId,
      },
    });

    const updatedEnrollment = await tx.mentorshipEnrollment.update({
      where: { id: enrollment.id },
      data: { currentPhaseId: toPhase.id },
      include: {
        currentPhase: true,
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    return { transition, enrollment: updatedEnrollment };
  });

  return NextResponse.json(result);
}

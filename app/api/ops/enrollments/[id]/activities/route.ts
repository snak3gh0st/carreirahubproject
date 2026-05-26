import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isMissingOpsNativeTable, OPS_NATIVE_MIGRATION_ERROR } from "@/lib/ops/native-schema";
import { buildOperationalActorPayload } from "@/lib/ops/staff-members";
import { isOperationalAccessRole } from "@/lib/roles";
import {
  OPS_ACTIVITY_STATUSES,
  OPS_ACTIVITY_TYPES,
  normalizeOpsActivityStatus,
  normalizeOpsVisibility,
} from "@/lib/ops/visibility";

export const dynamic = "force-dynamic";

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  });

const activitySchema = z.object({
  type: z.enum(OPS_ACTIVITY_TYPES),
  activityDate: z.string().min(1),
  company: nullableString,
  roleTitle: nullableString,
  area: nullableString,
  industry: nullableString,
  source: nullableString,
  jobUrl: nullableString,
  salary: nullableString,
  status: z.enum(OPS_ACTIVITY_STATUSES).nullable().optional(),
  visibility: z.string().optional(),
  outcome: nullableString,
  notes: nullableString,
  actorId: nullableString,
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  const userId = (session.user as any).id as string;
  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const parsed = activitySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const activityDate = new Date(parsed.data.activityDate);
  if (Number.isNaN(activityDate.getTime())) {
    return NextResponse.json({ error: "Invalid activityDate" }, { status: 400 });
  }
  if (parsed.data.type === "APPLICATION" && !parsed.data.jobUrl) {
    return NextResponse.json({ error: "Link da vaga é obrigatório para aplicações." }, { status: 400 });
  }

  let actor;
  try {
    actor = buildOperationalActorPayload(parsed.data.actorId, userId);
  } catch {
    return NextResponse.json({ error: "Funcionario selecionado invalido" }, { status: 400 });
  }

  try {
    const { actorId: _actorId, ...activityData } = parsed.data;
    const activity = await prisma.opsStudentActivity.create({
      data: {
        ...activityData,
        status: normalizeOpsActivityStatus(activityData.status) ?? null,
        visibility: normalizeOpsVisibility(activityData.visibility),
        activityDate,
        enrollmentId: enrollment.id,
        createdById: userId,
        performedByUserId: actor.performedByUserId,
        performedByStaffId: actor.performedByStaffId,
      },
      include: {
        createdBy: { select: { name: true } },
        performedByUser: { select: { name: true } },
        performedByStaff: { select: { name: true, status: true } },
      },
    });

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    if (isMissingOpsNativeTable(error)) {
      return NextResponse.json(
        { error: OPS_NATIVE_MIGRATION_ERROR, migrationRequired: true },
        { status: 503 }
      );
    }
    throw error;
  }
}

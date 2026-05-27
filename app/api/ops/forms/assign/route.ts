import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES, NPS_TEMPLATE_IDS } from "@/lib/hub/form-templates";
import {
  buildDigisacLifecycleDedupeKey,
  sendDigisacLifecycleMessageSafely,
} from "@/lib/ops/digisac-lifecycle";
import { isOperationalAccessRole } from "@/lib/roles";
import { emailService } from "@/lib/services/email.service";

export const dynamic = "force-dynamic";

const assignSchema = z.object({
  customerId: z.string().min(1),
  templateId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as string;
  if (!isOperationalAccessRole(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { customerId, templateId } = parsed.data;
  if (!FORM_TEMPLATES[templateId]) {
    return NextResponse.json({ error: "Invalid templateId. Template not found." }, { status: 400 });
  }

  // Enforce programType-scoped whitelist — mirrors GET /api/ops/enrollments/[id] logic.
  const enrollment = await prisma.mentorshipEnrollment.findFirst({
    where: { customerId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      programType: true,
      customer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!enrollment) {
    return NextResponse.json(
      { error: "Customer has no active enrollment. Cannot assign forms." },
      { status: 400 }
    );
  }

  const allowedTemplateIds =
    enrollment.programType === "PASS"
      ? ["onboarding-pass", ...NPS_TEMPLATE_IDS]
      : ["onboarding-career", ...NPS_TEMPLATE_IDS];

  if (!allowedTemplateIds.includes(templateId)) {
    return NextResponse.json(
      { error: `Template '${templateId}' is not allowed for ${enrollment.programType} enrollments.` },
      { status: 400 }
    );
  }

  const existingAssignment = await prisma.formAssignment.findFirst({
    where: {
      customerId,
      templateId,
      status: { not: "COMPLETED" },
    },
  });

  if (existingAssignment) {
    return NextResponse.json(
      { error: "This form is already assigned and still pending." },
      { status: 409 }
    );
  }

  const assignedById = (session.user as any).id as string;
  const assignment = await prisma.formAssignment.create({
    data: {
      templateId,
      customerId,
      assignedById,
    },
  });

  const template = FORM_TEMPLATES[templateId];
  const formTitle = template.titlePt || template.title;
  const hubEmailSent = await emailService.sendHubFormAssigned(
    enrollment.customer,
    formTitle
  ).then(() => true).catch((emailError) => {
    console.warn(`[Ops Forms Assign] Could not email ${enrollment.customer.email}:`, emailError);
    return false;
  });

  const digisacLifecycle = await sendDigisacLifecycleMessageSafely({
    event: "form_assigned",
    enrollmentId: enrollment.id,
    dedupeKey: buildDigisacLifecycleDedupeKey("form_assigned", assignment.id),
    title: formTitle,
    metadata: {
      source: "ops.forms.assign",
      formAssignmentId: assignment.id,
      templateId,
    },
  });

  return NextResponse.json({ assignment, hubEmailSent, digisacLifecycle }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";
import { hashPassword } from "@/lib/hub-auth";
import {
  buildDigisacLifecycleDedupeKey,
  sendDigisacLifecycleMessageSafely,
} from "@/lib/ops/digisac-lifecycle";
import { createOpsManualStudentCommunicationAlert } from "@/lib/ops/internal-alerts";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, templateId } = body as {
      customerId: string | string[];
      templateId: string;
    };

    // Validate templateId exists
    if (!templateId || !FORM_TEMPLATES[templateId]) {
      return NextResponse.json(
        { error: "Invalid templateId. Template not found." },
        { status: 400 }
      );
    }

    // Normalize customerId to array
    const customerIds = Array.isArray(customerId) ? customerId : [customerId];

    if (customerIds.length === 0) {
      return NextResponse.json(
        { error: "At least one customerId is required." },
        { status: 400 }
      );
    }

    const assignedById = (session.user as any).id;
    const template = FORM_TEMPLATES[templateId];
    const formTitle = template.titlePt || template.title;

    // Create a FormAssignment for each customer and keep ids for Digisac lifecycle dedupe.
    const createdAssignments = await prisma.$transaction(
      customerIds.map((cId) =>
        prisma.formAssignment.create({
          data: {
            templateId,
            customerId: cId,
            assignedById,
          },
        })
      )
    );

    // Provision hub accounts, keep an internal audit alert, and send a best-effort
    // Digisac lifecycle message after the form assignment exists.
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, email: true },
    });

    const existingHubUsers = await prisma.clientUser.findMany({
      where: { customerId: { in: customerIds } },
      select: { customerId: true },
    });
    const hasHubAccount = new Set(existingHubUsers.map((u) => u.customerId));

    const alertResults = await Promise.allSettled(
      customers.map(async (customer) => {
        let tempPassword: string | undefined;
        if (hasHubAccount.has(customer.id)) {
          tempPassword = undefined;
        } else {
          tempPassword = randomBytes(5).toString("hex"); // 10-char hex
          const passwordHash = await hashPassword(tempPassword);
          await prisma.clientUser.create({
            data: {
              email: customer.email,
              passwordHash,
              mustResetPw: true,
              tempPasswordExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
              customerId: customer.id,
            },
          });
        }

        await createOpsManualStudentCommunicationAlert({
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          title: `Formulario atribuido: ${customer.name}`,
          description: `${formTitle} foi atribuido a ${customer.name}. Digisac lifecycle tenta avisar automaticamente quando ha matricula ativa; confirme acesso do Hub se o aluno responder com duvida.`,
          dedupeKey: `form-assigned:${templateId}:${customer.id}`,
          data: {
            source: "dashboard-form-assignment",
            templateId,
            formTitle,
            hasExistingHubAccount: hasHubAccount.has(customer.id),
            tempPasswordCreated: Boolean(tempPassword),
            accessNote: tempPassword
              ? "Hub account was provisioned without external email. Use manual access/reset flow before contacting the student."
              : "Student already had a Hub account. Confirm timing before manual outreach.",
          },
        });
      })
    );

    const activeEnrollments = await prisma.mentorshipEnrollment.findMany({
      where: {
        customerId: { in: customerIds },
        status: "ACTIVE",
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, customerId: true },
    });
    const enrollmentByCustomerId = new Map<string, string>();
    for (const enrollment of activeEnrollments) {
      if (!enrollmentByCustomerId.has(enrollment.customerId)) {
        enrollmentByCustomerId.set(enrollment.customerId, enrollment.id);
      }
    }

    const lifecycleResults = await Promise.allSettled(
      createdAssignments.map(async (assignment) => {
        const enrollmentId = enrollmentByCustomerId.get(assignment.customerId);
        if (!enrollmentId) return { sent: false, skippedReason: "missing_enrollment" };
        return sendDigisacLifecycleMessageSafely({
          event: "form_assigned",
          enrollmentId,
          dedupeKey: buildDigisacLifecycleDedupeKey("form_assigned", assignment.id),
          title: formTitle,
          metadata: {
            source: "dashboard.forms.assign",
            formAssignmentId: assignment.id,
            templateId,
          },
        });
      })
    );

    revalidatePath("/dashboard/forms");
    return NextResponse.json({
      success: true,
      count: createdAssignments.length,
      externalEmailsSent: 0,
      internalAlertsCreated: alertResults.filter((result) => result.status === "fulfilled").length,
      internalAlertFailures: alertResults.filter((result) => result.status === "rejected").length,
      digisacLifecycleSent: lifecycleResults.filter(
        (result) => result.status === "fulfilled" && result.value.sent
      ).length,
      digisacLifecycleFailures: lifecycleResults.filter((result) => result.status === "rejected").length,
    });
  } catch (error) {
    console.error("[Dashboard Forms Assign Error]:", error);
    return NextResponse.json(
      { error: "Failed to assign form" },
      { status: 500 }
    );
  }
}

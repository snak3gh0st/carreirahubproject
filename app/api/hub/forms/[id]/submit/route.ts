import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { getTemplate } from "@/lib/hub/form-templates";
import {
  deriveCustomerUpdatesFromFormAnswers,
  deriveOpsProfileUpdatesFromFormAnswers,
} from "@/lib/hub/customer-form-sync";
import { isMissingOpsNativeTable } from "@/lib/ops/native-schema";

export const dynamic = "force-dynamic";

function filenameFromStorageKey(value: unknown): string | null {
  if (typeof value !== "string" || !value.includes("/")) return null;
  return value.split("/").pop() || null;
}

/**
 * POST /api/hub/forms/[id]/submit
 * Submit form answers for a given assignment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const { id } = await params;

    // Parse body
    const body = await request.json();
    const { answers } = body as { answers: Record<string, string | number | boolean | null> };

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Missing or invalid answers" },
        { status: 400 }
      );
    }

    // Load assignment and verify ownership
    const assignment = await prisma.formAssignment.findUnique({
      where: { id, customerId: auth.customerId },
      include: { submission: true },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Form assignment not found" },
        { status: 404 }
      );
    }

    if (assignment.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Form has already been submitted" },
        { status: 400 }
      );
    }

    // Validate required fields against template
    const template = getTemplate(assignment.templateId);
    if (template) {
      const missingFields: string[] = [];
      for (const field of template.fields) {
        if (field.required) {
          const value = answers[field.id];
          if (value === undefined || value === null || value === "") {
            missingFields.push(field.id);
          }
        }
      }
      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            error: "Missing required fields",
            fields: missingFields,
          },
          { status: 400 }
        );
      }
    }

    const customerUpdates = deriveCustomerUpdatesFromFormAnswers(answers);
    const opsProfileUpdates = deriveOpsProfileUpdatesFromFormAnswers(answers);
    const activeEnrollment = await prisma.mentorshipEnrollment.findFirst({
      where: { customerId: auth.customerId, status: "ACTIVE" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    const baseTransaction: Prisma.PrismaPromise<unknown>[] = [
      prisma.formSubmission.create({
        data: {
          assignmentId: assignment.id,
          customerId: auth.customerId,
          answers,
        },
      }),
      prisma.formAssignment.update({
        where: { id: assignment.id },
        data: { status: "COMPLETED" },
      }),
    ];

    if (Object.keys(customerUpdates).length > 0) {
      baseTransaction.push(
        prisma.customer.update({
          where: { id: auth.customerId },
          data: customerUpdates,
        })
      );
    }

    const transaction: Prisma.PrismaPromise<unknown>[] = [...baseTransaction];

    if (activeEnrollment && Object.keys(opsProfileUpdates).length > 0) {
      transaction.push(
        prisma.opsStudentProfile.upsert({
          where: { enrollmentId: activeEnrollment.id },
          create: {
            ...opsProfileUpdates,
            enrollmentId: activeEnrollment.id,
            customerId: auth.customerId,
          },
          update: opsProfileUpdates,
        })
      );
    }

    const resumeFilename = filenameFromStorageKey(answers.resume);
    if (activeEnrollment && resumeFilename && typeof answers.resume === "string") {
      transaction.push(
        prisma.opsStudentDocument.create({
          data: {
            kind: "CV_ORIGINAL",
            status: "UPLOADED",
            title: "CV enviado no onboarding",
            filename: resumeFilename,
            storageKey: answers.resume,
            version: 1,
            enrollmentId: activeEnrollment.id,
            customerId: auth.customerId,
          },
        })
      );
    }

    try {
      await prisma.$transaction(transaction);
    } catch (error) {
      if (!isMissingOpsNativeTable(error)) throw error;
      await prisma.$transaction(baseTransaction);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Hub Forms] Error submitting form:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { getTemplate } from "@/lib/hub/form-templates";
import { deriveCustomerUpdatesFromFormAnswers } from "@/lib/hub/customer-form-sync";

export const dynamic = "force-dynamic";

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
    const transaction: Prisma.PrismaPromise<unknown>[] = [
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
      transaction.push(
        prisma.customer.update({
          where: { id: auth.customerId },
          data: customerUpdates,
        })
      );
    }

    await prisma.$transaction(transaction);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Hub Forms] Error submitting form:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

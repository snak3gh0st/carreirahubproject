import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { getTemplate } from "@/lib/hub/form-templates";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/forms/[id]
 * Form assignment detail + template fields.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

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

    // Transition PENDING → IN_PROGRESS on first view so ops can distinguish
    // "student hasn't opened it yet" from "student opened but hasn't submitted".
    if (assignment.status === "PENDING") {
      await prisma.formAssignment.update({
        where: { id: assignment.id },
        data: { status: "IN_PROGRESS" },
      });
      assignment.status = "IN_PROGRESS";
    }

    const template = getTemplate(assignment.templateId);

    return NextResponse.json({
      assignment: {
        id: assignment.id,
        templateId: assignment.templateId,
        status: assignment.status,
      },
      template,
      submission: assignment.submission,
    });
  } catch (error) {
    console.error("[Hub Forms] Error fetching form detail:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

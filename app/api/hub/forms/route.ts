import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { getTemplate } from "@/lib/hub/form-templates";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/forms
 * List form assignments for the authenticated client.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const assignments = await prisma.formAssignment.findMany({
      where: { customerId: auth.customerId },
      include: { submission: true },
      orderBy: { assignedAt: "desc" },
    });

    const forms = assignments.map((assignment) => {
      const template = getTemplate(assignment.templateId);
      return {
        id: assignment.id,
        templateId: assignment.templateId,
        title: template?.title ?? assignment.templateId,
        titlePt: template?.titlePt ?? assignment.templateId,
        status: assignment.status,
        assignedAt: assignment.assignedAt,
        submittedAt: assignment.submission?.submittedAt ?? null,
      };
    });

    return NextResponse.json({ forms });
  } catch (error) {
    console.error("[Hub Forms] Error listing forms:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

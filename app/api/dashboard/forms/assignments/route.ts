import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTemplate } from "@/lib/hub/form-templates";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");

    // Build where clause from query params
    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    const assignments = await prisma.formAssignment.findMany({
      where,
      include: {
        customer: {
          select: { name: true, email: true },
        },
        submission: true,
      },
      orderBy: { assignedAt: "desc" },
    });

    // Enrich each assignment with the template title
    const enriched = assignments.map((assignment) => {
      const template = getTemplate(assignment.templateId);
      return {
        ...assignment,
        templateTitle: template?.title ?? assignment.templateId,
      };
    });

    return NextResponse.json({ assignments: enriched });
  } catch (error) {
    console.error("[Dashboard Forms Assignments Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch form assignments" },
      { status: 500 }
    );
  }
}

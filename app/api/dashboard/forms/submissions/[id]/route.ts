import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTemplate } from "@/lib/hub/form-templates";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const submission = await prisma.formSubmission.findUnique({
      where: { id },
      include: {
        assignment: true,
        customer: {
          select: { name: true, email: true },
        },
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    const template = getTemplate(submission.assignment.templateId);

    return NextResponse.json({
      submission,
      template,
      customer: submission.customer,
    });
  } catch (error) {
    console.error("[Dashboard Forms Submission Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch form submission" },
      { status: 500 }
    );
  }
}

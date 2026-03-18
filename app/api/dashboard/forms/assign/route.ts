import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";

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

    // Create a FormAssignment for each customer
    const created = await prisma.formAssignment.createMany({
      data: customerIds.map((cId) => ({
        templateId,
        customerId: cId,
        assignedById,
      })),
    });

    return NextResponse.json({ success: true, count: created.count });
  } catch (error) {
    console.error("[Dashboard Forms Assign Error]:", error);
    return NextResponse.json(
      { error: "Failed to assign form" },
      { status: 500 }
    );
  }
}

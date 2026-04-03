import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";

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
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
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

  return NextResponse.json({ assignment }, { status: 201 });
}

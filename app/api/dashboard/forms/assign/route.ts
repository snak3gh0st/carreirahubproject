import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";
import { hashPassword } from "@/lib/hub-auth";
import { emailService } from "@/lib/services/email.service";
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

    // Create a FormAssignment for each customer
    const created = await prisma.formAssignment.createMany({
      data: customerIds.map((cId) => ({
        templateId,
        customerId: cId,
        assignedById,
      })),
    });

    // Provision hub accounts and send email notifications (fire-and-forget)
    const customers = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, email: true },
    });

    const existingHubUsers = await prisma.clientUser.findMany({
      where: { customerId: { in: customerIds } },
      select: { customerId: true },
    });
    const hasHubAccount = new Set(existingHubUsers.map((u) => u.customerId));

    await Promise.allSettled(
      customers.map(async (customer) => {
        if (hasHubAccount.has(customer.id)) {
          await emailService.sendHubFormAssigned(customer, formTitle);
        } else {
          const tempPassword = randomBytes(5).toString("hex"); // 10-char hex
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
          await emailService.sendHubFormAssigned(customer, formTitle, tempPassword);
        }
      })
    );

    revalidatePath("/dashboard/forms");
    return NextResponse.json({ success: true, count: created.count });
  } catch (error) {
    console.error("[Dashboard Forms Assign Error]:", error);
    return NextResponse.json(
      { error: "Failed to assign form" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "crypto";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTempPassword, hashPassword } from "@/lib/hub-auth";
import { buildHubAccessResetUrl, getHubAccessResetExpiry } from "@/lib/ops/hub-access";
import { isOperationalAccessRole } from "@/lib/roles";
import { notificationService } from "@/lib/services/notification.service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as string | undefined;

  if (!session?.user || !isOperationalAccessRole(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          preferredLanguage: true,
          clientUser: { select: { id: true } },
        },
      },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const email = enrollment.customer.email.toLowerCase().trim();
  const resetToken = crypto.randomUUID();
  const resetTokenExpiresAt = getHubAccessResetExpiry();

  const existingClientUser = enrollment.customer.clientUser;
  if (existingClientUser) {
    await prisma.clientUser.update({
      where: { id: existingClientUser.id },
      data: {
        email,
        mustResetPw: true,
        resetToken,
        resetTokenExpiresAt,
        tempPasswordExpiresAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        language: enrollment.customer.preferredLanguage === "pt-BR" ? "pt-BR" : "en",
      },
    });
  } else {
    const passwordHash = await hashPassword(generateTempPassword());
    await prisma.clientUser.create({
      data: {
        email,
        passwordHash,
        mustResetPw: true,
        resetToken,
        resetTokenExpiresAt,
        tempPasswordExpiresAt: null,
        customerId: enrollment.customer.id,
        language: enrollment.customer.preferredLanguage === "pt-BR" ? "pt-BR" : "en",
      },
    });
  }

  const resetUrl = buildHubAccessResetUrl(resetToken);
  await notificationService.sendHubPasswordReset(
    { id: enrollment.customer.id, email, name: enrollment.customer.name },
    resetUrl
  );

  return NextResponse.json({
    success: true,
    email,
    expiresAt: resetTokenExpiresAt.toISOString(),
  });
}

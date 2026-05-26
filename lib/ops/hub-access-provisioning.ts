import crypto from "crypto";

import { prisma } from "@/lib/db";
import { generateTempPassword, hashPassword } from "@/lib/hub-auth";
import { buildHubAccessResetUrl, getHubAccessResetExpiry } from "@/lib/ops/hub-access";

type HubAccessCustomer = {
  id: string;
  name: string;
  email: string;
  preferredLanguage?: string | null;
  clientUser?: { id: string } | null;
};

type HubAccessEnrollment = {
  id: string;
  customer: HubAccessCustomer;
};

type PrismaLike = {
  mentorshipEnrollment: {
    findUnique: (args: unknown) => Promise<HubAccessEnrollment | null>;
  };
  clientUser: {
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
  };
};

type NotificationLike = {
  sendHubAccessInvite?: (
    customer: HubAccessCustomer,
    resetUrl: string
  ) => Promise<void>;
  sendHubPasswordReset?: (
    customer: { id: string; email: string; name: string },
    resetUrl: string
  ) => Promise<void>;
};

export type HubAccessProvisioningResult =
  | {
      success: true;
      email: string;
      clientUserCreated: boolean;
      resetTokenExpiresAt: Date;
    }
  | {
      success: false;
      reason: "ENROLLMENT_NOT_FOUND";
    };

export interface HubAccessProvisioningDeps {
  prismaClient?: PrismaLike;
  notificationService?: NotificationLike;
  generateResetToken?: () => string;
  getResetExpiry?: () => Date;
  buildResetUrl?: (resetToken: string) => string;
  generateTempPassword?: () => string;
  hashPassword?: (password: string) => Promise<string>;
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function normalizeLanguage(language: string | null | undefined) {
  return language === "pt-BR" ? "pt-BR" : "en";
}

export async function provisionHubAccessForEnrollment(
  input: { enrollmentId: string },
  deps: HubAccessProvisioningDeps = {}
): Promise<HubAccessProvisioningResult> {
  const prismaClient = deps.prismaClient ?? (prisma as unknown as PrismaLike);
  const notifier =
    deps.notificationService ??
    (await import("@/lib/services/notification.service")).notificationService;
  const enrollment = await prismaClient.mentorshipEnrollment.findUnique({
    where: { id: input.enrollmentId },
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
    return { success: false, reason: "ENROLLMENT_NOT_FOUND" };
  }

  const email = normalizeEmail(enrollment.customer.email);
  const resetToken = deps.generateResetToken?.() ?? crypto.randomUUID();
  const resetTokenExpiresAt = deps.getResetExpiry?.() ?? getHubAccessResetExpiry();
  const language = normalizeLanguage(enrollment.customer.preferredLanguage);

  if (enrollment.customer.clientUser) {
    await prismaClient.clientUser.update({
      where: { id: enrollment.customer.clientUser.id },
      data: {
        email,
        mustResetPw: true,
        resetToken,
        resetTokenExpiresAt,
        tempPasswordExpiresAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
        language,
      },
    });
  } else {
    const tempPassword = deps.generateTempPassword?.() ?? generateTempPassword();
    const passwordHash = await (deps.hashPassword ?? hashPassword)(tempPassword);
    await prismaClient.clientUser.create({
      data: {
        email,
        passwordHash,
        mustResetPw: true,
        resetToken,
        resetTokenExpiresAt,
        tempPasswordExpiresAt: null,
        customerId: enrollment.customer.id,
        language,
      },
    });
  }

  const resetUrl = (deps.buildResetUrl ?? buildHubAccessResetUrl)(resetToken);
  if (notifier.sendHubAccessInvite) {
    await notifier.sendHubAccessInvite(
      { ...enrollment.customer, email, preferredLanguage: language },
      resetUrl
    );
  } else if (notifier.sendHubPasswordReset) {
    await notifier.sendHubPasswordReset(
      { id: enrollment.customer.id, email, name: enrollment.customer.name },
      resetUrl
    );
  }

  return {
    success: true,
    email,
    clientUserCreated: !enrollment.customer.clientUser,
    resetTokenExpiresAt,
  };
}

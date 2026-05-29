import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole } from "@/lib/roles";
import { provisionHubAccessForEnrollment } from "@/lib/ops/hub-access-provisioning";
import {
  sendDigisacLifecycleMessageSafely,
  buildDigisacLifecycleDedupeKey,
} from "@/lib/ops/digisac-lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST /api/ops/enrollments/[id]/send-hub-access
 *
 * Manual, ops-initiated Hub onboarding (Franeze decides whether/when to send).
 * Hub onboarding is NEVER sent automatically (see mentorship.createEnrollment).
 *
 * Restricted to:
 *  - role OPERATIONAL/ADMIN (isOperationalAccessRole)
 *  - programType === "PASS" (Program Pass only)
 *
 * Sends both channels:
 *  1. Provisions Hub access (ClientUser + access/set-password email), with a
 *     manual override so the auto-pause policy does not block it.
 *  2. Sends the WhatsApp "program_welcome" message (best-effort).
 */
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
    select: { id: true, programType: true },
  });

  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  if (enrollment.programType !== "PASS") {
    return NextResponse.json(
      { error: "O Hub só pode ser enviado para alunos do Program Pass." },
      { status: 400 }
    );
  }

  // 1) Hub access (email) — manual override bypasses the auto-pause.
  const provision = await provisionHubAccessForEnrollment({
    enrollmentId: enrollment.id,
    manualOverride: true,
  });

  if (!provision.success) {
    const notFound = provision.reason === "ENROLLMENT_NOT_FOUND";
    return NextResponse.json(
      { error: notFound ? "Enrollment not found" : "Falha ao provisionar acesso ao Hub." },
      { status: notFound ? 404 : 500 }
    );
  }

  // 2) WhatsApp welcome (best-effort — logs LIFECYCLE_MESSAGE_FAILED on error).
  await sendDigisacLifecycleMessageSafely({
    event: "program_welcome",
    enrollmentId: enrollment.id,
    dedupeKey: buildDigisacLifecycleDedupeKey("program_welcome", enrollment.id),
    metadata: { source: "ops.send-hub-access" },
    force: true, // explicit manual ops send — bypass the global lifecycle lock
  });

  return NextResponse.json({
    success: true,
    email: provision.email,
    expiresAt: provision.resetTokenExpiresAt?.toISOString?.() ?? null,
  });
}

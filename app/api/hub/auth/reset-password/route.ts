import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/hub/auth/reset-password
 *
 * Request a password reset link for a ClientUser.
 *
 * Body: { email: string }
 *
 * Always returns { success: true } regardless of whether the email exists
 * to prevent email enumeration attacks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body as { email?: string };

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const clientUser = await prisma.clientUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (clientUser) {
      const resetToken = crypto.randomUUID();
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.clientUser.update({
        where: { id: clientUser.id },
        data: { resetToken, resetTokenExpiresAt },
      });

      // TODO: Send reset email via notificationService.sendHubPasswordReset
      // The method will be created in a later task.
      console.log(
        `[HUB_RESET_PASSWORD] Reset token generated for ${normalizedEmail}`
      );
    }

    // Always return success to avoid leaking email existence
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[HUB_RESET_PASSWORD] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

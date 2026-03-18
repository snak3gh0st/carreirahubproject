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

      // Send reset email
      const baseUrl = process.env.NEXTAUTH_URL || "https://carreirausa.sigmaintel.io";
      const resetUrl = `${baseUrl}/hub/set-password?token=${resetToken}`;
      try {
        const { notificationService } = await import("@/lib/services/notification.service");
        const customer = await prisma.customer.findFirst({ where: { email: normalizedEmail } });
        if (customer) {
          await notificationService.sendHubPasswordReset(
            { id: customer.id, email: customer.email, name: customer.name },
            resetUrl
          );
        }
      } catch (emailErr: any) {
        console.error("[HUB_RESET_PASSWORD] Email send failed:", emailErr.message);
      }
      console.log(`[HUB_RESET_PASSWORD] Reset token generated for ${normalizedEmail}`);
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

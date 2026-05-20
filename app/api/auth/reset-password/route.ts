import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { emailService } from "@/lib/services/email.service";
import { buildSafeCallbackUrl } from "@/lib/hub-links";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, callbackUrl } = body as {
      email?: string;
      callbackUrl?: string | null;
    };

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, name: true, active: true },
    });

    if (user?.active) {
      const resetToken = crypto.randomUUID();
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const safeCallbackUrl = buildSafeCallbackUrl(callbackUrl, "/dashboard");

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiresAt,
        },
      });

      const baseUrl =
        process.env.NEXTAUTH_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        new URL(request.url).origin;
      const resetUrl = new URL("/auth/set-password", baseUrl);
      resetUrl.searchParams.set("token", resetToken);
      if (safeCallbackUrl !== "/dashboard") {
        resetUrl.searchParams.set("callbackUrl", safeCallbackUrl);
      }

      try {
        await emailService.sendInternalPasswordReset({
          name: user.name,
          email: user.email,
          resetUrl: resetUrl.toString(),
        });
      } catch (emailError: any) {
        console.error("[AUTH_RESET_PASSWORD] Email send failed:", emailError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AUTH_RESET_PASSWORD] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

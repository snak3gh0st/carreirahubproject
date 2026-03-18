import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/hub-auth";
import { clearRateLimit } from "@/lib/hub-rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/hub/auth/set-password
 *
 * Set a new password using a reset token.
 *
 * Body: { token: string, password: string }
 *
 * Flow:
 * 1. Validate password length (>= 8 chars)
 * 2. Find ClientUser by resetToken
 * 3. Check resetTokenExpiresAt not expired
 * 4. Hash new password
 * 5. Update user: clear reset fields, unlock account
 * 6. Clear rate limit for this email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body as { token?: string; password?: string };

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      );
    }

    // ── 1. Validate password length ────────────────────────────
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // ── 2. Find ClientUser by resetToken ───────────────────────
    const clientUser = await prisma.clientUser.findUnique({
      where: { resetToken: token },
    });

    if (!clientUser) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // ── 3. Check token expiry ──────────────────────────────────
    if (
      !clientUser.resetTokenExpiresAt ||
      clientUser.resetTokenExpiresAt < new Date()
    ) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }

    // ── 4. Hash new password ───────────────────────────────────
    const passwordHash = await hashPassword(password);

    // ── 5. Update ClientUser ───────────────────────────────────
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: {
        passwordHash,
        mustResetPw: false,
        resetToken: null,
        resetTokenExpiresAt: null,
        tempPasswordExpiresAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    // ── 6. Clear rate limit ────────────────────────────────────
    await clearRateLimit(clientUser.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[HUB_SET_PASSWORD] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

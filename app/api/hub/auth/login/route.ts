import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  signHubToken,
  verifyPassword,
  setHubCookie,
  HubJwtPayload,
} from "@/lib/hub-auth";
import { checkRateLimit } from "@/lib/hub-rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/hub/auth/login
 *
 * Authenticate a ClientUser (customer portal login).
 *
 * Body: { email: string, password: string }
 *
 * Flow:
 * 1. Rate-limit check (Redis)
 * 2. Lookup ClientUser by email
 * 3. Account lockout check
 * 4. Temp-password expiry check
 * 5. Bcrypt password verification
 * 6. On failure: increment failedLoginCount, lock after 10 failures
 * 7. On success: reset counters, update lastLoginAt
 * 8. If mustResetPw: issue resetToken and redirect client to set-password
 * 9. Otherwise: sign JWT, set httpOnly cookie, return success
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── 1. Rate limit ──────────────────────────────────────────
    const rateResult = await checkRateLimit(normalizedEmail);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    // ── 2. Find ClientUser ─────────────────────────────────────
    const clientUser = await prisma.clientUser.findUnique({
      where: { email: normalizedEmail },
      include: { customer: true },
    });

    if (!clientUser) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // ── 3. Account lockout ─────────────────────────────────────
    if (clientUser.lockedUntil && clientUser.lockedUntil > new Date()) {
      return NextResponse.json(
        { error: "Account locked. Please try again later or reset your password." },
        { status: 423 }
      );
    }

    // ── 4. Temp password expiry ────────────────────────────────
    if (
      clientUser.mustResetPw &&
      clientUser.tempPasswordExpiresAt &&
      clientUser.tempPasswordExpiresAt < new Date()
    ) {
      return NextResponse.json(
        {
          error: "Your temporary password has expired. Please request a password reset.",
          tempExpired: true,
        },
        { status: 401 }
      );
    }

    // ── 5. Verify password ─────────────────────────────────────
    const passwordValid = await verifyPassword(password, clientUser.passwordHash);

    if (!passwordValid) {
      // ── 7. Failed attempt ────────────────────────────────────
      const newFailedCount = clientUser.failedLoginCount + 1;
      const updateData: Record<string, unknown> = {
        failedLoginCount: newFailedCount,
      };

      // Lock account after 10 consecutive failures
      if (newFailedCount >= 10) {
        updateData.lockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      }

      await prisma.clientUser.update({
        where: { id: clientUser.id },
        data: updateData,
      });

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // ── 8. Successful authentication ───────────────────────────
    // Reset failure counters and update lastLoginAt
    await prisma.clientUser.update({
      where: { id: clientUser.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // ── 9. Must reset password? ────────────────────────────────
    if (clientUser.mustResetPw) {
      const resetToken = crypto.randomUUID();
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.clientUser.update({
        where: { id: clientUser.id },
        data: { resetToken, resetTokenExpiresAt },
      });

      return NextResponse.json({
        mustResetPw: true,
        resetToken,
      });
    }

    // ── 10. Issue JWT and set cookie ───────────────────────────
    const payload: HubJwtPayload = {
      clientUserId: clientUser.id,
      customerId: clientUser.customerId,
      email: clientUser.email,
      language: clientUser.language,
    };

    const token = await signHubToken(payload);
    const response = NextResponse.json({
      success: true,
      language: clientUser.language,
    });
    setHubCookie(response, token);

    return response;
  } catch (error) {
    console.error("[HUB_LOGIN] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

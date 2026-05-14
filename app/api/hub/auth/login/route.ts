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
import {
  ACCESS_AUDIT_ACTIONS,
  createAccessAuditLog,
  getAuditHost,
  getAuditIp,
} from "@/lib/admin/access-audit";

export const dynamic = "force-dynamic";

async function auditHubLogin(
  request: NextRequest,
  input: {
    action: string;
    outcome: "success" | "failure";
    statusCode: number;
    email?: string | null;
    clientUserId?: string | null;
    customerId?: string | null;
    error?: string | null;
    metadata?: Record<string, string | number | boolean | null | undefined>;
  }
) {
  await createAccessAuditLog({
    action: input.action,
    actorType: "client",
    outcome: input.outcome,
    email: input.email,
    clientUserId: input.clientUserId,
    customerId: input.customerId,
    method: request.method,
    path: request.nextUrl.pathname,
    statusCode: input.statusCode,
    ip: getAuditIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    host: getAuditHost(request.headers),
    source: "hub-auth",
    error: input.error,
    metadata: input.metadata,
  });
}

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
      if (email) {
        await auditHubLogin(request, {
          action: ACCESS_AUDIT_ACTIONS.CLIENT_LOGIN_FAILED,
          outcome: "failure",
          statusCode: 400,
          email: email.toLowerCase().trim(),
          error: "missing_credentials",
        });
      }
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── 1. Rate limit ──────────────────────────────────────────
    const rateResult = await checkRateLimit(normalizedEmail);
    if (!rateResult.allowed) {
      await auditHubLogin(request, {
        action: ACCESS_AUDIT_ACTIONS.CLIENT_LOGIN_FAILED,
        outcome: "failure",
        statusCode: 429,
        email: normalizedEmail,
        error: "rate_limited",
      });
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
      await auditHubLogin(request, {
        action: ACCESS_AUDIT_ACTIONS.CLIENT_LOGIN_FAILED,
        outcome: "failure",
        statusCode: 401,
        email: normalizedEmail,
        error: "client_user_not_found",
      });
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // ── 3. Account lockout ─────────────────────────────────────
    if (clientUser.lockedUntil && clientUser.lockedUntil > new Date()) {
      await auditHubLogin(request, {
        action: ACCESS_AUDIT_ACTIONS.CLIENT_LOGIN_FAILED,
        outcome: "failure",
        statusCode: 423,
        email: clientUser.email,
        clientUserId: clientUser.id,
        customerId: clientUser.customerId,
        error: "account_locked",
      });
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
      await auditHubLogin(request, {
        action: ACCESS_AUDIT_ACTIONS.CLIENT_LOGIN_FAILED,
        outcome: "failure",
        statusCode: 401,
        email: clientUser.email,
        clientUserId: clientUser.id,
        customerId: clientUser.customerId,
        error: "temporary_password_expired",
      });
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

      await auditHubLogin(request, {
        action: ACCESS_AUDIT_ACTIONS.CLIENT_LOGIN_FAILED,
        outcome: "failure",
        statusCode: 401,
        email: clientUser.email,
        clientUserId: clientUser.id,
        customerId: clientUser.customerId,
        error: "invalid_password",
        metadata: {
          failedLoginCount: newFailedCount,
          lockedAfterAttempt: newFailedCount >= 10,
        },
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

    await auditHubLogin(request, {
      action: ACCESS_AUDIT_ACTIONS.CLIENT_LOGIN_SUCCESS,
      outcome: "success",
      statusCode: 200,
      email: clientUser.email,
      clientUserId: clientUser.id,
      customerId: clientUser.customerId,
      metadata: {
        mustResetPw: clientUser.mustResetPw,
        language: clientUser.language,
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

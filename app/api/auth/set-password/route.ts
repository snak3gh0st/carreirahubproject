import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { authService } from "@/lib/services/auth.service";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/set-password
 *
 * Set or update user password (authenticated users only)
 *
 * This endpoint is used for:
 * 1. Initial password setup after user creation via /api/users
 * 2. Password reset flows using a reset token
 *
 * Request body:
 * {
 *   password: string (minimum 8 characters)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   message: "Password set successfully"
 * }
 *
 * After setting password, user must log in again with their email and new password.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { password, token } = body as { password?: string; token?: string };

    // Validate password length
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required and must be a string" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    let hashedPassword: string;
    try {
      hashedPassword = await authService.hashPassword(password);
    } catch (hashError) {
      console.error("[SET_PASSWORD] Error hashing password:", hashError);
      return NextResponse.json(
        { error: "Failed to process password" },
        { status: 500 }
      );
    }

    if (token) {
      const user = await prisma.user.findUnique({
        where: { resetToken: token },
        select: {
          id: true,
          resetTokenExpiresAt: true,
        },
      });

      if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
        return NextResponse.json(
          { error: "Invalid or expired token" },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordHashedAt: new Date(),
          resetToken: null,
          resetTokenExpiresAt: null,
          active: true,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: "Password reset successfully. Please log in with your new password.",
        },
        { status: 200 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = (session.user as any).id as string;

    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
          passwordHashedAt: new Date(),
        },
      });
    } catch (updateError) {
      console.error("[SET_PASSWORD] Error updating user password:", updateError);
      return NextResponse.json(
        { error: "Failed to set password" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Password set successfully. Please log in again with your new password.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[SET_PASSWORD] Error in set-password endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

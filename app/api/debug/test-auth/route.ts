import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authService } from "@/lib/services/auth.service";

/**
 * Debug endpoint to test authentication
 * DELETE THIS FILE after debugging
 */
export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    console.log("[DEBUG AUTH] Testing login for:", email);

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        password: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: "User not found",
        email,
      });
    }

    console.log("[DEBUG AUTH] User found:", {
      id: user.id,
      email: user.email,
      active: user.active,
      hasPassword: !!user.password,
    });

    if (!user.active) {
      return NextResponse.json({
        success: false,
        error: "User is not active",
        user: {
          email: user.email,
          active: user.active,
        },
      });
    }

    if (!user.password) {
      return NextResponse.json({
        success: false,
        error: "User has no password set",
        user: {
          email: user.email,
          hasPassword: false,
        },
      });
    }

    // Test password with bcrypt directly
    console.log("[DEBUG AUTH] Testing password...");
    console.log("[DEBUG AUTH] Password to test:", password);
    console.log("[DEBUG AUTH] Hash from DB:", user.password.substring(0, 30) + "...");

    // Test with bcrypt directly
    const bcrypt = await import("bcryptjs");
    const passwordValidDirect = await bcrypt.default.compare(password, user.password);
    console.log("[DEBUG AUTH] Bcrypt direct test:", passwordValidDirect);

    // Test with authService
    const passwordValid = await authService.verifyPassword(
      password,
      user.password
    );
    console.log("[DEBUG AUTH] AuthService test:", passwordValid);

    if (!passwordValid) {
      return NextResponse.json({
        success: false,
        error: "Invalid password",
        user: {
          email: user.email,
          hasPassword: true,
          passwordValid: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Authentication successful!",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active,
      },
    });
  } catch (error: any) {
    console.error("[DEBUG AUTH] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Unknown error",
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

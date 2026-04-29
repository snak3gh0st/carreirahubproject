import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

/**
 * POST /api/users
 *
 * Create a new user (ADMIN-only endpoint)
 *
 * Required Role: ADMIN
 * Non-admin users will receive 403 Forbidden
 *
 * Request body:
 * {
 *   email: string (unique)
 *   name: string (required)
 *   role: UserRole (ADMIN | FINANCE | OPERATIONAL | COMMERCIAL)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   user: { id, email, name, role }
 * }
 *
 * The created user starts with NO password.
 * User must call /api/auth/set-password to set their password before logging in.
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check ADMIN role
    const userRole = (session.user as any).role as UserRole;
    if (userRole !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: "Forbidden: Only ADMIN users can create users" },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, name, role } = body;

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required and must be non-empty" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = Object.values(UserRole);
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already exists" },
        { status: 400 }
      );
    }

    // Create user (no password - must be set via /api/auth/set-password)
    const newUser = await prisma.user.create({
      data: {
        email,
        name: name.trim(),
        role,
        active: true,
        // password is null - user must set it
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: newUser,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[USERS] Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

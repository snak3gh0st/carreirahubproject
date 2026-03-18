import { NextRequest, NextResponse } from "next/server";
import { getHubAuth, verifyCsrf, verifyPassword, hashPassword } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/profile
 * Return the authenticated client user's profile.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientUser = await prisma.clientUser.findUnique({
      where: { id: auth.clientUserId },
      select: {
        language: true,
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!clientUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      name: clientUser.customer.name,
      email: clientUser.customer.email,
      phone: clientUser.customer.phone,
      language: clientUser.language,
    });
  } catch (error) {
    console.error("[Hub Profile] Error fetching profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/hub/profile
 * Update language preference or change password.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const body = await request.json();
    const { language, currentPassword, newPassword } = body;

    // ---- Language update ----
    if (language) {
      await prisma.clientUser.update({
        where: { id: auth.clientUserId },
        data: { language },
      });
    }

    // ---- Password change ----
    if (currentPassword && newPassword) {
      const clientUser = await prisma.clientUser.findUnique({
        where: { id: auth.clientUserId },
        select: { passwordHash: true },
      });

      if (!clientUser) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      const isValid = await verifyPassword(
        currentPassword,
        clientUser.passwordHash
      );
      if (!isValid) {
        return NextResponse.json(
          { error: "Current password is incorrect" },
          { status: 400 }
        );
      }

      const hashed = await hashPassword(newPassword);
      await prisma.clientUser.update({
        where: { id: auth.clientUserId },
        data: { passwordHash: hashed },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Hub Profile] Error updating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

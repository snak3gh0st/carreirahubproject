import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { isOperationalManagerRole, isOperationalTeamRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as any)?.role as string | undefined;
    if (!session || (sessionRole !== UserRole.ADMIN && !isOperationalManagerRole(sessionRole))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = (session.user as any).id as string;
    if (params.id === adminId) {
      return NextResponse.json({ error: "Cannot modify your own account" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (sessionRole !== UserRole.ADMIN && !isOperationalTeamRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updateData: { name?: string; role?: UserRole; active?: boolean } = {};

    if (body.name !== undefined) updateData.name = String(body.name).trim();
    if (body.role !== undefined) {
      if (!Object.values(UserRole).includes(body.role as UserRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      if (sessionRole !== UserRole.ADMIN && !isOperationalTeamRole(body.role)) {
        return NextResponse.json({ error: "Role not permitted for operational manager" }, { status: 403 });
      }
      updateData.role = body.role as UserRole;
    }
    if (body.active !== undefined) updateData.active = Boolean(body.active);

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, assignedPhases: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("[TEAM] PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionRole = (session?.user as any)?.role as string | undefined;
    if (!session || (sessionRole !== UserRole.ADMIN && !isOperationalManagerRole(sessionRole))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminId = (session.user as any).id as string;
    if (params.id === adminId) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (sessionRole !== UserRole.ADMIN && !isOperationalTeamRole(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (user.active) {
      return NextResponse.json({ error: "Deactivate user before deleting" }, { status: 403 });
    }

    await prisma.user.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TEAM] DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

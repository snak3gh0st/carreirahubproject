import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authService } from "@/lib/services/auth.service";
import { emailService } from "@/lib/services/email.service";
import { UserRole } from "@prisma/client";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const status = searchParams.get("status") || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }
    if (status === "active") where.active = true;
    if (status === "inactive") where.active = false;

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, assignedPhases: true },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[TEAM] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== UserRole.ADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, role } = body;

    if (!name?.trim() || !email?.trim() || !role) {
      return NextResponse.json({ error: "name, email and role are required" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (!Object.values(UserRole).includes(role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }

    const tempPassword = crypto.randomBytes(12).toString("base64url");
    const hashedPassword = await authService.hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: { name: name.trim(), email: normalizedEmail, role: role as UserRole, password: hashedPassword, passwordHashedAt: new Date(), active: true },
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, assignedPhases: true },
    });

    try {
      await emailService.sendTeamMemberWelcome({ name: user.name ?? name, email: user.email, tempPassword });
    } catch (emailErr) {
      console.error("[TEAM] Welcome email failed, rolling back user creation:", emailErr);
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      return NextResponse.json({ error: "User creation failed: could not send welcome email" }, { status: 500 });
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    console.error("[TEAM] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

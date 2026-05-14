// app/api/ops/coordinator/phases/[userId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { isOperationalManagerRole } from "@/lib/roles";

const bodySchema = z.object({
  assignedPhases: z.array(z.string()),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callerRole = (session.user as any).role;
  if (!isOperationalManagerRole(callerRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  // Validate all phase keys against the DB
  const validPhases = await prisma.mentorshipPhase.findMany({
    select: { key: true },
  });
  const validKeys = new Set(validPhases.map((p) => p.key));
  const invalidKeys = parsed.data.assignedPhases.filter((k) => !validKeys.has(k));
  if (invalidKeys.length > 0) {
    return NextResponse.json(
      { error: `Unknown phase keys: ${invalidKeys.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: params.userId },
      data: { assignedPhases: parsed.data.assignedPhases },
      select: { id: true, name: true, assignedPhases: true },
    });
    return NextResponse.json({ user: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    throw e;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  OPS_STAFF_STATUSES,
  parseOpsStaffMemberInput,
} from "@/lib/ops/staff-members";
import {
  isOperationalAccessRole,
  isOperationalManagerRole,
} from "@/lib/roles";

export const dynamic = "force-dynamic";

const staffSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  areas: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role as string | undefined;
  if (!isOperationalAccessRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const where =
    status && (OPS_STAFF_STATUSES as readonly string[]).includes(status)
      ? { status }
      : undefined;

  const staffMembers = await prisma.opsStaffMember.findMany({
    where,
    select: staffSelect,
    orderBy: [{ name: "asc" }],
  });

  return NextResponse.json({ staffMembers });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any).role as string | undefined;
  if (!isOperationalManagerRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = parseOpsStaffMemberInput(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados invalidos do ex-funcionario",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  if (parsed.data.areas.length > 0) {
    const validPhases = await prisma.mentorshipPhase.findMany({
      where: { key: { in: parsed.data.areas } },
      select: { key: true },
    });
    const validKeys = new Set(validPhases.map((phase) => phase.key));
    const invalidKeys = parsed.data.areas.filter((area) => !validKeys.has(area));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Areas invalidas: ${invalidKeys.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const staffMember = await prisma.opsStaffMember.create({
    data: parsed.data,
    select: staffSelect,
  });

  return NextResponse.json({ staffMember }, { status: 201 });
}

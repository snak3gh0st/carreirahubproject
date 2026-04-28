import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/ops/phases
 * Returns all mentorship phases ordered by sortOrder.
 * Gated to authenticated users.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const phases = await prisma.mentorshipPhase.findMany({
    select: { id: true, key: true, label: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ phases });
}

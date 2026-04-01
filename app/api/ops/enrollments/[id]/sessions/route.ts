import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
  const PAGE_SIZE = 20;

  const [sessions, total] = await Promise.all([
    prisma.mentorshipSession.findMany({
      where: { enrollmentId: params.id },
      orderBy: { sessionDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { conductor: { select: { name: true } } },
    }),
    prisma.mentorshipSession.count({ where: { enrollmentId: params.id } }),
  ]);

  return NextResponse.json({ sessions, total, page, pageSize: PAGE_SIZE });
}

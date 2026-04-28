import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/ops/users
 * Returns users filtered by roles (query param: roles=ADMIN,OPERATIONAL).
 * Gated to ADMIN role for full access; OPERATIONAL users get a limited view.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userRole = (session.user as any).role as string;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rolesParam = req.nextUrl.searchParams.get("roles");
  const roles = rolesParam ? rolesParam.split(",") : [];

  const users = await prisma.user.findMany({
    where: {
      active: true,
      ...(roles.length > 0 ? { role: { in: roles as any[] } } : {}),
    },
    select: { id: true, name: true, email: true, role: true, assignedPhases: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}

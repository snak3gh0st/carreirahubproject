import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/integration-logs
 * Listar logs de integração com filtros opcionais
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const searchParams = request.nextUrl.searchParams;
    const service = searchParams.get("service");
    const status = searchParams.get("status");
    const action = searchParams.get("action");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (service) where.service = service;
    if (status) where.status = status;
    if (action) where.action = action;

    const logs = await prisma.integrationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    // Estatísticas
    const stats = await prisma.integrationLog.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    return NextResponse.json({
      logs,
      stats: stats.reduce(
        (acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        },
        {} as Record<string, number>
      ),
      pagination: {
        limit,
        offset,
        total: logs.length,
      },
    });
  } catch (error) {
    console.error("Error listing integration logs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


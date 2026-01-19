import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/quickbooks/price-levels
 * Fetch all active QuickBooks Price Levels from database (synced data)
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const priceLevels = await prisma.quickBooksPriceLevel.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        qbId: true,
        name: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(priceLevels);
  } catch (error: any) {
    console.error("Error fetching QuickBooks price levels:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch QuickBooks price levels" },
      { status: 500 }
    );
  }
}

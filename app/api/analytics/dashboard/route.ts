import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/analytics/dashboard
 * Get dashboard analytics data for charts
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get revenue data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const invoicesByDay = await prisma.invoice.groupBy({
      by: ["createdAt"],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: "PAID",
      },
      _sum: {
        amount: true,
      },
    });

    const revenueData = invoicesByDay
      .map((item) => ({
        date: new Date(item.createdAt).toLocaleDateString("pt-BR"),
        revenue: Number(item._sum.amount) || 0,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Get invoice status distribution
    const invoicesByStatus = await prisma.invoice.groupBy({
      by: ["status"],
      _count: true,
    });

    const invoiceStatusData = invoicesByStatus.map((item) => ({
      name: item.status,
      value: item._count,
    }));

    // Get lead conversion funnel
    const leadsByStatus = await prisma.lead.groupBy({
      by: ["status"],
      _count: true,
    });

    const conversionData = [
      { stage: "NEW", count: leadsByStatus.find((l) => l.status === "NEW")?._count || 0, percentage: 0 },
      { stage: "QUALIFYING", count: leadsByStatus.find((l) => l.status === "QUALIFYING")?._count || 0, percentage: 0 },
      { stage: "QUALIFIED", count: leadsByStatus.find((l) => l.status === "QUALIFIED")?._count || 0, percentage: 0 },
      { stage: "CONVERTED", count: leadsByStatus.find((l) => l.status === "CONVERTED")?._count || 0, percentage: 0 },
    ];

    // Calculate conversion rates
    const totalLeads = conversionData.reduce((sum, item) => sum + item.count, 0);
    if (totalLeads > 0) {
      conversionData.forEach((item) => {
        item.percentage = Math.round((item.count / totalLeads) * 100);
      });
    }

    return NextResponse.json({
      revenue: revenueData,
      invoiceStatus: invoiceStatusData,
      conversionFunnel: conversionData,
    });
  } catch (error) {
    console.error("[ANALYTICS] Error getting dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to get analytics data" },
      { status: 500 }
    );
  }
}

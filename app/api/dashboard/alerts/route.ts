import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id;

    // Only show alerts from last 7 days to avoid spam
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Build where clause based on role
    const whereClause: any = {
      status: { in: ["ACTIVE", "ACKNOWLEDGED"] },
      triggeredAt: { gte: sevenDaysAgo }, // Only recent alerts
    };

    // Role-based filtering
    if (userRole === "FINANCE") {
      // Finance sees: overdue invoices, low collection rate, QB sync issues
      whereClause.rule = {
        name: {
          in: [
            "Overdue Invoices Alert",
            "Low Collection Rate",
            "QuickBooks Sync Failed",
          ],
        },
      };
    } else if (userRole === "COMMERCIAL") {
      // Commercial sees: their deals at risk, their overdue invoices, pending approvals
      whereClause.OR = [
        {
          rule: { name: "High-Value Deals at Risk" },
          deal: { ownerId: userId },
        },
        {
          rule: { name: "Overdue Invoices Alert" },
          invoice: { ownerId: userId },
        },
        {
          rule: { name: "Invoice Pending Approval" },
          invoice: { ownerId: userId },
        },
      ];
    }
    // ADMIN sees all alerts (no additional filter)

    // Get alerts with limit per rule to prevent spam
    const alerts = await prisma.alert.findMany({
      where: whereClause,
      include: {
        rule: true,
        invoice: {
          include: {
            owner: {
              select: { id: true, name: true },
            },
          },
        },
        customer: true,
        deal: {
          include: {
            owner: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: [{ severity: "desc" }, { triggeredAt: "desc" }],
      take: 20, // Max 20 alerts total to prevent spam
    });

    // Group by rule and limit per rule
    const alertsByRule = alerts.reduce((acc, alert) => {
      const ruleName = alert.rule?.name || "Unknown";
      if (!acc[ruleName]) {
        acc[ruleName] = [];
      }
      // Max 5 alerts per rule type
      if (acc[ruleName].length < 5) {
        acc[ruleName].push(alert);
      }
      return acc;
    }, {} as Record<string, any[]>);

    // Flatten back to array
    const limitedAlerts = Object.values(alertsByRule).flat();

    return NextResponse.json({
      alerts: limitedAlerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        status: alert.status,
        triggeredAt: alert.triggeredAt,
        acknowledgedAt: alert.acknowledgedAt,
        customerId: alert.customerId,
        invoiceId: alert.invoiceId,
        dealId: alert.dealId,
        data: alert.data,
        rule: {
          id: alert.rule?.id,
          name: alert.rule?.name,
        },
      })),
      metadata: {
        total: limitedAlerts.length,
        role: userRole,
        timePeriod: "Last 7 days",
      },
    });
  } catch (error) {
    console.error("[Dashboard Alerts Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

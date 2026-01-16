import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get active and acknowledged alerts
    const alerts = await prisma.alert.findMany({
      where: {
        status: { in: ["ACTIVE", "ACKNOWLEDGED"] },
      },
      include: {
        rule: true,
        invoice: true,
        customer: true,
        deal: true,
      },
      orderBy: [{ severity: "desc" }, { triggeredAt: "desc" }],
      take: 50,
    });

    return NextResponse.json({
      alerts: alerts.map((alert) => ({
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
    });
  } catch (error) {
    console.error("[Dashboard Alerts Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch alerts" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AlertStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { alertId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action } = await request.json();

    if (!action || !["acknowledge", "resolve", "dismiss"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    // Get current alert
    const alert = await prisma.alert.findUnique({
      where: { id: params.alertId },
    });

    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    let newStatus: AlertStatus;
    let data: any = { updatedAt: new Date() };

    switch (action) {
      case "acknowledge":
        newStatus = AlertStatus.ACKNOWLEDGED;
        data.acknowledgedAt = new Date();
        break;
      case "resolve":
        newStatus = AlertStatus.RESOLVED;
        data.resolvedAt = new Date();
        break;
      case "dismiss":
        newStatus = AlertStatus.DISMISSED;
        data.dismissedAt = new Date();
        data.dismissedBy = session.user?.email;
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update alert
    const updatedAlert = await prisma.alert.update({
      where: { id: params.alertId },
      data: {
        status: newStatus,
        ...data,
      },
    });

    // Create event log
    await prisma.alertEvent.create({
      data: {
        alertId: alert.id,
        eventType: action.toUpperCase(),
        actor: session.user?.email,
        previousStatus: alert.status,
        newStatus,
      },
    });

    return NextResponse.json({
      success: true,
      alert: {
        id: updatedAlert.id,
        status: updatedAlert.status,
        acknowledgedAt: updatedAlert.acknowledgedAt,
        resolvedAt: updatedAlert.resolvedAt,
        dismissedAt: updatedAlert.dismissedAt,
      },
    });
  } catch (error) {
    console.error("[Dashboard Alert Update Error]:", error);
    return NextResponse.json(
      { error: "Failed to update alert" },
      { status: 500 }
    );
  }
}

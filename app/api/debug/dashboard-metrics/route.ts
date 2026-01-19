import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const dateRange = url.searchParams.get("dateRange") || "allTime";

    // Calculate date range (same logic as dashboard)
    const now = new Date();
    let dateFilter: { gte?: Date; lte?: Date } = {};

    switch (dateRange) {
      case "last7":
        dateFilter = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
        break;
      case "last30":
        dateFilter = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
        break;
      case "last90":
        dateFilter = { gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) };
        break;
      case "thisYear":
        const yearStart = new Date(now.getFullYear(), 0, 1);
        dateFilter = { gte: yearStart };
        break;
      default:
        dateFilter = {};
    }

    // Fetch invoices
    const allInvoices = await prisma.invoice.findMany({
      select: {
        status: true,
        dueDate: true,
        amount: true,
        amountPaid: true,
        paidAt: true,
        createdAt: true,
      },
    });

    // Calculate financial metrics
    const paidInvoices = allInvoices.filter((inv) => inv.status === InvoiceStatus.PAID);
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);

    const paidOrPartialInvoices = allInvoices.filter(
      (inv) => inv.status === InvoiceStatus.PAID || inv.status === InvoiceStatus.PARTIALLY_PAID
    );
    const totalPaid = paidOrPartialInvoices.reduce(
      (sum, inv) => sum + Number(inv.amountPaid || 0),
      0
    );

    const overdueInvoices = allInvoices.filter(
      (inv) =>
        inv.status !== InvoiceStatus.PAID &&
        inv.status !== InvoiceStatus.VOID &&
        new Date(inv.dueDate) < now
    );
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

    const totalInvoiced = allInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const pendingAmount = totalInvoiced - totalPaid;
    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalInvoices: allInvoices.length,
        paidInvoices: paidInvoices.length,
        overdueInvoices: overdueInvoices.length,
      },
      metrics: {
        totalRevenue: Math.round(totalRevenue),
        totalInvoiced: Math.round(totalInvoiced),
        totalPaid: Math.round(totalPaid),
        pendingAmount: Math.round(pendingAmount),
        overdueAmount: Math.round(overdueAmount),
        collectionRate: Number(collectionRate.toFixed(1)),
      },
      debug: {
        paidInvoiceCount: paidInvoices.length,
        paidInvoiceSum: totalRevenue,
        partialInvoiceCount: paidOrPartialInvoices.length,
        partialInvoiceSum: totalPaid,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

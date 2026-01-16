import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeadStatus, DealStatus, InvoiceStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Fetch all data in parallel
    const [
      totalLeads,
      qualifiedLeads,
      totalDeals,
      wonDeals,
      wonDealsThisMonth,
      totalInvoices,
      allInvoices,
      allCustomers,
      newCustomersThisMonth,
      allDeals,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: LeadStatus.QUALIFIED } }),
      prisma.deal.count(),
      prisma.deal.count({ where: { status: DealStatus.WON } }),
      prisma.deal.count({
        where: {
          status: DealStatus.WON,
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.invoice.count(),
      prisma.invoice.findMany({
        select: {
          status: true,
          dueDate: true,
          amount: true,
          amountPaid: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      prisma.customer.count(),
      prisma.customer.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.deal.findMany({
        select: { value: true, status: true },
      }),
    ]);

    // Calculate financial metrics
    const today = new Date();
    const paidInvoices = allInvoices.filter((inv) => inv.status === InvoiceStatus.PAID);
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);

    const overdueInvoices = allInvoices.filter(
      (inv) =>
        inv.status !== InvoiceStatus.PAID &&
        inv.status !== InvoiceStatus.VOID &&
        new Date(inv.dueDate) < today
    );
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);

    const totalInvoiced = allInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + Number(inv.amountPaid || 0), 0);
    const pendingAmount = totalInvoiced - totalPaid;
    const collectionRate = totalInvoiced > 0 ? (totalPaid / totalInvoiced) * 100 : 0;

    // Calculate sales metrics
    const conversionRate = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0;
    const pipelineValue = allDeals
      .filter((deal) => deal.status !== DealStatus.WON && deal.status !== DealStatus.LOST)
      .reduce((sum, deal) => sum + Number(deal.value || 0), 0);
    const avgDealValue = wonDeals > 0 ? totalRevenue / wonDeals : 0;

    // Calculate customer metrics
    const avgCustomerValue = allCustomers > 0 ? totalRevenue / allCustomers : 0;

    // Month-over-month comparison for growth indicators
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const invoicesPaidLastMonth = allInvoices.filter(
      (inv) =>
        inv.status === InvoiceStatus.PAID &&
        inv.paidAt &&
        new Date(inv.paidAt) >= lastMonth &&
        new Date(inv.paidAt) < startOfMonth
    ).length;

    const invoicesPaidThisMonth = allInvoices.filter(
      (inv) =>
        inv.status === InvoiceStatus.PAID &&
        inv.paidAt &&
        new Date(inv.paidAt) >= startOfMonth
    ).length;

    const revenueGrowth =
      invoicesPaidLastMonth > 0
        ? (((invoicesPaidThisMonth - invoicesPaidLastMonth) / invoicesPaidLastMonth) * 100).toFixed(1)
        : "0";

    // Build comprehensive metrics response
    const metrics = {
      sales: {
        wonDealsThisMonth,
        totalDeals,
        wonDeals,
        totalLeads,
        qualifiedLeads,
        conversionRate: conversionRate.toFixed(1),
        pipelineValue: Math.round(pipelineValue),
        avgDealValue: Math.round(avgDealValue),
      },
      finance: {
        totalRevenue: Math.round(totalRevenue),
        totalInvoiced: Math.round(totalInvoiced),
        totalPaid: Math.round(totalPaid),
        pendingAmount: Math.round(pendingAmount),
        overdueAmount: Math.round(overdueAmount),
        collectionRate: collectionRate.toFixed(1),
        totalInvoices,
        overdueCount: overdueInvoices.length,
        revenueGrowth,
      },
      customers: {
        totalCustomers: allCustomers,
        newCustomersThisMonth,
        avgCustomerValue: Math.round(avgCustomerValue),
      },
      summary: {
        totalMetrics: totalLeads + totalDeals + totalInvoices + allCustomers,
        activeUsers: totalLeads,
      },
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[Dashboard Metrics Error]:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}

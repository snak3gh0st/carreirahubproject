import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Get total invoice count and statistics
    const totalInvoices = await prisma.invoice.count();

    // Count invoices with amountPaid > 0
    const invoicesWithPayment = await prisma.invoice.count({
      where: { amountPaid: { gt: 0 } }
    });

    // Get status distribution
    const statusDistribution = await prisma.invoice.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { amount: true, amountPaid: true }
    });

    // Get sample invoices
    const samples = await prisma.invoice.findMany({
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        amountPaid: true,
        status: true,
        paidAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Get aggregates
    const totals = await prisma.invoice.aggregate({
      _sum: { amount: true, amountPaid: true }
    });

    // Check invoices with paidAt
    const withPaidAt = await prisma.invoice.count({
      where: { paidAt: { not: null } }
    });

    return NextResponse.json({
      summary: {
        totalInvoices,
        invoicesWithPayment,
        invoicesWithPaidAt: withPaidAt,
        totalInvoicedAmount: totals._sum.amount || 0,
        totalPaidAmount: totals._sum.amountPaid || 0
      },
      statusDistribution,
      recentSamples: samples
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

import { prisma } from "@/lib/db";

async function debugData() {
  console.log("\n=== INVOICE DATA DEBUG ===\n");

  try {
    // Count invoices
    const totalInvoices = await prisma.invoice.count();
    console.log(`Total Invoices: ${totalInvoices}`);

    // Count invoices with amountPaid > 0
    const invoicesWithPayment = await prisma.invoice.count({
      where: { amountPaid: { gt: 0 } }
    });
    console.log(`Invoices with amountPaid > 0: ${invoicesWithPayment}`);

    // Sample 5 invoices
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
    console.log("\n5 Most Recent Invoices:");
    samples.forEach((inv, i) => {
      console.log(`  ${i+1}. #${inv.invoiceNumber} - Amount: $${inv.amount} | Paid: $${inv.amountPaid} | Status: ${inv.status}`);
    });

    // Aggregate sums
    const totals = await prisma.invoice.aggregate({
      _sum: { amount: true, amountPaid: true }
    });
    console.log(`\nTotal Invoiced (amount): $${totals._sum.amount || 0}`);
    console.log(`Total Paid (amountPaid): $${totals._sum.amountPaid || 0}`);

    // Status distribution
    const statuses = await prisma.invoice.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { amount: true, amountPaid: true }
    });
    console.log("\nInvoice Status Distribution:");
    statuses.forEach(s => {
      console.log(`  ${s.status}: ${s._count.id} invoices | Amount: $${s._sum.amount || 0} | Paid: $${s._sum.amountPaid || 0}`);
    });

    // Invoices with paidAt set
    const withPaidAt = await prisma.invoice.count({
      where: { paidAt: { not: null } }
    });
    console.log(`\nInvoices with paidAt date: ${withPaidAt}`);

    // Check if PAID invoices have amountPaid
    const paidInvoices = await prisma.invoice.findMany({
      where: { status: 'PAID' },
      select: { amount: true, amountPaid: true },
      take: 3
    });
    console.log("\nSample PAID invoices:");
    if (paidInvoices.length === 0) {
      console.log("  No PAID invoices found!");
    } else {
      paidInvoices.forEach((inv, i) => {
        console.log(`  ${i+1}. Amount: $${inv.amount} | Paid: $${inv.amountPaid}`);
      });
    }

  } catch (error) {
    console.error("Error:", error);
  }

  process.exit(0);
}

debugData();

/**
 * Quick script to check invoice sync status
 */

import { prisma } from "@/lib/db";

async function main() {
  // Count total invoices
  const totalInvoices = await prisma.invoice.count();

  // Count QuickBooks invoices
  const qbInvoices = await prisma.invoice.count({
    where: { quickbooks_invoice_id: { not: null } },
  });

  // Count by status
  const statusCounts = await prisma.invoice.groupBy({
    by: ["status"],
    _count: { id: true },
    where: { quickbooks_invoice_id: { not: null } },
  });

  console.log("\n📊 Invoice Sync Status:");
  console.log(`   Total Invoices in DB: ${totalInvoices}`);
  console.log(`   QuickBooks Invoices: ${qbInvoices}`);
  console.log(`   Non-QB Invoices: ${totalInvoices - qbInvoices}`);

  if (qbInvoices > 0) {
    console.log("\n   Status breakdown (QB invoices only):");
    statusCounts.forEach(s => {
      console.log(`     ${s.status}: ${s._count.id}`);
    });
  }

  // Get sample QB invoices
  if (qbInvoices > 0) {
    const samples = await prisma.invoice.findMany({
      where: { quickbooks_invoice_id: { not: null } },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true } } },
    });

    console.log("\n   Recent QB invoices:");
    samples.forEach(inv => {
      console.log(`     ${inv.invoiceNumber} - ${inv.customer.name} - $${inv.amount} - ${inv.status}`);
    });
  }

  console.log("\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

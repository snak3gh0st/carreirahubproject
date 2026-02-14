import { prisma } from "@/lib/db";

async function testForecast() {
  console.log("=== Testing Receivables Forecast Data ===\n");

  // Check open invoices
  const openInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
    },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      status: true,
      dueDate: true,
      createdAt: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
    take: 10,
  });

  console.log(`📊 Open Invoices: ${openInvoices.length}`);
  openInvoices.forEach((inv) => {
    console.log(
      `  - ${inv.invoiceNumber || inv.id.slice(0, 8)}: ${inv.customer.name} - $${inv.amount} (${inv.status})`
    );
  });

  // Check paid invoices for pattern analysis
  const paidInvoices = await prisma.invoice.findMany({
    where: {
      status: "PAID",
      paidAt: { not: null },
    },
    select: {
      id: true,
      amount: true,
      createdAt: true,
      paidAt: true,
      dueDate: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
    take: 10,
  });

  console.log(`\n💰 Paid Invoices (for pattern analysis): ${paidInvoices.length}`);
  paidInvoices.forEach((inv) => {
    if (inv.paidAt && inv.createdAt) {
      const daysToPayment = Math.floor(
        (new Date(inv.paidAt).getTime() - new Date(inv.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      console.log(
        `  - ${inv.customer.name}: Paid in ${daysToPayment} days ($${inv.amount})`
      );
    }
  });

  // Count total invoices by status
  const invoicesByStatus = await prisma.invoice.groupBy({
    by: ["status"],
    _count: { id: true },
    _sum: { amount: true },
  });

  console.log("\n📈 Invoices by Status:");
  invoicesByStatus.forEach((status) => {
    console.log(
      `  - ${status.status}: ${status._count.id} invoices, $${status._sum.amount || 0}`
    );
  });

  // Check if we have Payment data
  const paymentCount = await prisma.payment.count();
  console.log(`\n💳 Payments in database: ${paymentCount}`);

  await prisma.$disconnect();
}

testForecast().catch(console.error);

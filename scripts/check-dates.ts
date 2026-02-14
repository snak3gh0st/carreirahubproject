import { prisma } from "@/lib/db";

async function checkDates() {
  console.log("=== Checking Date Logic ===\n");

  // Get a few paid invoices with actual dates
  const paidInvoices = await prisma.invoice.findMany({
    where: {
      status: "PAID",
      paidAt: { not: null },
    },
    select: {
      invoiceNumber: true,
      amount: true,
      createdAt: true,
      paidAt: true,
      dueDate: true,
      customer: {
        select: { name: true },
      },
    },
    take: 5,
    orderBy: { paidAt: "desc" },
  });

  console.log("Recent Paid Invoices:\n");
  paidInvoices.forEach((inv) => {
    console.log(`Invoice: ${inv.invoiceNumber}`);
    console.log(`  Customer: ${inv.customer.name}`);
    console.log(`  Amount: $${inv.amount}`);
    console.log(`  Created: ${inv.createdAt}`);
    console.log(`  Due: ${inv.dueDate}`);
    console.log(`  Paid: ${inv.paidAt}`);

    if (inv.paidAt && inv.createdAt) {
      const createdTime = new Date(inv.createdAt).getTime();
      const paidTime = new Date(inv.paidAt).getTime();
      const daysToPayment = Math.floor(
        (paidTime - createdTime) / (1000 * 60 * 60 * 24)
      );
      console.log(`  Days to Payment: ${daysToPayment}`);

      if (daysToPayment < 0) {
        console.log(`  ⚠️  WARNING: Paid BEFORE created! Data issue.`);
      }
    }
    console.log("");
  });

  // Check open invoices
  console.log("\n=== Open Invoices for Forecast ===\n");
  const openInvoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
    },
    select: {
      invoiceNumber: true,
      amount: true,
      status: true,
      dueDate: true,
      createdAt: true,
      customer: {
        select: { name: true },
      },
    },
    take: 5,
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();
  openInvoices.forEach((inv) => {
    const daysOverdue = Math.floor(
      (now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    console.log(`Invoice: ${inv.invoiceNumber}`);
    console.log(`  Customer: ${inv.customer.name}`);
    console.log(`  Amount: $${inv.amount}`);
    console.log(`  Status: ${inv.status}`);
    console.log(`  Due: ${inv.dueDate}`);
    console.log(
      `  Days Overdue: ${daysOverdue > 0 ? daysOverdue : "Not overdue yet"}`
    );
    console.log("");
  });

  await prisma.$disconnect();
}

checkDates().catch(console.error);

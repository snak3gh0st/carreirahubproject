import { prisma } from "@/lib/db";

async function checkData() {
  try {
    const invoiceCount = await prisma.invoice.count();
    const invoiceWithAmount = await prisma.invoice.findMany({
      where: { amount: { gt: 0 } },
      select: { id: true, amount: true, amountPaid: true, status: true, paidAt: true },
      take: 5,
    });
    
    const paymentCount = await prisma.payment.count();
    const totalInvoiced = await prisma.invoice.aggregate({
      _sum: { amount: true },
    });
    
    const totalAmountPaid = await prisma.invoice.aggregate({
      _sum: { amountPaid: true },
    });

    console.log("=== Database Data Check ===");
    console.log(`Total Invoices: ${invoiceCount}`);
    console.log(`Sample Invoices with amounts:`, JSON.stringify(invoiceWithAmount, null, 2));
    console.log(`Total Invoiced: $${totalInvoiced._sum.amount || 0}`);
    console.log(`Total AmountPaid in Invoices: $${totalAmountPaid._sum.amountPaid || 0}`);
    console.log(`\nPayment Table Records: ${paymentCount}`);
    
    if (paymentCount === 0) {
      console.log("\n⚠️  Payment table is EMPTY - need to populate from invoice data");
    }
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

checkData();

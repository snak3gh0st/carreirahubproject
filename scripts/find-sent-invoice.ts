import { prisma } from "@/lib/db";

async function main() {
  const invoices = await prisma.invoice.findMany({
    where: { status: "SENT" },
    include: { customer: true, contract: true },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  if (invoices.length === 0) {
    console.log("No SENT invoices found.");
    console.log("Checking any invoice...");
    const any = await prisma.invoice.findMany({
      include: { customer: true },
      take: 3,
      orderBy: { createdAt: "desc" },
    });
    any.forEach((inv) => {
      console.log(`ID: ${inv.id} | Status: ${inv.status} | QB Customer: ${inv.customer.quickbooks_id} | Amount: $${inv.amount}`);
    });
    return;
  }

  invoices.forEach((inv) => {
    console.log("---");
    console.log(`Invoice ID : ${inv.id}`);
    console.log(`Number     : ${inv.invoiceNumber}`);
    console.log(`Amount     : $${inv.amount}`);
    console.log(`Status     : ${inv.status}`);
    console.log(`Customer   : ${inv.customer.name}`);
    console.log(`QB Cust ID : ${inv.customer.quickbooks_id || "NONE"}`);
    console.log(`Contract   : ${inv.contract?.status || "none"}`);
    console.log(`URL        : http://localhost:3001/payment-v2/${inv.id}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

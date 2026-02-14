const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const invoiceId = "b87e52fe-53c1-44b7-bb8f-8be0c71a4f5a";

  console.log("Checking invoice...");

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true, deal: true }
  });

  console.log(JSON.stringify(invoice, null, 2));

  console.log("\n\nChecking logs...");

  const logs = await prisma.integrationLog.findMany({
    where: {
      action: {
        in: ['invoice_email_sent', 'invoice_needs_manual_send', 'DEAL_SYNC_FAILED', 'invoice_created_and_sent']
      }
    },
    orderBy: { timestamp: 'desc' },
    take: 10
  });

  console.log(JSON.stringify(logs, null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

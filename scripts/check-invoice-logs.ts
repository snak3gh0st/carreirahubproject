import { prisma } from "../lib/db";

async function checkInvoiceLogs() {
  const invoiceId = "b87e52fe-53c1-44b7-bb8f-8be0c71a4f5a";

  console.log(`\n=== Checking Invoice ${invoiceId} ===\n`);

  // Check invoice details
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      deal: true
    }
  });

  if (!invoice) {
    console.log("Invoice not found!");
    return;
  }

  console.log("Invoice Details:");
  console.log("- Number:", invoice.invoiceNumber);
  console.log("- Amount:", invoice.amount);
  console.log("- Status:", invoice.status);
  console.log("- QB Invoice ID:", invoice.quickbooks_invoice_id);
  console.log("- Email Sent At:", invoice.emailSentAt);
  console.log("- Email Send Attempts:", invoice.emailSendAttempts);
  console.log("- Last Email Error:", invoice.lastEmailSendError);
  console.log("- Customer Email:", invoice.customer?.email);
  console.log("- Customer Pipedrive ID:", invoice.customer?.pipedrive_id);
  console.log("- Deal ID:", invoice.dealId);
  console.log("- Deal Pipedrive ID:", invoice.deal?.pipedrive_deal_id);

  // Check integration logs for this invoice
  const logs = await prisma.integrationLog.findMany({
    where: {
      OR: [
        { payload: { path: ['invoiceId'], equals: invoiceId } },
        { payload: { path: ['qbInvoiceId'], equals: invoice.quickbooks_invoice_id } },
      ]
    },
    orderBy: { timestamp: 'desc' },
    take: 20
  });

  console.log(`\n=== Integration Logs (${logs.length} entries) ===\n`);

  for (const log of logs) {
    console.log(`[${log.timestamp.toISOString()}] ${log.service} - ${log.action}`);
    console.log(`  Status: ${log.status}`);
    if (log.error) {
      console.log(`  Error: ${log.error}`);
    }
    console.log(`  Payload:`, JSON.stringify(log.payload, null, 2));
    console.log("");
  }

  await prisma.$disconnect();
}

checkInvoiceLogs().catch(console.error);

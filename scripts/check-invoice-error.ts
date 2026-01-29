#!/usr/bin/env tsx
import { prisma } from "@/lib/db";

async function main() {
  const log = await prisma.integrationLog.findFirst({
    where: {
      service: "quickbooks",
      action: "/invoice",
      status: "ERROR",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!log) {
    console.log("✅ No invoice creation errors found");
    return;
  }

  console.log("Most recent invoice creation error:");
  console.log("===================================\n");
  console.log(`Time: ${log.createdAt.toISOString()}`);
  console.log(`Error: ${log.error}`);
  console.log(`Error Code: ${log.errorCode || "N/A"}`);
  console.log(`Category: ${log.errorCategory || "N/A"}`);
  console.log(`\nRequest Payload:`);
  console.log(JSON.stringify(log.payload, null, 2));
  console.log(`\nNote: Without the actual request body, this error might be from a malformed request.`);
  console.log(`If this is a recurring issue, check the code that calls createInvoice() or createInvoiceWithBillEmail().`);
  
  await prisma.$disconnect();
}

main().catch(console.error);

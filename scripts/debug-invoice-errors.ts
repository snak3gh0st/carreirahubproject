#!/usr/bin/env tsx
import { prisma } from "@/lib/db";

async function main() {
  // Check for invoice-specific errors
  const invoiceErrors = await prisma.integrationLog.findMany({
    where: {
      service: "quickbooks",
      action: { contains: "invoice" },
      status: "ERROR",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log(`\n=== INVOICE CREATION ERRORS ===`);
  console.log(`Found ${invoiceErrors.length} invoice-related errors:\n`);
  
  for (const log of invoiceErrors) {
    console.log("=".repeat(80));
    console.log(`Time: ${log.createdAt.toISOString()}`);
    console.log(`Action: ${log.action}`);
    console.log(`Error: ${log.error}`);
    console.log(`Error Code: ${log.errorCode || "N/A"}`);
    console.log(`Category: ${log.errorCategory || "N/A"}`);
    console.log(`\nPayload:`);
    console.log(JSON.stringify(log.payload, null, 2));
    console.log();
  }

  // Also check recent successful invoice creations for comparison
  const recentSuccess = await prisma.integrationLog.findMany({
    where: {
      service: "quickbooks",
      action: { contains: "invoice" },
      status: "SUCCESS",
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  console.log(`\n=== RECENT SUCCESSFUL INVOICES (for comparison) ===`);
  console.log(`Found ${recentSuccess.length} recent successful invoice operations:\n`);
  
  for (const log of recentSuccess) {
    console.log(`Time: ${log.createdAt.toISOString()}`);
    console.log(`Action: ${log.action}`);
    console.log(`Payload keys: ${Object.keys(log.payload || {}).join(', ')}`);
    console.log();
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);

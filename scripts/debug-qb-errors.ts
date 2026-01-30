#!/usr/bin/env tsx
import { prisma } from "@/lib/db";

async function main() {
  const logs = await prisma.integrationLog.findMany({
    where: {
      service: "quickbooks",
      status: "ERROR",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  console.log(`\nFound ${logs.length} recent QuickBooks errors:\n`);
  
  for (const log of logs) {
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
  
  await prisma.$disconnect();
}

main().catch(console.error);

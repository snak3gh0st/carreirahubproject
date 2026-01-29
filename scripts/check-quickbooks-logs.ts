#!/usr/bin/env tsx
import { prisma } from "@/lib/db";

async function main() {
  const logs = await prisma.integrationLog.findMany({
    where: {
      service: "quickbooks",
      status: "ERROR",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  console.log("Recent QuickBooks errors:");
  console.log("========================\n");
  
  if (logs.length === 0) {
    console.log("✅ No recent errors found.");
  } else {
    logs.forEach((log, i) => {
      console.log(`${i + 1}. ${log.action}`);
      console.log(`   Status: ${log.status}`);
      console.log(`   Error: ${log.error}`);
      console.log(`   Error Code: ${log.errorCode || "N/A"}`);
      console.log(`   Category: ${log.errorCategory || "N/A"}`);
      console.log(`   Time: ${log.createdAt.toISOString()}`);
      const payloadStr = JSON.stringify(log.payload, null, 2);
      console.log(`   Payload: ${payloadStr.length > 500 ? payloadStr.substring(0, 500) + "..." : payloadStr}`);
      console.log("");
    });
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);

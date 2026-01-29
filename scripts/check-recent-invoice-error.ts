#!/usr/bin/env tsx
import { prisma } from "@/lib/db";

async function main() {
  const log = await prisma.integrationLog.findFirst({
    where: {
      service: "quickbooks",
      action: "/invoice",
      status: "ERROR",
      createdAt: {
        gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
      }
    },
    orderBy: { createdAt: "desc" },
  });

  if (!log) {
    console.log("✅ No recent invoice errors (last 10 minutes)");
    return;
  }

  console.log("❌ Recent invoice error detected!");
  console.log("================================\n");
  console.log("Time:", log.createdAt.toISOString());
  console.log("\n📦 Payload:");
  console.log(JSON.stringify(log.payload, null, 2));
  console.log("\n❌ Error:");
  console.log(log.error);
  
  if (log.metadata) {
    console.log("\n🔍 Metadata:");
    console.log(JSON.stringify(log.metadata, null, 2));
  }
  
  console.log("\n💡 Note: The payload doesn't contain the request body.");
  console.log("To see the actual invoice data being sent, check the server logs.");
  
  await prisma.$disconnect();
}

main().catch(console.error);

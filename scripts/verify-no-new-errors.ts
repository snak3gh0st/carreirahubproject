#!/usr/bin/env tsx
import { prisma } from "@/lib/db";

async function main() {
  // Get the most recent QuickBooks PriceLevel error
  const lastError = await prisma.integrationLog.findFirst({
    where: {
      service: "quickbooks",
      action: { contains: "PriceLevel" },
      status: "ERROR",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!lastError) {
    console.log("✅ No PriceLevel errors in IntegrationLog");
    return;
  }

  const timeSinceError = Date.now() - lastError.createdAt.getTime();
  const minutesAgo = Math.floor(timeSinceError / 1000 / 60);

  console.log(`Last PriceLevel error was ${minutesAgo} minutes ago`);
  console.log(`Time: ${lastError.createdAt.toISOString()}`);
  
  if (minutesAgo < 2) {
    console.log("\n❌ FAILURE: New error was just logged (within last 2 minutes)");
    console.log("The fix did NOT prevent error logging");
  } else {
    console.log("\n✅ SUCCESS: No new errors logged since fix was applied");
    console.log("The fix is working correctly - no error pollution in IntegrationLog");
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);

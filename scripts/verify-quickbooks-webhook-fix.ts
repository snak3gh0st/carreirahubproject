/**
 * Verify QuickBooks Webhook Event ID Extraction Fix
 *
 * This script checks IntegrationLog entries to verify that:
 * 1. WEBHOOK_ACCEPT_ERROR with "Failed to extract event ID" has stopped
 * 2. WEBHOOK_ACCEPTED for QuickBooks service is working
 */

import { prisma } from "../lib/db";

async function verifyWebhookFix() {
  console.log("=== QuickBooks Webhook Fix Verification ===\n");

  // Check for recent WEBHOOK_ACCEPT_ERROR entries
  const recentErrors = await prisma.integrationLog.findMany({
    where: {
      service: "QUICKBOOKS",
      action: "WEBHOOK_ACCEPT_ERROR",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      status: true,
      error: true,
      createdAt: true,
      payload: true,
    },
  });

  console.log(`Recent WEBHOOK_ACCEPT_ERROR entries: ${recentErrors.length}`);
  if (recentErrors.length > 0) {
    console.log("\nLast 5 errors:");
    recentErrors.slice(0, 5).forEach((log) => {
      console.log(`  - ${log.createdAt.toISOString()}: ${log.error}`);
    });
  }

  // Check for event ID extraction failures
  const extractionFailures = recentErrors.filter((log) =>
    log.error?.includes("Failed to extract event ID")
  );

  console.log(
    `\nErrors with "Failed to extract event ID": ${extractionFailures.length}`
  );
  if (extractionFailures.length > 0) {
    console.log("⚠️  WARNING: Event ID extraction still failing!");
    extractionFailures.forEach((log) => {
      console.log(`  - ${log.createdAt.toISOString()}: ${log.error}`);
    });
  } else {
    console.log("✅ No event ID extraction failures found");
  }

  // Check for recent WEBHOOK_ACCEPTED entries
  const recentAccepted = await prisma.integrationLog.findMany({
    where: {
      service: "QUICKBOOKS",
      action: "WEBHOOK_ACCEPTED",
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      status: true,
      createdAt: true,
      payload: true,
    },
  });

  console.log(`\nRecent WEBHOOK_ACCEPTED entries: ${recentAccepted.length}`);
  if (recentAccepted.length > 0) {
    console.log("✅ Webhooks are being accepted successfully");
    console.log("\nLast 5 accepted:");
    recentAccepted.slice(0, 5).forEach((log) => {
      const payload = log.payload as any;
      console.log(
        `  - ${log.createdAt.toISOString()}: ${payload?.eventType} (ID: ${payload?.eventId})`
      );
    });
  } else {
    console.log("⚠️  WARNING: No recent WEBHOOK_ACCEPTED entries found");
    console.log(
      "   This could mean no webhooks have been received, or they are all failing"
    );
  }

  // Overall status
  console.log("\n=== Summary ===");
  if (extractionFailures.length === 0 && recentAccepted.length > 0) {
    console.log("✅ QuickBooks webhook fix is working correctly!");
    console.log("   - Event ID extraction: OK");
    console.log("   - Webhook acceptance: OK");
  } else if (extractionFailures.length === 0 && recentAccepted.length === 0) {
    console.log("⚠️  Fix appears to be working, but no recent webhooks received");
    console.log("   - Event ID extraction errors: NONE");
    console.log("   - Recent webhook activity: NONE");
    console.log(
      "   - This is expected if QuickBooks hasn't sent any webhooks recently"
    );
  } else {
    console.log("❌ QuickBooks webhook fix needs attention!");
    console.log(`   - Event ID extraction failures: ${extractionFailures.length}`);
    console.log(`   - Successful acceptances: ${recentAccepted.length}`);
  }

  await prisma.$disconnect();
}

verifyWebhookFix().catch((error) => {
  console.error("Error running verification:", error);
  process.exit(1);
});

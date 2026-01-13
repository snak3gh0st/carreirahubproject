import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateQuickBooksVerifierToken() {
  try {
    console.log("Updating QuickBooks webhook verifier token...");

    const result = await prisma.systemConfig.upsert({
      where: { id: "system" },
      update: {
        quickbooks_webhook_secret: "d424c8c4-cb91-4cb3-8ce5-91aa31250510",
        updatedAt: new Date(),
      },
      create: {
        id: "system",
        quickbooks_webhook_secret: "d424c8c4-cb91-4cb3-8ce5-91aa31250510",
      },
    });

    console.log("✅ QuickBooks verifier token updated successfully");
    console.log("   Token:", result.quickbooks_webhook_secret);
    console.log("   Updated at:", result.updatedAt);

    // Verify webhook configuration is ready
    if (result.quickbooks_is_authenticated) {
      console.log("✅ QuickBooks OAuth: Authenticated");
    } else {
      console.log("⚠️  QuickBooks OAuth: Not authenticated (run OAuth flow first)");
    }

    if (result.quickbooks_webhook_secret) {
      console.log("✅ QuickBooks webhook secret: Configured");
    }

    console.log("\nWebhook endpoint ready at:");
    console.log("https://carreirausa.sigmaintel.io/api/webhooks/quickbooks");
  } catch (error) {
    console.error("❌ Error updating verifier token:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateQuickBooksVerifierToken();

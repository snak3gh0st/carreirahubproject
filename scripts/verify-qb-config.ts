import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifyQuickBooksConfig() {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: "system" } });

    if (!config) {
      console.log("❌ SystemConfig record not found");
      process.exit(1);
    }

    console.log("✅ SystemConfig found:");
    console.log("   ID:", config.id);
    console.log("   QB Webhook Secret:", config.quickbooks_webhook_secret ? "✅ Present" : "❌ Missing");
    console.log("   QB Is Authenticated:", config.quickbooks_is_authenticated);
    console.log("   QB Company ID:", config.quickbooks_company_id || "(not set)");
    console.log("   QB Access Token:", config.quickbooks_access_token ? "✅ Present" : "❌ Missing");
    console.log("   QB Refresh Token:", config.quickbooks_refresh_token ? "✅ Present" : "❌ Missing");

    if (config.quickbooks_webhook_secret === "d424c8c4-cb91-4cb3-8ce5-91aa31250510") {
      console.log("✅ Webhook secret matches expected value from update-qb-verifier.ts");
    }

    // Check all required fields for Phase 1.1 validation
    const ready = config.quickbooks_webhook_secret &&
                  config.quickbooks_is_authenticated &&
                  config.quickbooks_access_token &&
                  config.quickbooks_refresh_token &&
                  config.quickbooks_company_id;

    if (ready) {
      console.log("\n✅ QuickBooks integration fully configured");
    } else {
      console.log("\n⚠️  Some QuickBooks configuration fields are missing");
    }

  } catch (error: any) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyQuickBooksConfig();

/**
 * DocuSign Integration Test Script
 * 
 * Tests DocuSign JWT authentication and envelope creation
 * Run with: npx tsx scripts/test-docusign.ts
 */

import { docusignService } from "@/lib/services/docusign.service";
import { prisma } from "@/lib/db";

async function testDocuSignIntegration() {
  console.log("🔍 DocuSign Integration Test\n");
  console.log("=" .repeat(60));

  // Check environment variables
  console.log("\n📋 Step 1: Checking Environment Variables...");
  const requiredVars = [
    "DOCUSIGN_INTEGRATION_KEY",
    "DOCUSIGN_USER_ID",
    "DOCUSIGN_ACCOUNT_ID",
    "DOCUSIGN_PRIVATE_KEY",
    "DOCUSIGN_BASE_URL",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables:");
    missingVars.forEach((varName) => console.error(`   - ${varName}`));
    process.exit(1);
  }

  console.log("✅ All required environment variables are set");
  console.log(`   - Integration Key: ${process.env.DOCUSIGN_INTEGRATION_KEY?.substring(0, 8)}...`);
  console.log(`   - User ID: ${process.env.DOCUSIGN_USER_ID}`);
  console.log(`   - Account ID: ${process.env.DOCUSIGN_ACCOUNT_ID}`);
  console.log(`   - Base URL: ${process.env.DOCUSIGN_BASE_URL}`);
  console.log(`   - Private Key: ${process.env.DOCUSIGN_PRIVATE_KEY?.substring(0, 30)}...`);

  // Test JWT Authentication
  console.log("\n🔐 Step 2: Testing JWT Authentication...");
  try {
    const token = await docusignService.authenticateWithJWT();
    console.log("✅ JWT authentication successful!");
    console.log(`   - Access Token: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.error("❌ JWT authentication failed:");
    console.error(`   - ${error instanceof Error ? error.message : String(error)}`);
    console.error("\n💡 Common issues:");
    console.error("   - Private key format is incorrect (needs \\n for newlines)");
    console.error("   - Integration Key doesn't match the private key");
    console.error("   - User ID or Account ID is incorrect");
    console.error("   - Consent not granted (visit the consent URL in app settings)");
    process.exit(1);
  }

  // Test envelope creation with mock data
  console.log("\n📄 Step 3: Testing Envelope Creation...");
  try {
    // Create test customer
    const testCustomer = {
      id: "test-customer-id",
      name: "Test Customer",
      email: "test@example.com",
      phone: "+1234567890",
    };

    // Create test invoice
    const testInvoice = {
      id: "test-invoice-id",
      invoiceNumber: "INV-TEST-001",
      amount: 1000.00,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      deal: {
        title: "Test Service Package",
      },
    };

    console.log("   Creating test envelope...");
    const envelopeId = await docusignService.createEnvelopeFromInvoice(
      testInvoice,
      testCustomer
    );

    console.log("✅ Envelope created successfully!");
    console.log(`   - Envelope ID: ${envelopeId}`);
    console.log(`   - Recipient: ${testCustomer.email}`);
    console.log(`   - Amount: $${testInvoice.amount}`);

    // Get envelope status
    console.log("\n📊 Step 4: Checking Envelope Status...");
    const status = await docusignService.getEnvelopeStatus(envelopeId);
    console.log("✅ Envelope status retrieved!");
    console.log(`   - Status: ${status.status}`);
    console.log(`   - Status Date: ${status.statusDateTime}`);

    // Note: In sandbox/demo, the envelope is sent to test@example.com
    // In production, use real customer emails
    console.log("\n⚠️  Note: This is a test envelope sent to test@example.com");
    console.log("   In production, replace with real customer data.");

  } catch (error) {
    console.error("❌ Envelope creation/status check failed:");
    console.error(`   - ${error instanceof Error ? error.message : String(error)}`);
    console.error("\n💡 Common issues:");
    console.error("   - API permissions not granted");
    console.error("   - Account not active");
    console.error("   - Base URL is incorrect (demo vs production)");
    process.exit(1);
  }

  // Test contact sync (optional)
  console.log("\n👤 Step 5: Testing Contact Sync...");
  try {
    const contactId = await docusignService.createOrUpdateContact({
      email: "test@example.com",
      name: "Test Customer",
      phone: "+1234567890",
    });
    
    console.log("✅ Contact sync successful!");
    console.log(`   - Contact ID: ${contactId}`);
  } catch (error) {
    console.warn("⚠️  Contact sync skipped (optional feature)");
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ DocuSign Integration Test Complete!\n");
  console.log("Your DocuSign integration is configured correctly and ready to use.");
  console.log("\nNext steps:");
  console.log("1. If using sandbox: Test with demo data");
  console.log("2. If using production: Envelopes will be sent to real customers");
  console.log("3. Update webhooks to handle DocuSign events");
  console.log("\n" + "=".repeat(60));
}

// Run the test
testDocuSignIntegration()
  .catch((error) => {
    console.error("\n❌ Test failed with unexpected error:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

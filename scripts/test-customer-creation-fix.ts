#!/usr/bin/env tsx
/**
 * Test script to verify QB customer creation fix
 * Tests customer creation with empty address fields (the failing scenario)
 */
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

async function main() {
  console.log("🧪 Testing QuickBooks Customer Creation Fix...\n");
  console.log("=" .repeat(60));
  
  // Initialize QuickBooks service
  await quickbooksService.initialize();
  
  const authStatus = await quickbooksService.getAuthStatus();
  if (!authStatus.isAuthenticated) {
    console.error("❌ QuickBooks not authenticated. Please authenticate first.");
    process.exit(1);
  }
  
  console.log("✓ QuickBooks authenticated");
  console.log(`  Company ID: ${authStatus.companyId}\n`);
  
  // Test 1: Customer with NO address data (the failing case)
  console.log("📝 Test 1: Customer with empty address fields");
  console.log("-".repeat(60));
  
  const testCustomerData = {
    email: `test-${Date.now()}@carreira-debug.test`,
    name: "Debug Test Customer (No Address)",
    phone: "+1-555-0100",
  };
  
  console.log("Test customer data:");
  console.log(JSON.stringify(testCustomerData, null, 2));
  console.log();
  
  try {
    console.log("Creating customer in QuickBooks...");
    const customer = await quickbooksService.getOrCreateCustomer(testCustomerData);
    
    console.log("✅ SUCCESS - Customer created!");
    console.log(`  QB Customer ID: ${customer.Id}`);
    console.log(`  Display Name: ${customer.DisplayName}`);
    console.log(`  Email: ${customer.PrimaryEmailAddr?.Address}`);
    console.log(`  BillAddr.Line1: ${customer.BillAddr?.Line1}`);
    console.log(`  BillAddr.City: ${customer.BillAddr?.City}`);
    console.log(`  BillAddr.Country: ${customer.BillAddr?.Country}`);
    console.log();
    
    // Verify BillAddr structure
    if (customer.BillAddr?.City === "USA") {
      console.error("❌ FAIL - BillAddr.City still set to 'USA' (should be 'Not Provided')");
      process.exit(1);
    }
    
    if (customer.BillAddr?.City === "Not Provided" && customer.BillAddr?.Line1 === "Not Provided") {
      console.log("✅ VERIFIED - BillAddr fallback structure is valid");
    }
    
    // Check integration logs for errors
    console.log("\n📊 Checking integration logs...");
    const recentError = await prisma.integrationLog.findFirst({
      where: {
        service: "quickbooks",
        action: "/customer",
        status: "ERROR",
        createdAt: {
          gte: new Date(Date.now() - 60000), // Last 60 seconds
        },
      },
      orderBy: { createdAt: "desc" },
    });
    
    if (recentError) {
      console.error("❌ FAIL - Customer creation logged an error:");
      console.error(JSON.stringify(recentError, null, 2));
      process.exit(1);
    } else {
      console.log("✅ VERIFIED - No errors in integration logs");
    }
    
    console.log("\n" + "=".repeat(60));
    console.log("🎉 ALL TESTS PASSED!");
    console.log("=" .repeat(60));
    console.log("\n✓ Fix verified: Customer creation with empty address works");
    console.log("✓ BillAddr.City uses valid placeholder instead of 'USA'");
    console.log("✓ No 400 Bad Request errors from QuickBooks\n");
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ TEST FAILED");
    console.error("=" .repeat(60));
    console.error("Error:", error.message);
    
    if (error.responseText) {
      console.error("\nQuickBooks API Response:");
      try {
        const parsed = JSON.parse(error.responseText);
        console.error(JSON.stringify(parsed, null, 2));
      } catch {
        console.error(error.responseText);
      }
    }
    
    console.error("\nStack:", error.stack);
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});

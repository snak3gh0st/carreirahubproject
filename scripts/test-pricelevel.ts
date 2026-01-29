#!/usr/bin/env tsx
import { quickbooksService } from "@/lib/services/quickbooks.service";

async function testPriceLevel() {
  console.log("Testing PriceLevel query that's been failing...\n");
  
  try {
    await quickbooksService.initialize();
    
    console.log("1. Testing getPriceLevels()...");
    const result = await quickbooksService.getPriceLevels();
    console.log("✅ PriceLevel query succeeded");
    console.log(`Found ${result.length} price levels`);
    
    if (result.length > 0) {
      console.log("\nFirst price level:");
      console.log(JSON.stringify(result[0], null, 2));
    }
  } catch (error: any) {
    console.log("❌ PriceLevel query failed");
    console.log(`Error: ${error.message}`);
    console.log(`Status: ${error.status}`);
    console.log(`Response Text: ${error.responseText || "N/A"}`);
    
    // Parse the response text to see the actual QuickBooks error
    if (error.responseText) {
      try {
        const parsed = JSON.parse(error.responseText);
        console.log("\nQuickBooks Error Details:");
        console.log(JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log("\nRaw Response:");
        console.log(error.responseText);
      }
    }
  }
}

testPriceLevel().catch(console.error);

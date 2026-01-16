/**
 * Script to sync ALL QuickBooks invoices to the local database
 * This will fetch all 5,408+ invoices and sync them
 *
 * Usage: npx tsx scripts/sync-all-quickbooks-invoices.ts
 */

import { quickbooksSyncService } from "@/lib/services/quickbooks-sync.service";

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("QuickBooks Full Sync - All Invoices");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const startTime = Date.now();

  try {
    console.log("Starting full synchronization...\n");
    console.log("This will sync:");
    console.log("  ✓ All Customers");
    console.log("  ✓ All Invoices (5,408 expected)");
    console.log("  ✓ Company Info\n");

    const result = await quickbooksSyncService.sync({
      syncCustomers: true,
      syncInvoices: true,
      syncPayments: false, // Skip for now to speed up
      syncItems: false,    // Skip for now to speed up
      maxResults: 10000,   // High limit to get all invoices
      incremental: false,  // Full sync
    });

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 Sync Results");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    if (result.customers) {
      console.log("👥 Customers:");
      console.log(`   Total fetched: ${result.customers.total}`);
      console.log(`   New synced: ${result.customers.synced}`);
      console.log(`   Updated: ${result.customers.updated}`);
      console.log(`   Errors: ${result.customers.errors}`);

      if (result.customers.errorDetails && result.customers.errorDetails.length > 0) {
        console.log(`\n   Error details (first 5):`);
        result.customers.errorDetails.slice(0, 5).forEach(err => {
          console.log(`     - ${err.email}: ${err.error}`);
        });
      }
    }

    if (result.invoices) {
      console.log("\n📄 Invoices:");
      console.log(`   Total fetched: ${result.invoices.total}`);
      console.log(`   New synced: ${result.invoices.synced}`);
      console.log(`   Updated: ${result.invoices.updated}`);
      console.log(`   Errors: ${result.invoices.errors}`);

      if (result.invoices.errorDetails && result.invoices.errorDetails.length > 0) {
        console.log(`\n   Error details (first 5):`);
        result.invoices.errorDetails.slice(0, 5).forEach(err => {
          console.log(`     - Invoice ${err.invoiceId}: ${err.error}`);
        });
      }
    }

    if (result.companyInfo) {
      console.log("\n🏢 Company Info:");
      console.log(`   Name: ${result.companyInfo.companyName}`);
      console.log(`   Legal Name: ${result.companyInfo.legalName}`);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`⏱️  Total Duration: ${durationSec}s`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("✅ Sync completed successfully!");
    console.log("\nYou can now view the invoices at:");
    console.log("http://localhost:3001/dashboard/invoices\n");

  } catch (error: any) {
    console.error("\n❌ Sync failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error);
    process.exit(1);
  });

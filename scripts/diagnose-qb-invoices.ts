/**
 * Diagnostic Script: QuickBooks Invoice Pagination
 *
 * This script tests the actual QuickBooks API responses to diagnose
 * why only 14 invoices are being fetched.
 *
 * Run with: npx ts-node scripts/diagnose-qb-invoices.ts
 */

import { quickbooksService } from "@/lib/services/quickbooks.service";

async function diagnoseInvoicePagination() {
  console.log("=".repeat(80));
  console.log("QuickBooks Invoice Pagination Diagnostics");
  console.log("=".repeat(80));
  console.log();

  try {
    // Initialize QuickBooks service (loads tokens from database)
    await quickbooksService.initialize();

    console.log("✅ QuickBooks service initialized");
    console.log();

    // Test 1: Simple query without pagination
    console.log("TEST 1: Simple query (no pagination parameters)");
    console.log("-".repeat(80));

    const simpleResult = await (quickbooksService as any).request(
      `/query?query=${encodeURIComponent("SELECT * FROM Invoice")}`
    );

    console.log("Response structure:");
    console.log("- QueryResponse keys:", Object.keys(simpleResult.QueryResponse || {}));
    console.log("- Invoice count:", simpleResult.QueryResponse?.Invoice?.length || 0);
    console.log("- maxResults in response:", simpleResult.QueryResponse?.maxResults);
    console.log("- startPosition in response:", simpleResult.QueryResponse?.startPosition);
    console.log();

    // Test 2: Query with MAXRESULTS 1000
    console.log("TEST 2: Query with MAXRESULTS 1000");
    console.log("-".repeat(80));

    const maxResultsQuery = "SELECT * FROM Invoice MAXRESULTS 1000";
    const maxResultsResult = await (quickbooksService as any).request(
      `/query?query=${encodeURIComponent(maxResultsQuery)}`
    );

    console.log("Query:", maxResultsQuery);
    console.log("Invoice count:", maxResultsResult.QueryResponse?.Invoice?.length || 0);
    console.log("maxResults in response:", maxResultsResult.QueryResponse?.maxResults);
    console.log("startPosition in response:", maxResultsResult.QueryResponse?.startPosition);
    console.log();

    // Test 3: Query with STARTPOSITION 1 MAXRESULTS 1000
    console.log("TEST 3: Query with STARTPOSITION 1 MAXRESULTS 1000");
    console.log("-".repeat(80));

    const paginatedQuery = "SELECT * FROM Invoice STARTPOSITION 1 MAXRESULTS 1000";
    const paginatedResult = await (quickbooksService as any).request(
      `/query?query=${encodeURIComponent(paginatedQuery)}`
    );

    console.log("Query:", paginatedQuery);
    console.log("Invoice count:", paginatedResult.QueryResponse?.Invoice?.length || 0);
    console.log("maxResults in response:", paginatedResult.QueryResponse?.maxResults);
    console.log("startPosition in response:", paginatedResult.QueryResponse?.startPosition);
    console.log();

    // Test 4: Get actual invoice IDs to see what we're getting
    console.log("TEST 4: Invoice IDs and DocNumbers");
    console.log("-".repeat(80));

    const invoices = paginatedResult.QueryResponse?.Invoice || [];
    if (Array.isArray(invoices)) {
      console.log(`Total invoices returned: ${invoices.length}`);
      console.log();
      console.log("First 5 invoices:");
      invoices.slice(0, 5).forEach((inv: any, idx: number) => {
        console.log(`  ${idx + 1}. ID: ${inv.Id}, DocNumber: ${inv.DocNumber}, Customer: ${inv.CustomerRef?.value}, Amount: ${inv.TotalAmt}`);
      });
    } else if (invoices.Id) {
      console.log("Single invoice returned (not array):");
      console.log(`  ID: ${invoices.Id}, DocNumber: ${invoices.DocNumber}, Amount: ${invoices.TotalAmt}`);
    } else {
      console.log("No invoices found in response");
    }
    console.log();

    // Test 5: Try to get "next page"
    console.log("TEST 5: Attempt to fetch second page (STARTPOSITION 15)");
    console.log("-".repeat(80));

    const secondPageQuery = "SELECT * FROM Invoice STARTPOSITION 15 MAXRESULTS 1000";
    const secondPageResult = await (quickbooksService as any).request(
      `/query?query=${encodeURIComponent(secondPageQuery)}`
    );

    console.log("Query:", secondPageQuery);
    const secondPageInvoices = secondPageResult.QueryResponse?.Invoice || [];
    console.log("Invoice count on page 2:", Array.isArray(secondPageInvoices) ? secondPageInvoices.length : (secondPageInvoices.Id ? 1 : 0));

    if (Array.isArray(secondPageInvoices) && secondPageInvoices.length > 0) {
      console.log("✅ SUCCESS: Found more invoices on page 2!");
      console.log("First invoice on page 2:");
      console.log(`  ID: ${secondPageInvoices[0].Id}, DocNumber: ${secondPageInvoices[0].DocNumber}`);
    } else if (secondPageInvoices.Id) {
      console.log("✅ SUCCESS: Found 1 invoice on page 2!");
      console.log(`  ID: ${secondPageInvoices.Id}, DocNumber: ${secondPageInvoices.DocNumber}`);
    } else {
      console.log("❌ No invoices found on page 2 - might mean only 14 invoices exist");
    }
    console.log();

    // Test 6: Count query
    console.log("TEST 6: COUNT query to get total invoices");
    console.log("-".repeat(80));

    const countQuery = "SELECT COUNT(*) FROM Invoice";
    const countResult = await (quickbooksService as any).request(
      `/query?query=${encodeURIComponent(countQuery)}`
    );

    console.log("Query:", countQuery);
    console.log("Count result:", JSON.stringify(countResult.QueryResponse, null, 2));
    console.log();

    // Summary
    console.log("=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log(`Total invoices in first query: ${invoices.length || 0}`);
    console.log(`Invoices on page 2: ${Array.isArray(secondPageInvoices) ? secondPageInvoices.length : (secondPageInvoices.Id ? 1 : 0)}`);
    console.log();

    if ((invoices.length || 0) < 15 && (!Array.isArray(secondPageInvoices) || secondPageInvoices.length === 0)) {
      console.log("⚠️  CONCLUSION: QuickBooks company appears to have fewer than 15 invoices");
      console.log("   - This is NOT a pagination bug");
      console.log("   - Verify you're connected to the correct QuickBooks company");
      console.log("   - Check if you're in sandbox vs production environment");
    } else {
      console.log("✅ CONCLUSION: Pagination should work - multiple pages available");
      console.log("   - Check pagination logic in quickbooks-sync.service.ts");
    }
    console.log();

  } catch (error: any) {
    console.error("❌ Error during diagnostic:");
    console.error("Message:", error.message);
    console.error("Status:", error.status);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Run diagnostics
diagnoseInvoicePagination()
  .then(() => {
    console.log("✅ Diagnostics complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });

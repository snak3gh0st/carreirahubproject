import { NextResponse } from "next/server";
import { quickbooksService } from "@/lib/services/quickbooks.service";

/**
 * GET /api/quickbooks/test-pagination
 *
 * Diagnostic endpoint to test QuickBooks pagination
 * Shows detailed logs of what QB API returns
 *
 * No authentication required (for easier testing)
 * Remove this endpoint after debugging
 */
export async function GET() {
  try {
    console.log("=".repeat(80));
    console.log("[TEST PAGINATION] Starting QuickBooks pagination test");
    console.log("=".repeat(80));

    // Initialize QuickBooks service
    await quickbooksService.initialize();

    const results: any = {
      timestamp: new Date().toISOString(),
      tests: [],
    };

    // Test 1: Get first page of invoices
    console.log("\n[TEST 1] Fetching first page of invoices...");
    const page1 = await quickbooksService.getAllInvoicesPaginated({
      startPosition: 1,
    });

    results.tests.push({
      name: "First page of invoices",
      invoiceCount: page1.invoices.length,
      hasMore: page1.hasMore,
      nextPosition: page1.nextPosition,
      firstInvoiceId: page1.invoices[0]?.Id,
      lastInvoiceId: page1.invoices[page1.invoices.length - 1]?.Id,
    });

    // Test 2: Try to get second page (if hasMore is true)
    if (page1.hasMore) {
      console.log("\n[TEST 2] hasMore=true, fetching second page...");
      const page2 = await quickbooksService.getAllInvoicesPaginated({
        startPosition: page1.nextPosition,
      });

      results.tests.push({
        name: "Second page of invoices",
        invoiceCount: page2.invoices.length,
        hasMore: page2.hasMore,
        nextPosition: page2.nextPosition,
        firstInvoiceId: page2.invoices[0]?.Id,
        lastInvoiceId: page2.invoices[page2.invoices.length - 1]?.Id,
      });
    } else {
      console.log("\n[TEST 2] hasMore=false, no second page to fetch");
      results.tests.push({
        name: "Second page of invoices",
        skipped: true,
        reason: "hasMore was false on first page",
      });
    }

    // Test 3: Get first page of customers
    console.log("\n[TEST 3] Fetching first page of customers...");
    const custPage1 = await quickbooksService.getAllCustomersPaginated({
      startPosition: 1,
    });

    results.tests.push({
      name: "First page of customers",
      customerCount: custPage1.customers.length,
      hasMore: custPage1.hasMore,
      nextPosition: custPage1.nextPosition,
      firstCustomerId: custPage1.customers[0]?.Id,
      lastCustomerId:
        custPage1.customers[custPage1.customers.length - 1]?.Id,
    });

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("[TEST PAGINATION] Summary:");
    console.log("=".repeat(80));
    console.log(`Total invoices on page 1: ${page1.invoices.length}`);
    console.log(`Pagination continues for invoices: ${page1.hasMore}`);
    console.log(`Total customers on page 1: ${custPage1.customers.length}`);
    console.log(`Pagination continues for customers: ${custPage1.hasMore}`);
    console.log("=".repeat(80));

    // Diagnosis
    results.diagnosis = {
      invoiceCount: page1.invoices.length,
      invoicePaginationWorks: page1.hasMore,
      possibleIssues: [],
    };

    if (!page1.hasMore && page1.invoices.length < 100) {
      results.diagnosis.possibleIssues.push(
        "QuickBooks company appears to have fewer than 100 invoices"
      );
      results.diagnosis.possibleIssues.push(
        "Verify you're connected to the correct QB company"
      );
      results.diagnosis.possibleIssues.push(
        "Check QUICKBOOKS_ENVIRONMENT (sandbox vs production)"
      );
    }

    if (page1.invoices.length === 14) {
      results.diagnosis.possibleIssues.push(
        "Exactly 14 invoices returned - might be all invoices in QB company"
      );
      results.diagnosis.possibleIssues.push(
        "Check QuickBooks web interface to verify actual invoice count"
      );
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    console.error("[TEST PAGINATION] Error:", error);

    return NextResponse.json(
      {
        error: error.message,
        status: error.status || 500,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

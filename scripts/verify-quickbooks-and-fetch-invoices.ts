/**
 * Script to verify QuickBooks authentication and fetch all invoices
 * Usage: npx ts-node scripts/verify-quickbooks-and-fetch-invoices.ts
 */

import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("QuickBooks Authentication & Invoice Fetcher");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Step 1: Initialize QuickBooks service
  console.log("Step 1: Initializing QuickBooks service...");
  await quickbooksService.initialize();

  // Step 2: Check authentication status
  console.log("\nStep 2: Verifying authentication status...");
  const authStatus = await quickbooksService.getAuthStatus();

  console.log("\n📊 Authentication Status:");
  console.log(`   ✓ Is Authenticated: ${authStatus.isAuthenticated ? '✅ YES' : '❌ NO'}`);
  console.log(`   ✓ Company ID: ${authStatus.companyId || '❌ NOT SET'}`);
  console.log(`   ✓ Token Expires At: ${authStatus.tokenExpiresAt ? authStatus.tokenExpiresAt.toISOString() : '❌ NOT SET'}`);

  if (authStatus.tokenExpiresAt) {
    const isExpired = new Date() > authStatus.tokenExpiresAt;
    console.log(`   ✓ Token Status: ${isExpired ? '⚠️ EXPIRED' : '✅ VALID'}`);

    if (isExpired) {
      console.log("\n⚠️ Token is expired. Service will attempt to refresh on first API call.");
    }
  }

  if (!authStatus.isAuthenticated) {
    console.error("\n❌ QuickBooks is not authenticated!");
    console.error("Please authenticate first:");
    console.error("1. Visit: http://localhost:3000/api/quickbooks/auth/connect");
    console.error("2. Complete the OAuth flow");
    console.error("3. Run this script again");
    process.exit(1);
  }

  // Step 3: Test connection with Company Info
  console.log("\nStep 3: Testing connection with Company Info...");
  try {
    const companyInfo = await quickbooksService.getCompanyInfo();
    console.log(`   ✅ Connection successful!`);
    console.log(`   Company Name: ${companyInfo.CompanyInfo?.CompanyName || 'N/A'}`);
    console.log(`   Legal Name: ${companyInfo.CompanyInfo?.LegalName || 'N/A'}`);
    console.log(`   Email: ${companyInfo.CompanyInfo?.Email?.Address || 'N/A'}`);
  } catch (error: any) {
    console.error(`   ❌ Connection failed: ${error.message}`);
    process.exit(1);
  }

  // Step 4: Fetch all invoices with pagination
  console.log("\nStep 4: Fetching all invoices from QuickBooks...");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const allInvoices: any[] = [];
  let currentPosition = 1;
  let pageNumber = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`📄 Fetching page ${pageNumber} (starting from position ${currentPosition})...`);

    try {
      const result = await quickbooksService.getAllInvoicesPaginated({
        startPosition: currentPosition,
      });

      const fetchedCount = result.invoices.length;
      allInvoices.push(...result.invoices);

      console.log(`   ✓ Fetched ${fetchedCount} invoices`);
      console.log(`   ✓ Total so far: ${allInvoices.length}`);
      console.log(`   ✓ Has more: ${result.hasMore}`);

      hasMore = result.hasMore;
      currentPosition = result.nextPosition;
      pageNumber++;

      if (hasMore) {
        console.log(`   → Fetching next page...\n`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error fetching page ${pageNumber}: ${error.message}`);
      break;
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📊 Fetch Summary");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`Total Invoices Fetched: ${allInvoices.length}`);
  console.log(`Total Pages: ${pageNumber - 1}`);

  if (allInvoices.length > 0) {
    // Display invoice statistics
    const statusCounts: Record<string, number> = {};
    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;

    allInvoices.forEach(invoice => {
      const status = invoice.Balance === 0 ? 'Paid' :
                     invoice.Balance === invoice.TotalAmt ? 'Unpaid' :
                     'Partially Paid';
      statusCounts[status] = (statusCounts[status] || 0) + 1;

      totalAmount += parseFloat(invoice.TotalAmt || 0);
      if (invoice.Balance === 0) {
        paidAmount += parseFloat(invoice.TotalAmt || 0);
      } else {
        unpaidAmount += parseFloat(invoice.Balance || 0);
      }
    });

    console.log("\n📈 Invoice Statistics:");
    console.log(`   Total Amount: $${totalAmount.toFixed(2)}`);
    console.log(`   Paid Amount: $${paidAmount.toFixed(2)}`);
    console.log(`   Unpaid Amount: $${unpaidAmount.toFixed(2)}`);

    console.log("\n📊 By Status:");
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} invoices`);
    });

    console.log("\n📋 Sample Invoices (first 5):");
    allInvoices.slice(0, 5).forEach((invoice, idx) => {
      console.log(`\n   ${idx + 1}. Invoice #${invoice.DocNumber || invoice.Id}`);
      console.log(`      ID: ${invoice.Id}`);
      console.log(`      Customer: ${invoice.CustomerRef?.name || 'N/A'}`);
      console.log(`      Date: ${invoice.TxnDate}`);
      console.log(`      Total: $${invoice.TotalAmt || 0}`);
      console.log(`      Balance: $${invoice.Balance || 0}`);
      console.log(`      Status: ${invoice.Balance === 0 ? 'Paid' :
                                   invoice.Balance === invoice.TotalAmt ? 'Unpaid' :
                                   'Partially Paid'}`);
    });

    // Step 5: Check database sync status
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Step 5: Checking database sync status...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    let syncedCount = 0;
    let notSyncedCount = 0;

    for (const qbInvoice of allInvoices) {
      // Check if invoice already exists in our database
      const existingInvoice = await prisma.invoice.findFirst({
        where: {
          quickbooks_invoice_id: qbInvoice.Id,
        },
      });

      if (existingInvoice) {
        syncedCount++;
      } else {
        notSyncedCount++;
        if (notSyncedCount <= 5) {
          console.log(`   ⚠️ Invoice ${qbInvoice.DocNumber || qbInvoice.Id} not synced to database`);
        }
      }
    }

    if (notSyncedCount > 5) {
      console.log(`   ... and ${notSyncedCount - 5} more not synced`);
    }

    console.log("\n📊 Database Sync Status:");
    console.log(`   Synced to Database: ${syncedCount}`);
    console.log(`   Not Synced: ${notSyncedCount}`);
    console.log(`   Total in QuickBooks: ${allInvoices.length}`);
  } else {
    console.log("\n⚠️ No invoices found in QuickBooks.");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ Done!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Fatal Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

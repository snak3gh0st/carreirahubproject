/**
 * Check if a specific QB invoice exists by ID and by DocNumber.
 * Also checks for deleted invoices via the Change Data Capture API.
 *
 * Usage: npx tsx scripts/check-qb-invoice.ts
 */

async function main() {
  const { quickbooksService } = await import('../lib/services/quickbooks.service');
  await quickbooksService.initialize();

  const QB_INVOICE_ID = '19093';
  const DOC_NUMBER = 'ACL-PP-260420-S-VC3';
  const CUSTOMER_QB_ID = '759';

  console.log('=== QB Invoice Check ===\n');

  // 1. Try to fetch by ID
  console.log(`--- 1. Fetch invoice by ID ${QB_INVOICE_ID} ---`);
  try {
    const invoice = await quickbooksService.getInvoice(QB_INVOICE_ID);
    console.log('  FOUND:', JSON.stringify({
      Id: invoice.Id,
      DocNumber: invoice.DocNumber,
      TotalAmt: invoice.TotalAmt,
      Balance: invoice.Balance,
      EmailStatus: invoice.EmailStatus,
      status: invoice.status,
    }, null, 2));
  } catch (e: any) {
    console.log(`  NOT FOUND: ${e.message?.slice(0, 300)}`);
  }

  // 2. Try to fetch by DocNumber
  console.log(`\n--- 2. Query invoice by DocNumber "${DOC_NUMBER}" ---`);
  try {
    const invoice = await quickbooksService.getInvoiceByDocNumber(DOC_NUMBER);
    if (invoice) {
      console.log('  FOUND:', JSON.stringify({
        Id: invoice.Id,
        DocNumber: invoice.DocNumber,
        TotalAmt: invoice.TotalAmt,
      }, null, 2));
    } else {
      console.log('  NOT FOUND (null returned)');
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message?.slice(0, 300)}`);
  }

  // 3. List all recent invoices for this customer
  console.log(`\n--- 3. All invoices for customer QB ID ${CUSTOMER_QB_ID} ---`);
  try {
    const invoices = await quickbooksService.getInvoicesByCustomer(CUSTOMER_QB_ID, 20);
    console.log(`  Found ${invoices.length} invoices:`);
    for (const inv of invoices) {
      console.log(`    #${inv.DocNumber || 'no-doc'} | ID: ${inv.Id} | $${inv.TotalAmt} | Balance: $${inv.Balance} | ${inv.EmailStatus} | ${inv.TxnDate}`);
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message?.slice(0, 300)}`);
  }

  // 4. Check Change Data Capture for deleted invoices
  console.log(`\n--- 4. Change Data Capture: deleted invoices (last 30 days) ---`);
  try {
    const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const cdcData = await (quickbooksService as any).request(
      `/cdc?entities=Invoice&changedSince=${sinceDate}T00:00:00-07:00`
    );
    const cdcEntries = cdcData?.CDCResponse?.[0]?.QueryResponse?.[0]?.Invoice || [];
    const deleted = cdcEntries.filter((e: any) => e.status === 'Deleted');
    console.log(`  Total changed invoices: ${cdcEntries.length}`);
    console.log(`  Deleted invoices: ${deleted.length}`);
    for (const d of deleted) {
      console.log(`    ID: ${d.Id} | DocNumber: ${d.DocNumber || 'N/A'} | Deleted at: ${d.MetaData?.LastUpdatedTime || 'unknown'}`);
    }

    // Check if our invoice is in deleted list
    const ourDeleted = deleted.find((d: any) => d.Id === QB_INVOICE_ID);
    if (ourDeleted) {
      console.log(`\n  *** CONFIRMED: Invoice ${QB_INVOICE_ID} WAS DELETED ***`);
      console.log(`    Deleted at: ${ourDeleted.MetaData?.LastUpdatedTime}`);
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message?.slice(0, 300)}`);
  }

  // 5. Check all recent invoices in QB (last 15 days) to get a full picture
  console.log(`\n--- 5. All QB invoices created since Apr 15 ---`);
  try {
    const invoices = await quickbooksService.getInvoicesByDateRange(
      '2026-04-15', '2026-04-28'
    );
    console.log(`  Found ${invoices.length} invoices:`);
    for (const inv of invoices.slice(0, 15)) {
      console.log(`    ${inv.TxnDate} | #${inv.DocNumber || 'N/A'} | ID: ${inv.Id} | $${inv.TotalAmt} | ${inv.CustomerRef?.name || 'unknown'} | Balance: $${inv.Balance}`);
    }
    if (invoices.length > 15) console.log(`    ... and ${invoices.length - 15} more`);
  } catch (e: any) {
    console.log(`  ERROR: ${e.message?.slice(0, 300)}`);
  }

  console.log('\n=== Check Complete ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

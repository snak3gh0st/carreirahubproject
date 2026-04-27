import { quickbooksService } from "../lib/services/quickbooks.service";

async function voidAllInvoicesForCustomer() {
  await quickbooksService.initialize();

  const query =
    "SELECT Id, DocNumber, Balance, TotalAmt FROM Invoice WHERE CustomerRef = '1580' ORDER BY Id DESC MAXRESULTS 100";
  const result = await (quickbooksService as any).request(
    `/query?query=${encodeURIComponent(query)}`
  );

  const invoices = result.QueryResponse?.Invoice || [];
  console.log(`Found ${invoices.length} invoices for customer 1580`);

  for (const inv of invoices) {
    console.log(
      `  - ${inv.Id} | ${inv.DocNumber} | $${inv.TotalAmt} | Balance: $${inv.Balance}`
    );
  }

  let voided = 0;
  for (const inv of invoices) {
    try {
      const full = await (quickbooksService as any).request(
        `/invoice/${inv.Id}`
      );
      const invoice = full.Invoice;

      await (quickbooksService as any).request(`/invoice?operation=void`, {
        method: "POST",
        body: JSON.stringify({
          Id: invoice.Id,
          SyncToken: invoice.SyncToken,
        }),
      });

      console.log(`  ✓ Voided ${inv.Id} (${inv.DocNumber})`);
      voided++;
    } catch (err: any) {
      console.error(`  ✗ Failed to void ${inv.Id}: ${err.message}`);
    }
  }

  console.log(`\nDone: ${voided}/${invoices.length} invoices voided`);
}

voidAllInvoicesForCustomer().catch(console.error);

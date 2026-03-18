import { quickbooksService } from "@/lib/services/quickbooks.service";

async function main() {
  await quickbooksService.initialize();

  // Get a recent invoice
  const query = `SELECT Id, DocNumber, BillEmail, CustomerRef, Balance FROM Invoice WHERE Balance > '0' MAXRESULTS 3`;
  const result = await (quickbooksService as any).request(
    `/query?query=${encodeURIComponent(query)}`
  );

  const invoices = result?.QueryResponse?.Invoice || [];

  for (const inv of invoices) {
    console.log("---");
    console.log(`Invoice ID     : ${inv.Id}`);
    console.log(`DocNumber      : ${inv.DocNumber}`);
    console.log(`Balance        : $${inv.Balance}`);
    console.log(`BillEmail      : ${inv.BillEmail?.Address}`);
    console.log(`Customer       : ${inv.CustomerRef?.name} (${inv.CustomerRef?.value})`);
  }

  // Fetch individual invoice with full details + invoiceLink
  if (invoices.length > 0) {
    const invId = invoices[0].Id;
    console.log(`\n=== Fetching invoice ${invId} with invoiceLink ===`);
    try {
      const detailed = await (quickbooksService as any).request(
        `/invoice/${invId}?include=invoiceLink`
      );
      const inv = detailed?.Invoice;
      console.log(`InvoiceLink                   : ${inv?.InvoiceLink}`);
      console.log(`AllowOnlineCreditCardPayment  : ${inv?.AllowOnlineCreditCardPayment}`);
      console.log(`AllowOnlineACHPayment         : ${inv?.AllowOnlineACHPayment}`);
      console.log(`AllowOnlinePayPalPayment      : ${inv?.AllowOnlinePayPalPayment}`);
      // Show all keys to find payment-related fields
      const payKeys = Object.keys(inv || {}).filter(k =>
        k.toLowerCase().includes("pay") || k.toLowerCase().includes("online") ||
        k.toLowerCase().includes("link") || k.toLowerCase().includes("allow")
      );
      console.log(`Payment-related keys:`, payKeys);
    } catch (e: any) {
      console.error("Error:", e.message);
    }
  }

  // Check QB Payments preferences / company info for payment methods
  console.log("\n=== Company Preferences ===");
  try {
    const prefs = await (quickbooksService as any).request("/preferences");
    const salesPrefs = prefs?.Preferences?.SalesFormsPrefs;
    console.log("AllowOnlineCreditCardPayment:", salesPrefs?.AllowOnlineCreditCardPayment);
    console.log("AllowOnlineACHPayment:", salesPrefs?.AllowOnlineACHPayment);
    console.log("AllowOnlinePayPal:", salesPrefs?.AllowOnlinePayPal);
    console.log("CustomPayment:", salesPrefs?.CustomPayment);
    console.log("Sales prefs keys:", Object.keys(salesPrefs || {}));
  } catch (e: any) {
    console.error("Error fetching preferences:", e.message);
  }
}

main().catch(console.error);

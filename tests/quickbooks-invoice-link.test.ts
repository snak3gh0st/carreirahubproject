import assert from "node:assert/strict";
import test from "node:test";

import { extractQuickbooksInvoiceLink } from "../lib/quickbooks/invoice-link";

test("extractQuickbooksInvoiceLink reads the public invoice link from QB payloads", () => {
  const link = "https://connect.intuit.com/portal/app/CommerceNetwork/view/scs-v1-test";

  assert.equal(
    extractQuickbooksInvoiceLink({
      Invoice: {
        Id: "19360",
        InvoiceLink: link,
      },
    }),
    link
  );
});

test("extractQuickbooksInvoiceLink rejects missing or non-public links", () => {
  assert.equal(extractQuickbooksInvoiceLink({ Invoice: { Id: "19360" } }), null);
  assert.equal(extractQuickbooksInvoiceLink({ Invoice: { InvoiceLink: "nota-url" } }), null);
  assert.equal(extractQuickbooksInvoiceLink({ InvoiceLink: "https://example.com/invoice" }), null);
});

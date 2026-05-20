import assert from "node:assert/strict";
import test from "node:test";

import { isQuickBooksInvoiceQueuedForEmail } from "../lib/quickbooks/invoice-email";

test("isQuickBooksInvoiceQueuedForEmail accepts invoices already queued for email delivery", () => {
  assert.equal(
    isQuickBooksInvoiceQueuedForEmail({
      EmailStatus: "NeedToSend",
      BillEmail: { Address: "finance@example.com" },
      DeliveryInfo: { DeliveryType: "Email" },
    }),
    true
  );

  assert.equal(
    isQuickBooksInvoiceQueuedForEmail({
      EmailStatus: "EmailSent",
      BillEmail: { Address: "finance@example.com" },
    }),
    true
  );
});

test("isQuickBooksInvoiceQueuedForEmail rejects invoices without an email target or queued state", () => {
  assert.equal(
    isQuickBooksInvoiceQueuedForEmail({
      EmailStatus: "NotSet",
      BillEmail: { Address: "finance@example.com" },
    }),
    false
  );

  assert.equal(
    isQuickBooksInvoiceQueuedForEmail({
      EmailStatus: "NeedToSend",
      BillEmail: null,
    }),
    false
  );
});

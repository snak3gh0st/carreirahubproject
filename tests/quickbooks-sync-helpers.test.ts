import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseInvoiceSyncMatch,
  collectPaginatedQuickBooksRecords,
  determineQuickBooksInvoiceStatus,
  extractQuickBooksCdcResponses,
  extractQuickBooksInvoiceFromResponse,
  extractQuickBooksQueryResponse,
  findLinkedQuickBooksInvoiceId,
  getQuickBooksIncrementalInvoiceDecision,
  isQuickBooksInvoiceMarkedMissing,
  mergeQuickBooksInvoiceMetadata,
  paymentLinksToQuickBooksInvoice,
  resolveLocalCustomerIdForPayment,
} from "../lib/quickbooks/sync-helpers";

test("collectPaginatedQuickBooksRecords fetches all pages until hasMore is false", async () => {
  const calls: number[] = [];

  const records = await collectPaginatedQuickBooksRecords(async (startPosition) => {
    calls.push(startPosition);

    if (startPosition === 1) {
      return {
        records: [{ id: "p1" }, { id: "p2" }],
        hasMore: true,
        nextPosition: 3,
      };
    }

    return {
      records: [{ id: "p3" }],
      hasMore: false,
      nextPosition: 4,
    };
  });

  assert.deepEqual(calls, [1, 3]);
  assert.deepEqual(records, [{ id: "p1" }, { id: "p2" }, { id: "p3" }]);
});

test("extractQuickBooksInvoiceFromResponse accepts nested and direct payloads", () => {
  assert.deepEqual(
    extractQuickBooksInvoiceFromResponse({ Invoice: { Id: "123", DocNumber: "INV-123" } }),
    { Id: "123", DocNumber: "INV-123" },
  );
  assert.deepEqual(
    extractQuickBooksInvoiceFromResponse({ Id: "456", DocNumber: "INV-456" }),
    { Id: "456", DocNumber: "INV-456" },
  );
  assert.equal(extractQuickBooksInvoiceFromResponse(null), null);
});

test("extractQuickBooksQueryResponse and extractQuickBooksCdcResponses normalize nullable responses", () => {
  assert.deepEqual(extractQuickBooksQueryResponse(null), {});
  assert.deepEqual(extractQuickBooksQueryResponse({ QueryResponse: { Invoice: [{ Id: "1" }] } }), {
    Invoice: [{ Id: "1" }],
  });
  assert.deepEqual(extractQuickBooksCdcResponses(null), []);
  assert.deepEqual(extractQuickBooksCdcResponses({ CDCResponse: { QueryResponse: [] } }), [
    { QueryResponse: [] },
  ]);
});

test("findLinkedQuickBooksInvoiceId scans all payment lines", () => {
  const qbPayment = {
    Line: [
      { LinkedTxn: [{ TxnType: "CreditMemo", TxnId: "cm_1" }] },
      { LinkedTxn: [{ TxnType: "Invoice", TxnId: "inv_42" }] },
    ],
  };

  assert.equal(findLinkedQuickBooksInvoiceId(qbPayment), "inv_42");
});

test("paymentLinksToQuickBooksInvoice matches any linked invoice in the payment lines", () => {
  const qbPayment = {
    Line: [
      { LinkedTxn: [{ TxnType: "CreditMemo", TxnId: "cm_1" }] },
      { LinkedTxn: [{ TxnType: "Invoice", TxnId: "inv_42" }] },
      { LinkedTxn: [{ TxnType: "Invoice", TxnId: "inv_99" }] },
    ],
  };

  assert.equal(paymentLinksToQuickBooksInvoice(qbPayment, "inv_99"), true);
  assert.equal(paymentLinksToQuickBooksInvoice(qbPayment, "missing"), false);
});

test("resolveLocalCustomerIdForPayment falls back to the linked local invoice customer id", () => {
  const customerId = resolveLocalCustomerIdForPayment({
    linkedInvoiceCustomerId: "customer_local_123",
    linkedInvoiceQbCustomerId: undefined,
    customerByQbId: new Map([["qb_customer_1", { id: "customer_local_999" }]]),
  });

  assert.equal(customerId, "customer_local_123");
});

test("chooseInvoiceSyncMatch prefers a direct QuickBooks id match before doc number and draft fallbacks", () => {
  const result = chooseInvoiceSyncMatch({
    existingByQuickBooksId: { id: "local-qb" },
    existingByDocNumber: { id: "local-doc" },
    draftFallback: { id: "local-draft" },
  });

  assert.deepEqual(result, {
    record: { id: "local-qb" },
    strategy: "quickbooks_id",
  });
});

test("chooseInvoiceSyncMatch falls back to doc number before draft when QuickBooks ids drift", () => {
  const result = chooseInvoiceSyncMatch({
    existingByQuickBooksId: null,
    existingByDocNumber: { id: "local-doc" },
    draftFallback: { id: "local-draft" },
  });

  assert.deepEqual(result, {
    record: { id: "local-doc" },
    strategy: "doc_number",
  });
});

test("determineQuickBooksInvoiceStatus marks fully open past-due invoices overdue", () => {
  assert.equal(
    determineQuickBooksInvoiceStatus({
      balance: 300,
      totalAmount: 300,
      dueDate: new Date("2026-05-20T12:00:00.000Z"),
      now: new Date("2026-05-22T12:00:00.000Z"),
    }),
    "OVERDUE"
  );
});

test("determineQuickBooksInvoiceStatus keeps fully open invoices sent on the due date", () => {
  assert.equal(
    determineQuickBooksInvoiceStatus({
      balance: 300,
      totalAmount: 300,
      dueDate: new Date("2026-05-22T12:00:00.000Z"),
      now: new Date("2026-05-22T23:00:00.000Z"),
    }),
    "SENT"
  );
});

test("mergeQuickBooksInvoiceMetadata preserves existing installment data while updating quickbooks metadata", () => {
  const result = mergeQuickBooksInvoiceMetadata(
    {
      program: { installments: 6 },
      quickbooks: { syncDate: "2026-05-01T00:00:00.000Z", missingInQb: true },
    },
    {
      missingInQb: false,
      relinkedAt: "2026-05-04T00:00:00.000Z",
    },
  );

  assert.deepEqual(result, {
    program: { installments: 6 },
    quickbooks: {
      syncDate: "2026-05-01T00:00:00.000Z",
      missingInQb: false,
      relinkedAt: "2026-05-04T00:00:00.000Z",
    },
  });
});

test("isQuickBooksInvoiceMarkedMissing detects invoices previously flagged as absent from QuickBooks", () => {
  assert.equal(isQuickBooksInvoiceMarkedMissing({ quickbooks: { missingInQb: true } }), true);
  assert.equal(isQuickBooksInvoiceMarkedMissing({ quickbooks: { missingInQbAt: "2026-05-04T00:00:00.000Z" } }), true);
  assert.equal(isQuickBooksInvoiceMarkedMissing({ quickbooks: { missingInQb: false } }), false);
});

test("getQuickBooksIncrementalInvoiceDecision requests a backfill when the local invoice is missing", () => {
  const decision = getQuickBooksIncrementalInvoiceDecision({
    existingInvoice: null,
    nextStatus: "SENT",
    nextAmount: 1800,
    nextDueDate: new Date("2026-05-28T00:00:00.000Z"),
    nextAmountPaid: 0,
    excludeFromHub: false,
  });

  assert.equal(decision, "backfill");
});

test("getQuickBooksIncrementalInvoiceDecision updates when invoice data changes even if status stays the same", () => {
  const decision = getQuickBooksIncrementalInvoiceDecision({
    existingInvoice: {
      status: "SENT",
      amount: 1800,
      dueDate: new Date("2026-05-28T00:00:00.000Z"),
      amountPaid: 0,
      installments: { quickbooks: { excludedFromHub: false } },
    },
    nextStatus: "SENT",
    nextAmount: 1950,
    nextDueDate: new Date("2026-05-31T00:00:00.000Z"),
    nextAmountPaid: 0,
    excludeFromHub: false,
  });

  assert.equal(decision, "update");
});

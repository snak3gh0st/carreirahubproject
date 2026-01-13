# QuickBooks Field Coverage Audit

**Date:** 2026-01-13
**Purpose:** Verify that all Finance-critical fields are captured during QB sync

---

## Customer Sync Field Coverage

### QuickBooks Fields Fetched → Hub Fields Stored

| QB Field | Hub Field | Finance Critical? | Status |
|----------|-----------|-------------------|--------|
| `Id` | `quickbooks_id` | ✅ Critical | ✅ CAPTURED |
| `DisplayName` / `CompanyName` | `name` | ✅ Critical | ✅ CAPTURED |
| `PrimaryEmailAddr.Address` | `email` | ✅ Critical | ✅ CAPTURED |
| `PrimaryPhone.FreeFormNumber` | `phone` | ⚠️ Important | ✅ CAPTURED |
| `Balance` | `qbBalance` | ✅ Critical | ✅ CAPTURED |
| `MetaData.LastUpdatedTime` | Stored in `metadata.quickbooks.metaData` | ⚠️ Important | ✅ CAPTURED |

**Implementation:** `quickbooks-sync.service.ts:syncCustomers()` (lines 544-638)

**Finance-Critical Fields Verified:**
- ✅ Customer QB ID for linking invoices/payments
- ✅ Email for Identity Mapper deduplication
- ✅ Current balance from QB (`qbBalance`)
- ✅ Phone for contact/collections

**Calculated Fields (from invoices/payments):**
- ✅ `qbTotalInvoiced` - Sum of all invoice amounts
- ✅ `qbTotalPaid` - Sum of all payment amounts
- ✅ `lastQbBalanceSync` - Timestamp of last balance update

**Implementation:** `quickbooks-sync.service.ts:updateCustomerBalance()` (lines 431-463)

---

## Invoice Sync Field Coverage

### QuickBooks Fields Fetched → Hub Fields Stored

| QB Field | Hub Field | Finance Critical? | Status |
|----------|-----------|-------------------|--------|
| `Id` | `quickbooks_invoice_id` | ✅ Critical | ✅ CAPTURED |
| `DocNumber` | `invoiceNumber` | ✅ Critical | ✅ CAPTURED |
| `TotalAmt` | `amount` | ✅ Critical | ✅ CAPTURED |
| `Balance` | Stored in `installments.quickbooks.balance` | ✅ Critical | ✅ CAPTURED |
| `DueDate` | `dueDate` | ✅ Critical | ✅ CAPTURED |
| `TxnDate` | Stored in `installments.quickbooks.txnDate` | ⚠️ Important | ✅ CAPTURED |
| `CustomerRef.value` | Linked via `customerId` | ✅ Critical | ✅ CAPTURED |
| `EmailStatus` | Stored in `installments.quickbooks.emailStatus` | ℹ️ Nice-to-have | ✅ CAPTURED |

**Implementation:** `quickbooks-sync.service.ts:syncInvoices()` (lines 643-763)

**Finance-Critical Fields Verified:**
- ✅ Invoice QB ID for payment linking
- ✅ Invoice number for customer reference
- ✅ Total amount for accounting
- ✅ Balance for payment tracking
- ✅ Due date for overdue detection
- ✅ Customer linkage for collections

**Status Detection Logic:**
```typescript
// Lines 183-197 in quickbooks-sync.service.ts
const balance = qbInvoice.Balance || 0;
const totalAmt = qbInvoice.TotalAmt || 0;
const dueDate = qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : new Date();

if (balance === 0) status = "PAID";
else if (balance < totalAmt && balance > 0) status = "PARTIALLY_PAID";
else if (dueDate < today && balance > 0) status = "OVERDUE";
else if (qbInvoice.EmailStatus === "EmailSent") status = "SENT";
```

**Overdue Tracking:**
- ✅ `markedOverdueAt` - When invoice became overdue
- ✅ `status` - Includes OVERDUE enum value
- ✅ Automatic status calculation based on `dueDate` and `balance`

---

## Payment Sync Field Coverage

### QuickBooks Fields Fetched → Hub Fields Stored

| QB Field | Hub Field | Finance Critical? | Status |
|----------|-----------|-------------------|--------|
| `Id` | `quickbooks_payment_id` | ✅ Critical | ✅ CAPTURED |
| `TotalAmt` | `amount` | ✅ Critical | ✅ CAPTURED |
| `TxnDate` | `paymentDate` | ✅ Critical | ✅ CAPTURED |
| `PaymentRefNum` / `DocNumber` | `referenceNumber` | ✅ Critical | ✅ CAPTURED |
| `CustomerRef.value` | Linked via `customerId` | ✅ Critical | ✅ CAPTURED |
| `Line.LinkedTxn` (Invoice link) | `invoiceId` | ✅ Critical | ✅ CAPTURED |

**Implementation:** `quickbooks-sync.service.ts:syncSinglePayment()` (lines 273-426)

**Finance-Critical Fields Verified:**
- ✅ Payment QB ID for deduplication
- ✅ Amount for accounting
- ✅ Payment date for timeline
- ✅ Reference number for reconciliation
- ✅ Invoice linkage for payment application
- ✅ Customer linkage for balance updates

**Bi-directional Sync Support:**
- ✅ Hub → QB: `syncPaymentsToQuickBooks()` (lines 856-964)
- ✅ QB → Hub: `syncSinglePayment()` (lines 273-426)
- ✅ Sync direction tracking: `syncedFromQb` and `syncedToQb` flags

---

## Fields Deferred (Nice-to-Have, Not Blocking)

### Customer Address Fields
**QB Fields:** `BillAddr`, `ShipAddr`
**Why Deferred:** Not required for Finance workflows. Collections use phone/email, not physical mail.
**Future Use Case:** If physical mail is needed for legal notices.

### Invoice Line Items
**QB Fields:** `Line` array with `DetailType`, `Amount`, `ItemRef`, `Description`
**Why Deferred:** Finance needs total amounts and payment status, not itemized breakdowns.
**Future Use Case:** If product-level reporting or inventory tracking is needed.

### General Ledger Accounts
**QB Fields:** `AccountRef`, `IncomeAccountRef`, `ExpenseAccountRef`
**Why Deferred:** GL integration not required for current Finance workflows.
**Future Use Case:** If GL account reconciliation or detailed P&L reporting is needed.

### Tax Information
**QB Fields:** `TxnTaxDetail`, `TaxRate`, `TaxCode`
**Why Deferred:** Tax calculations handled in QuickBooks, not needed in Hub.
**Future Use Case:** If tax reporting or multi-jurisdiction compliance is needed.

---

## Finance Department Use Cases

### ✅ SUPPORTED (All Critical Fields Present)

1. **Customer Balance Tracking**
   - Current balance: `qbBalance`
   - Total invoiced: `qbTotalInvoiced`
   - Total paid: `qbTotalPaid`
   - Last sync: `lastQbBalanceSync`

2. **Invoice Status Monitoring**
   - Invoice amount: `amount`
   - Due date: `dueDate`
   - Balance remaining: `installments.quickbooks.balance`
   - Payment status: `status` (PAID, OVERDUE, PARTIALLY_PAID, etc.)

3. **Payment Reconciliation**
   - Payment amount: `amount`
   - Payment date: `paymentDate`
   - Reference number: `referenceNumber`
   - Invoice linkage: `invoiceId`
   - QB payment ID: `quickbooks_payment_id`

4. **Overdue Invoice Detection**
   - Due date comparison: `dueDate < today`
   - Status flag: `status === "OVERDUE"`
   - Overdue timestamp: `markedOverdueAt`
   - Collection tracking: `lastCollectionCallAt`, `collectionCallCount`

5. **Payment History**
   - All payments linked to invoices via `invoiceId`
   - Payment dates for timeline
   - Customer balance updates after each payment

### ⚠️ NOT SUPPORTED (Deferred to Future Phases)

1. **Address Management** - No billing/shipping addresses
2. **Itemized Invoice Details** - No line item breakdowns
3. **GL Account Reconciliation** - No account references
4. **Tax Reporting** - No tax detail fields

---

## Recommendation

**STATUS: ✅ READY TO DEPLOY**

All Finance-critical fields are captured:
- ✅ Customer identification and balance
- ✅ Invoice amounts, due dates, and payment status
- ✅ Payment amounts, dates, and reconciliation
- ✅ Overdue detection and collection tracking

**Nice-to-have fields (addresses, line items, GL accounts) are correctly deferred:**
- Not blocking for current Finance workflows
- Can be added in future phases if needed
- No data loss - all critical financial data is preserved

**Sync Infrastructure:**
- ✅ Bidirectional sync (QB ↔ Hub)
- ✅ Deduplication via external IDs
- ✅ Incremental sync support
- ✅ Error logging via IntegrationLog
- ✅ Automatic retry on failure

**Finance can trust the data synced from QuickBooks.**

---
status: awaiting_human_verify
trigger: "Finance team created invoice with Programa Start service + discount for cash payment, saved in system but NOT created in QuickBooks"
created: 2026-03-06T00:00:00Z
updated: 2026-03-06T00:00:00Z
---

## Current Focus

hypothesis: QB API rejects invoice when discount is applied because DiscountLineDetail is missing required DiscountAccountRef field
test: Code review of createInvoiceWithBillEmail discount handling vs QB API requirements
expecting: Adding DiscountAccountRef or switching to subtotal-based discount will allow QB invoice creation with discounts
next_action: Fix discount handling in QB invoice creation - use line item amount reduction instead of DiscountLineDetail

## Symptoms

expected: When saving an invoice in the system with a discount, it should be created in QuickBooks
actual: Invoice creation fails when discount is applied (QB API validation error), entire request fails with 500
errors: QB API Business Validation Error due to missing DiscountAccountRef in DiscountLineDetail
reproduction: Create invoice with any service, add a discount amount > 0, save
started: Likely since discount feature was added

## Eliminated

## Evidence

- timestamp: 2026-03-06T00:01:00Z
  checked: createInvoiceWithBillEmail in quickbooks.service.ts (lines 530-541)
  found: DiscountLineDetail only sets PercentBased:false but is missing required DiscountAccountRef field
  implication: QB API will reject the invoice with a validation error when discount > 0

- timestamp: 2026-03-06T00:01:30Z
  checked: grep for DiscountAccountRef in entire codebase
  found: No references anywhere - field is completely missing
  implication: Discount invoices have never worked in QB

- timestamp: 2026-03-06T00:02:00Z
  checked: Invoice create route error handling (lines 675-697)
  found: QB error thrown by createInvoiceWithBillEmail is caught in outer try/catch, returns 500 to frontend
  implication: When discount > 0, the entire invoice creation fails - nothing is saved locally OR in QB

- timestamp: 2026-03-06T00:02:30Z
  checked: Frontend discount handling (InvoiceForm.tsx lines 356, 406-408)
  found: Secondary bug - discountType (amount vs percentage) is NOT sent to API; percentage value sent as raw number treated as dollar amount
  implication: Even after fixing QB discount, percentage discounts will be applied as wrong dollar amounts

## Resolution

root_cause: Two bugs in discount handling: (1) PRIMARY - QuickBooks DiscountLineDetail is missing required DiscountAccountRef, causing QB API to reject invoices with discounts. The error bubbles up as 500, failing the entire invoice creation. (2) SECONDARY - Frontend sends raw discount number without discountType; percentage discounts are treated as dollar amounts by the API.
fix: Apply discount as line item amount reduction instead of QB DiscountLineDetail (simpler, no account ref needed). Also fix frontend to convert percentage to dollar amount before sending.
verification: tsc --noEmit passes, eslint passes (only pre-existing warning). Awaiting human verification with real QB invoice creation.
files_changed: ["lib/services/quickbooks.service.ts", "app/dashboard/invoices/new/InvoiceForm.tsx"]

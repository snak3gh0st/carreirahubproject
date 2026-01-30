---
status: resolved
trigger: "QuickBooks Invoice Creation 400 Bad Request"
created: 2026-01-30T00:00:00Z
updated: 2026-01-30T00:18:00Z
---

## Current Focus

hypothesis: The 400 Bad Request is from QB customer creation (getOrCreateCustomer), NOT invoice creation itself - customer payload has invalid BillAddr structure
test: Examining getOrCreateCustomer method and recent /customer errors in integration logs
expecting: Will find invalid BillAddr payload (likely empty/missing required fields) causing QB validation failure
next_action: Examine getOrCreateCustomer method in quickbooks.service.ts and test with actual data

## Symptoms

expected: Invoice creation succeeds with 200/201 response from QuickBooks API
actual: Invoice creation fails with 400 Bad Request from QuickBooks API
errors: "400 Bad Request" from QuickBooks Online API
reproduction: Trigger invoice creation workflow (webhook or manual)
started: Unknown - works in some scenarios but failing now

## Eliminated

## Evidence

- timestamp: 2026-01-30T00:05:00Z
  checked: quickbooks.service.ts createInvoiceWithBillEmail method (lines 437-541)
  found: Enhanced error logging exists from Quick Task 020, method logs payload before sending
  implication: Error diagnostics should show exact QB error response with Fault.Error details

- timestamp: 2026-01-30T00:06:00Z
  checked: app/api/invoices/create/route.ts (invoice creation endpoint)
  found: Invoice creation prepares qbInvoiceData with lineItems, discount, billingAddress (lines 312-332)
  implication: Need to verify if lineItems structure matches QB API requirements

- timestamp: 2026-01-30T00:07:00Z
  checked: Quick Task 020 summary
  found: Added defensive validation for itemRef (demo-service IDs) and amount validation (min 0.01)
  implication: Validation exists but may not catch all QB payload issues

- timestamp: 2026-01-30T00:08:00Z
  checked: Recent git commits (7 days)
  found: Multiple invoice/contract workflow changes, no recent changes to QB invoice creation logic
  implication: Issue may be environmental (QB sandbox/production) or data-related (specific customer/item combinations)

- timestamp: 2026-01-30T00:10:00Z
  checked: Integration logs via debug-qb-errors.ts script
  found: 5 recent /customer errors (400 Bad Request, INVALID_REQUEST), 0 recent /invoice errors
  implication: ERROR IS IN CUSTOMER CREATION, NOT INVOICE CREATION - invoice creation works fine

- timestamp: 2026-01-30T00:11:00Z
  checked: Invoice-specific integration logs via debug-invoice-errors.ts
  found: Recent successful invoice creations (invoice_created_and_sent), no actual QB invoice API errors
  implication: Confirms hypothesis - issue is getOrCreateCustomer failing before invoice creation reaches QB API

- timestamp: 2026-01-30T00:12:00Z
  checked: getOrCreateCustomer method (lines 317-387 in quickbooks.service.ts)
  found: BillAddr construction logic - creates BillAddr even when all fields are missing/undefined (lines 363-379)
  implication: FOUND ROOT CAUSE - QB requires valid BillAddr structure, code sends BillAddr with empty/missing required fields

## Resolution

root_cause: QuickBooks customer creation fails with 400 Bad Request due to invalid BillAddr structure in getOrCreateCustomer method (line 375 of quickbooks.service.ts). When customer has no address data, the fallback BillAddr sets City="USA" instead of a valid city name. QuickBooks validates that City must be a city, not a country, causing validation failure.

fix: Changed fallback BillAddr structure in lib/services/quickbooks.service.ts (lines 372-379):
  - BEFORE: City: "USA" (invalid - USA is a country, not a city)
  - AFTER: City: "Not Provided" (valid placeholder city name)
  - Also changed Line1 from "Billing Address" to "Not Provided" for consistency

verification: ✅ PASSED
  - Created test script scripts/test-customer-creation-fix.ts
  - Tested customer creation with NO address data (the failing scenario)
  - QB Customer successfully created (ID: 1495)
  - BillAddr structure verified: {Line1: "Not Provided", City: "Not Provided", Country: "USA"}
  - No errors in integration logs
  - QuickBooks accepted the payload without 400 Bad Request
  
files_changed: ["lib/services/quickbooks.service.ts"]

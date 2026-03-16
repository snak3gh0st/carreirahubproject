---
status: awaiting_human_verify
trigger: "Invoice creation fails because QuickBooks getOrCreateCustomer encounters Duplicate Name Exists Error (code 6240)"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:01:00Z
---

## Current Focus

hypothesis: getOrCreateCustomer queries QB by PrimaryEmailAddr. If a customer exists in QB with a different/missing email but the same DisplayName, the query returns empty and the create call hits QB's uniqueness constraint on DisplayName, throwing error 6240.
test: Confirmed by reading the implementation at line 374: query is `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${data.email}'`. If no result, immediately tries to create with DisplayName=data.name. No fallback lookup by name. No error 6240 handling.
expecting: Fix catches the 6240 error (or proactively queries by DisplayName before creating) and returns the existing customer.
next_action: Apply fix - add DisplayName fallback query before create, AND catch 6240 error as a second safety net.

## Symptoms

expected: Invoice creation should succeed - find the existing QuickBooks customer by email, or create one if not found, then create the invoice.
actual: QuickBooks API returns 400 "Duplicate Name Exists Error" (code 6240). Flow: 1) Query by email (lufepires@icloud.com) 2) No match found 3) Try CREATE 4) QB rejects because DisplayName already exists.
errors: [QuickBooks] API Error 400: {"Fault":{"Error":[{"Message":"Duplicate Name Exists Error","Detail":"The name supplied already exists. : null","code":"6240"}],"type":"ValidationFault"}}
reproduction: Create an invoice for customer with email lufepires@icloud.com who already exists in QuickBooks with the same DisplayName but different/no email address in QB.
started: 2026-03-16 (production issue)

## Eliminated

- hypothesis: Bug is somewhere in the invoice creation payload
  evidence: Error is thrown from getOrCreateCustomer before any invoice creation happens; the error is specifically on the POST /customer call
  timestamp: 2026-03-16T00:00:00Z

## Evidence

- timestamp: 2026-03-16T00:00:00Z
  checked: lib/services/quickbooks.service.ts lines 360-431 (getOrCreateCustomer method)
  found: Line 374 queries ONLY by PrimaryEmailAddr. If no match, goes straight to POST /customer with DisplayName=data.name (line 383). No second lookup by DisplayName. No catch for error code 6240.
  implication: Any QB customer that has no email or a different email in QB will NOT be found by the query, causing a 6240 duplicate name error on create.

- timestamp: 2026-03-16T00:00:00Z
  checked: request() method error handling (lines 186-193)
  found: Non-OK responses throw a generic error with status and responseText. The responseText contains the QB Fault JSON with code 6240. There is no inspection of responseText to detect 6240 specifically.
  implication: The fix must either (a) parse the error code from responseText in getOrCreateCustomer, OR (b) add a proactive fallback query by DisplayName before attempting create.

- timestamp: 2026-03-16T00:00:00Z
  checked: QB API behavior
  found: QB uniqueness is on DisplayName (not email). Email field is optional and not unique. A customer created manually in QB UI may have no email or a different email.
  implication: The fix should use a two-phase lookup: first by email, then by DisplayName. Plus a catch-on-6240 fallback for race conditions.

## Resolution

root_cause: getOrCreateCustomer in quickbooks.service.ts only queries by PrimaryEmailAddr. When a QB customer exists with the same DisplayName but different/missing email, the email query returns no results and the subsequent create call fails with error 6240 (Duplicate Name Exists Error). There is no fallback to query by DisplayName and no error handling for code 6240.

fix: Rewrote getOrCreateCustomer as a four-phase strategy: (1) query by PrimaryEmailAddr (existing), (2) query by DisplayName when email misses — prevents the 6240 in the normal case, (3) create new customer if both queries miss, (4) catch 6240 error by parsing QB Fault JSON and falling back to DisplayName query — handles race conditions. TypeScript compiles cleanly (tsc --noEmit exits 0).

verification: TypeScript clean. Awaiting human confirmation that invoice creation for lufepires@icloud.com now succeeds without 6240 error.
files_changed:
  - lib/services/quickbooks.service.ts

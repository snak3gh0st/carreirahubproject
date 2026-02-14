---
status: testing
phase: 06-pipedrive-integration-respecting-the-whole-workflow-of-the-hub
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md]
started: 2026-02-09T13:50:00Z
updated: 2026-02-09T13:50:00Z
---

## Current Test

number: 1
name: Pipedrive Person → Hub Lead Creation
expected: |
  When a new person is created in Pipedrive (without a matching QuickBooks customer), the Hub should automatically create a Lead with source "PIPEDRIVE". Check in the Hub dashboard under Leads — the person should appear as a Lead with their Pipedrive data (name, email, phone).
awaiting: user response

## Tests

### 1. Pipedrive Person → Hub Lead Creation
expected: When a new person is created in Pipedrive (without a matching QuickBooks customer), the Hub should automatically create a Lead with source "PIPEDRIVE". Check Leads page — person should appear as a Lead.
result: [pending]

### 2. Pipedrive Person with QB Customer → Customer Linking
expected: When a person is created in Pipedrive whose email already matches an existing QuickBooks customer, the Hub should link them (update the customer's pipedrive_id) rather than creating a duplicate Lead or Customer.
result: [pending]

### 3. Deal Won Webhook — No Invoice Created
expected: When a deal is marked as "won" in Pipedrive, the Hub should NOT create an invoice. It should only update the Hub's deal status to match Pipedrive. Verify no new invoice appears in the Invoices page after winning a deal in Pipedrive.
result: [pending]

### 4. Customer Creation → Dual Sync (QB + Pipedrive)
expected: When creating a new customer in the Hub dashboard, the customer should sync to BOTH QuickBooks and Pipedrive. After creation, the response or customer detail should show synced systems. Check Pipedrive — a new Person should appear with matching name/email/phone.
result: [pending]

### 5. Invoice Creation → Pipedrive Deal Update
expected: When creating an invoice for a customer who has a Pipedrive person linked, a Pipedrive deal should be auto-created (or updated if one exists) with the invoice amount. Check Pipedrive — a deal should appear with the correct value. The invoice creation API response should not be delayed by the Pipedrive sync (fire-and-forget).
result: [pending]

### 6. First Invoice Only Creates Deal (Installments)
expected: When creating installment invoices (e.g., 6-month plan), only the first invoice (ending in -001) should create a Pipedrive deal. Subsequent installments should NOT create duplicate deals. Verify in Pipedrive that only one deal exists for the series.
result: [pending]

### 7. Contract Signed → Deal Marked as Won in Pipedrive
expected: When a DocuSign contract is signed (envelope completed), the linked Pipedrive deal should automatically be marked as "WON". Check the deal status in Pipedrive — it should change from open to won.
result: [pending]

### 8. Contract Signed → Commercial User Notification
expected: When a contract is signed, a notification record should be created for the commercial user (deal owner). Check the database Notification table — a record with type CONTRACT_SIGNED should exist with the deal owner as recipient.
result: [pending]

### 9. Graceful Degradation — Pipedrive Unavailable
expected: If Pipedrive API is unavailable or returns errors during customer creation or invoice sync, the operation should still succeed (customer created in QB, invoice created). The response should indicate Pipedrive sync failed but not block the main operation. Check IntegrationLog for error entries.
result: [pending]

### 10. Webhook Loop Prevention
expected: When the Hub updates a deal in Pipedrive (e.g., after invoice creation), the Pipedrive webhook should NOT trigger a loop back to the Hub. The 5-second debounce on lastPipedriveSyncAt should prevent infinite loops. Verify no duplicate processing in IntegrationLog.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]

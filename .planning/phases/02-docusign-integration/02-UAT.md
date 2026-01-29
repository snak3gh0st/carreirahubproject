---
status: testing
phase: 02-docusign-integration
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-01-27T17:30:00Z
updated: 2026-01-27T17:30:00Z
---

## Current Test

number: 4
name: Contract List Page Access
expected: |
  Finance team can access /dashboard/contracts to see a list of all contracts with status filter chips (All, Draft, Pending, Viewed, Signed, Declined, Voided, Expired). Each contract shows envelope ID, customer name, status, created date, and reminder count. Search works by customer name/email. Pagination displays Previous/Next buttons.
awaiting: user response

## Tests

### 1. DocuSign Webhook Security
expected: When a DocuSign webhook arrives, the system verifies the HMAC-SHA256 signature before processing. Invalid signatures return 401 Unauthorized. Valid signatures process the event and return 200 OK. Duplicate events (same envelopeId-event-timestamp) are detected and skipped with 200 OK response.
result: skipped
reason: DocuSign webhook not yet configured in DocuSign admin panel

### 2. Template-Based Contract Creation
expected: When creating a contract, if DOCUSIGN_TEMPLATE_ID is configured, the system uses Composite Templates to generate the envelope with customer/invoice data populated in locked text tabs (customer_name, customer_email, invoice_number, amount, due_date, service_description). Falls back to inline PDF if template not configured or fails.
result: pass

### 3. S3 Document Storage
expected: When a DocuSign envelope is marked as "completed", the webhook downloads the combined signed PDF (contract + certificate), uploads it to S3 at contracts/{year}/{envelopeId}.pdf with AES256 encryption, generates a 7-day presigned URL, and updates the Contract record with signedS3Key, signedS3Url, and signedS3UrlExpiresAt fields.
result: skipped
reason: DocuSign not yet fully implemented

### 4. Contract List Page Access
expected: Finance team can access /dashboard/contracts to see a list of all contracts with status filter chips (All, Draft, Pending, Viewed, Signed, Declined, Voided, Expired). Each contract shows envelope ID, customer name, status, created date, and reminder count. Search works by customer name/email. Pagination displays Previous/Next buttons.
result: [pending]

### 5. Contract Detail Page
expected: Clicking a contract from the list opens /dashboard/contracts/[id] showing contract details (envelope ID, dates, reminders), customer information, invoice information, and deal information. For signed contracts, a Download button is visible. For pending contracts, a Resend Reminder button is visible.
result: [pending]

### 6. Download Signed Contract
expected: Clicking the Download button on a signed contract either uses the existing presigned URL (if valid) or regenerates a new 7-day presigned URL (if expired). The download URL opens the signed PDF from S3. If S3 is not configured, falls back to DocuSign envelope URI.
result: [pending]

### 7. Resend Contract Reminder
expected: Clicking "Resend Reminder" on a pending contract calls DocuSign API to send another email reminder to the signer. The action is logged to IntegrationLog with service=DOCUSIGN, action=RESEND_REMINDER, and includes the user's email. The reminder count increments in the Contract record.
result: [pending]

### 8. Sidebar Navigation
expected: The Finance section of the dashboard sidebar shows a "Contracts" link (with FileSignature icon) placed directly after "Invoices". The link is visible to ADMIN and FINANCE roles. Clicking it navigates to /dashboard/contracts.
result: [pending]

## Summary

total: 8
passed: 1
issues: 0
pending: 5
skipped: 2

## Gaps

[none yet]

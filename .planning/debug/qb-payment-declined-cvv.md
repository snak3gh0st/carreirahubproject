---
status: investigating
trigger: "A client (heliodcf@gmail.com) tried to pay a $300 QuickBooks invoice via the QuickBooks payment link (connect.intuit.com) but the payment was declined. The bank told the client the system isn't properly identifying the 3 security numbers (CVV), causing the processing to be declined."
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T02:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: MOST LIKELY — The hosted QuickBooks payment link is valid and the decline is happening at Intuit/issuer verification time (CVV/AVS/ZIP/international-card rules), not because the payment link is outdated and not because our app failed to create the invoice.
test: Reconcile the new screenshot and client report against Intuit support guidance for hosted invoice payments, declined cards, and Merchant Service Center processing constraints
expecting: If the invoice loads at connect.intuit.com with the correct amount, the link itself is valid; remaining likely causes are processor-side verification/issuer decline, with international or billing-data mismatch now more likely than a broken link
next_action: REPORT — Tell operator the screenshot rules out an outdated/broken link, advise checking Merchant Service Center transaction decline details and trying ACH or a different card/billing profile while escalating to Intuit Payments support

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Client pays $300 QuickBooks invoice successfully via the payment link on connect.intuit.com
actual: Payment is declined with "Your $300.00 payment didn't go through" error message
errors: QuickBooks payment page shows "Your $300.00 payment didn't go through - Review your payment and billing details for accuracy and try again, call the number on the back of your card, or try a different payment method." The client's bank says the system is not identifying the CVV (3 security numbers) properly, causing the decline.
reproduction: Client tried multiple times from mobile phone and desktop computer, same result
started: March 30, 2026, client reported via WhatsApp

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: QUICKBOOKS_ENVIRONMENT is "sandbox" (sandbox transactions are always fake/declined)
  evidence: .env.local and .env.local.vercel both set QUICKBOOKS_ENVIRONMENT="production" — confirmed correct
  timestamp: 2026-03-30T01:00:00Z

- hypothesis: Invoice creation code missing AllowOnlineCreditCardPayment flag
  evidence: Both createInvoice() and createInvoiceWithBillEmail() in quickbooks.service.ts explicitly set AllowOnlineCreditCardPayment: true, AllowOnlineACHPayment: true. Code is correct.
  timestamp: 2026-03-30T01:00:00Z

- hypothesis: Customer has no QuickBooks ID mapping
  evidence: Customer heliodcf@gmail.com has quickbooks_id = "1487" — properly mapped
  timestamp: 2026-03-30T01:00:00Z

- hypothesis: Invoice itself was not created in QuickBooks (so payment link points to nothing)
  evidence: Invoice records show quickbooks_invoice_id values (17256, 17257, 17258, 17259, 17260) — all created successfully in QB. The $300 invoice is QB ID 17256.
  timestamp: 2026-03-30T01:00:00Z

- hypothesis: The payment link is outdated/broken, so the invoice cannot really be paid
  evidence: New screenshot shows the hosted page at connect.intuit.com loading the correct live invoice amount ($300.00) and returning a post-submit decline banner, which means the link resolved to an active payment session rather than an invalid or stale invoice URL.
  timestamp: 2026-03-30T02:00:00Z

- hypothesis: This is a browser/device-only problem on the customer's side
  evidence: Customer reproduced the same decline on phone and computer, and the hosted page loads successfully before failing only at payment authorization time.
  timestamp: 2026-03-30T02:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-30T01:00:00Z
  checked: QUICKBOOKS_ENVIRONMENT in .env.local and .env.local.vercel
  found: Both files set QUICKBOOKS_ENVIRONMENT="production"
  implication: Environment mismatch hypothesis eliminated

- timestamp: 2026-03-30T01:00:00Z
  checked: quickbooks.service.ts createInvoiceWithBillEmail() method (lines 989-991)
  found: AllowOnlineCreditCardPayment: true, AllowOnlineACHPayment: true, AllowOnlinePayPalPayment: true are all set on every invoice
  implication: Code-level payment configuration is correct; CVV handling is entirely within QB Payments portal

- timestamp: 2026-03-30T01:00:00Z
  checked: Customer record for heliodcf@gmail.com in database
  found: Customer exists, quickbooks_id="1487", metadata shows QB balance of $2700, last synced 2026-02-05
  implication: Customer is properly linked. The $2700 balance suggests multiple unpaid invoices.

- timestamp: 2026-03-30T01:00:00Z
  checked: Invoice records for this customer
  found: 5 invoices of $300 each (QB IDs 17256–17260), all status SENT, all amountPaid=0, due dates Feb–Jun 2026. The one client is trying to pay is QB 17256 (due Feb 28, already overdue since March 30).
  implication: Invoice is real and active in QB. The payment link is valid.

- timestamp: 2026-03-30T01:00:00Z
  checked: Integration logs (last 7 days)
  found: Multiple "Object Not Found" errors for other invoices — QB API is returning 400 for several invoice GETs. Circuit breaker opened at least once today. This suggests a possible token/auth issue with QB API, but it's a separate problem from the CVV decline.
  implication: The CVV decline is NOT caused by our integration errors — those are email-send failures, not payment processing failures. The payment portal at connect.intuit.com is independent of our API.

- timestamp: 2026-03-30T01:00:00Z
  checked: QuickBooks Payments CVV flow
  found: connect.intuit.com is QB's own hosted payment page. CVV validation, card processing, and fraud checks are entirely managed by Intuit's payment infrastructure. We have NO code running at payment time on their portal.
  implication: "System not identifying CVV" means QB Payments is either: (a) misconfigured to not require/validate CVV, causing issuing bank to decline; (b) sending incomplete CVV data to card networks; or (c) a fraud/velocity block at Intuit's level.

- timestamp: 2026-03-30T02:00:00Z
  checked: User screenshot of connect.intuit.com hosted payment page
  found: The page loads the correct invoice and amount ($300.00) and only then shows "Your $300.00 payment didn't go through."
  implication: The payment link is not outdated in the sense of pointing to a missing/invalid invoice. Failure is occurring during payment authorization/verification after the invoice is already loaded.

- timestamp: 2026-03-30T02:00:00Z
  checked: Intuit article "Fix payment errors for customers paying invoices online"
  found: Intuit says that when the payment link works but the transaction won't process, focus should move to card/account validity, payment amount, browser, or partial payment troubleshooting rather than invoice-link generation.
  implication: This aligns with the screenshot: online invoice delivery is working, but card authorization is not.

- timestamp: 2026-03-30T02:00:00Z
  checked: Intuit article "Fix customer's declined credit card payments"
  found: Intuit lists incorrect verification code, billing data issues, authorization problems, and card-specific restrictions as common causes of declines; if unresolved, they advise another payment method or contacting the card company.
  implication: The bank's CVV explanation is plausible, but it points to payment-network verification, not our invoice-link code.

- timestamp: 2026-03-30T02:00:00Z
  checked: Intuit article "Process payments in the Merchant Service Center"
  found: Intuit explicitly notes QuickBooks Payments requires a US ZIP code when processing a card and advises cardholders using international cards to contact their bank.
  implication: If this customer is paying with a non-US card/billing profile, AVS/ZIP/international-card validation is a strong alternative explanation for the decline and fits the repeated cross-device failures better than a stale link theory.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The screenshot strengthens the original conclusion that this is not a code bug and not a bad/outdated payment link. The invoice is loading correctly on Intuit's hosted page, so the failure happens later during QuickBooks Payments authorization. The most likely explanations are now: (1) card verification mismatch at Intuit/issuer level (CVV, AVS, billing ZIP/address), especially if the customer is using a non-US or international card; (2) issuer-side decline that the bank summarized as a CVV-identification problem; or (3) a QuickBooks Payments fraud/risk rule on Intuit's side. A generic merchant-account misconfiguration is still possible, but the new evidence makes link staleness unlikely and makes card-verification/international-card constraints the sharper explanation.
fix: No application code change is indicated. Operator actions should be: (1) open Merchant Service Center / payment activity and inspect the exact decline reason for the failed attempts; (2) confirm whether the customer used a US-issued card and matching US billing ZIP/address, since Intuit documents US ZIP requirements for card processing; (3) ask the customer to try ACH or another card if available; (4) if card payment must be used, contact Intuit QuickBooks Payments support with the invoice number, amount, timestamp, and failed attempt details so they can inspect processor-side decline logs.
verification: Reconciled database evidence, hosted-page screenshot, and current Intuit support guidance. New evidence rules out "outdated link" as primary diagnosis and narrows likely cause to Intuit/issuer verification on the hosted payment step.
files_changed: []

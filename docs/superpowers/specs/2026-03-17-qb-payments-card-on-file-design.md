# QuickBooks Payments: Credit Card / ACH On File Auto-Charge

**Date:** 2026-03-17
**Status:** Approved
**Author:** Claude + Paulo

---

## 1. Problem

CarreiraHub sends invoices via QuickBooks. Clients pay manually through the QB portal email link. For installment plans (multiple invoices), each payment requires the client to act manually. After the first payment, QuickBooks stores the client's payment method (credit card or ACH bank account) on file. There is no mechanism to automatically charge subsequent invoices using the stored payment method.

Additionally, Stripe is currently integrated as a payment processor but is no longer needed — all payments flow through QuickBooks.

## 2. Solution

Two changes:

1. **Remove Stripe from payment flow** — stop creating Stripe payment links, checkout sessions, and payment intents. Payments are exclusively via QuickBooks.
2. **Auto-charge via QB Payments API** — a daily cron job checks for invoices due today. If the customer has a payment method on file in QB, the system charges it automatically. If not, the invoice is sent by email as usual (no change).

## 3. Scope

### In Scope
- QB Payments API integration (cards + bank accounts + eChecks)
- Daily cron job for auto-charging invoices due today
- Retry logic: 3 attempts (day 0, day +1, day +3)
- Operator notification on charge failure
- Remove Stripe from active payment flows

### Out of Scope
- Charging OVERDUE invoices (future decision)
- New UI for card management (cards managed directly in QB)
- Card tokenization / capture UI (not needed — QB stores on first manual payment)
- Stripe code deletion (keep files, remove usage from active flows)

## 4. Architecture

### 4.1 QB Payments API Layer

The QB Payments API uses a **different base URL** from the Accounting API but shares the **same OAuth tokens**.

| Environment | Accounting API | Payments API |
|-------------|---------------|--------------|
| Sandbox | `https://sandbox-quickbooks.api.intuit.com/v3/company/{id}` | `https://sandbox.api.intuit.com/quickbooks/v4/payments/` |
| Production | `https://quickbooks.api.intuit.com/v3/company/{id}` | `https://api.intuit.com/quickbooks/v4/payments/` |

**New private method in `quickbooks.service.ts`:**

```typescript
private paymentsBaseUrl: string; // set in constructor based on QUICKBOOKS_ENVIRONMENT

private async paymentsRequest(endpoint: string, options: RequestInit = {}): Promise<any>
// Same pattern as existing request() but uses paymentsBaseUrl
// Same auth token, same refresh logic, same circuit breaker
```

**New public methods:**

| Method | QB Payments Endpoint | Description |
|--------|---------------------|-------------|
| `getCustomerCards(qbCustomerId: string)` | `GET /customers/{id}/cards` | List stored credit/debit cards |
| `getCustomerBankAccounts(qbCustomerId: string)` | `GET /customers/{id}/bank-accounts` | List stored bank accounts |
| `getCustomerPaymentMethods(qbCustomerId: string)` | Combines cards + bank accounts | Returns all payment methods on file |
| `chargeCard(params)` | `POST /charges` | Charge a stored card |
| `chargeBankAccount(params)` | `POST /echecks` | Charge via ACH/eCheck |
| `getCharge(chargeId: string)` | `GET /charges/{id}` | Check charge status |
| `getEcheck(echeckId: string)` | `GET /echecks/{id}` | Check eCheck status |

### 4.2 Auto-Charge Cron Job

**New route:** `app/api/cron/auto-charge-invoices/route.ts`

**Schedule:** Daily at 01:00 UTC (9:00 PM EST previous day) — runs BEFORE overdue-invoices cron (02:00 UTC) and QB token refresh (02:00 UTC) to prevent race conditions where invoices get marked OVERDUE before auto-charge attempts.

**Batch size:** Process max 20 invoices per cron invocation to stay within Vercel function timeout (60s Pro plan). If more invoices are pending, remaining are picked up on next invocation.

**Logic:**

```
1. Query invoices:
   - dueDate = today AND status IN (SENT) AND autoChargeStatus IS NULL
   - OR autoChargeStatus = "retry_pending" AND nextAutoChargeRetry <= today AND autoChargeAttempts < 3
   - LIMIT 20 (batch size)
2. For each invoice:
   a. Get customer.quickbooks_id
   b. If no quickbooks_id → skip, set autoChargeStatus = "skipped"
   c. Call getCustomerPaymentMethods(qbCustomerId)
   d. If no payment method on file → skip, set autoChargeStatus = "skipped"
   e. If has payment method (priority: card > bank account):
      - Generate deterministic Request-Id: "auto-charge-{invoiceId}-{attemptNumber}" (idempotency)
      - Card → chargeCard(cardId, invoice amount, "USD", invoiceRef, requestId)
      - Bank account (if no card) → chargeBankAccount(bankAccountId, invoice amount, "USD", invoiceRef, requestId)
   f. On success:
      - Create Payment in QB Accounting (modified createPayment — see Section 4.4)
      - Update local Invoice: status=PAID, amountPaid, paidAt, paymentMethod, autoChargeStatus="charged"
      - Update customer balance (existing updateCustomerBalance)
      - Log success to IntegrationLog
   g. On failure:
      - Increment autoChargeAttempts
      - Set lastAutoChargeError
      - Set lastAutoChargeAt
      - Calculate nextAutoChargeRetry (+1 day for attempt 1, +3 days for attempt 2)
      - If attempts >= 3: autoChargeStatus = "failed"
      - Else: autoChargeStatus = "retry_pending"
      - Log error to IntegrationLog
      - Operator sees failure in dashboard integration logs
```

**PARTIALLY_PAID invoices:** Skipped by auto-charge. Partial payments indicate manual intervention and should remain manual.

### 4.3 Modifications to Existing Methods

**`createPayment()` update:** The existing method hardcodes `PrivateNote: "Stripe Payment: ..."`. This must be updated to accept a `source` parameter:
- `source: "auto_charge"` → PrivateNote: `"QB Payments Auto-Charge: {chargeId}"`
- `source: "stripe"` → PrivateNote: `"Stripe Payment: {referenceNumber}"` (backward compat)
- `source: "manual"` → PrivateNote: `"Manual Payment: {referenceNumber}"`

### 4.4 Idempotency via Request-Id

The QB Payments API requires a unique `Request-Id` header on `POST /charges` and `POST /echecks` for idempotency. To prevent double-charging on retries (e.g., network timeout where charge actually succeeded):

- Format: `auto-charge-{invoiceId}-{attemptNumber}` (deterministic)
- Stored in `autoChargePaymentRef` field before the charge attempt
- If the same Request-Id is sent twice, QB Payments returns the original response instead of creating a duplicate charge

### 4.5 Retry Schedule

| Attempt | When | On Failure |
|---------|------|-----------|
| 1 | Due date (day 0) | Retry in 1 day |
| 2 | Day +1 | Retry in 2 more days |
| 3 | Day +3 | Mark as "failed", stop retrying |

After 3 failed attempts, the invoice stays in its current status (SENT/OVERDUE) for manual collection.

## 5. Data Model Changes

### New Prisma enum:

```prisma
enum AutoChargeStatus {
  CHARGED
  RETRY_PENDING
  FAILED
  SKIPPED
}
```

### Invoice table — new fields:

```prisma
autoChargeAttempts    Int               @default(0)
lastAutoChargeAt      DateTime?
lastAutoChargeError   String?
autoChargeStatus      AutoChargeStatus?
nextAutoChargeRetry   DateTime?
autoChargePaymentRef  String?           // QB Payments chargeId or echeckId
```

### Migration strategy for existing invoices:
- New invoices: `autoChargeStatus` defaults to `null` (cron treats null as eligible for first attempt)
- Existing PAID invoices: no change needed (cron filters by status=SENT only)
- Existing OVERDUE invoices: no change (out of scope for auto-charge)

### No changes to Customer table
Payment methods are stored in QB, not locally. The system queries QB Payments API on demand.

### Stripe fields on Invoice and Customer
Kept for historical data. No new Stripe fields added.

## 6. Stripe Removal

### Files modified (remove Stripe usage):
- `app/api/invoices/create/route.ts` — remove Stripe payment link creation after invoice
- `lib/services/payment-workflow.service.ts` — remove `sendPaymentLinkAfterSignature()`, `resendPaymentLink()`, and Stripe-related methods. Update `sendPaymentReminders()` to remove Stripe payment link filter (`stripePaymentLinkId: { not: null }`) — reminders should now work for all unpaid invoices regardless of Stripe link presence, pointing to QB portal instead.
- `app/api/invoices/[id]/send-payment-link/route.ts` — deprecate or remove endpoint
- Cron jobs that send Stripe payment reminders — remove Stripe link references

### Files NOT modified:
- `lib/services/stripe.service.ts` — keep file, stop importing/calling it
- Prisma schema Stripe fields — keep for historical data
- Stripe webhook handlers — can be removed but low priority

## 7. Vercel Cron Configuration

Add to `vercel.json`:

```json
{
  "path": "/api/cron/auto-charge-invoices",
  "schedule": "0 1 * * *"
}
```
(01:00 UTC — runs before overdue-invoices at 02:00 UTC and payment-reminders at 10:00 UTC)

**Cron execution order (relevant):**
1. `01:00 UTC` — **auto-charge-invoices** (new)
2. `02:00 UTC` — overdue-invoices (marks unpaid past-due as OVERDUE)
3. `02:00 UTC` — refresh-quickbooks-token
4. `10:00 UTC` — payment-reminders (sends reminders for unpaid invoices)

## 8. Error Handling

| Scenario | Action |
|----------|--------|
| QB Payments API unreachable | Circuit breaker trips, skip all charges, retry next day |
| Card declined | Log error, schedule retry per retry schedule |
| Insufficient funds | Same as card declined |
| Expired card | Log error, mark as failed after 3 attempts |
| QB OAuth token expired | Auto-refresh (existing logic), retry charge |
| Customer has no QB ID | Skip invoice, log warning |
| QB Payments not enabled on account | First API call will fail, log error, operator must enable |

## 9. Integration Logging

All operations logged to `IntegrationLog`:

| Service | Action | Status |
|---------|--------|--------|
| `quickbooks_payments` | `auto_charge_card` | SUCCESS / ERROR |
| `quickbooks_payments` | `auto_charge_ach` | SUCCESS / ERROR |
| `quickbooks_payments` | `get_payment_methods` | SUCCESS / ERROR |
| `quickbooks_payments` | `charge_retry` | SUCCESS / ERROR |

## 10. Prerequisites

- **QuickBooks Payments must be active** on the QB account
- Same OAuth app/tokens work for both Accounting and Payments API
- No new environment variables needed
- No new npm packages needed (uses native fetch like existing QB integration)

## 11. Known Limitations

- **ACH settlement delay:** ACH/eCheck charges take 3-5 business days to settle and can fail after initial acceptance (NSF, account closed). The system marks the invoice as PAID on initial charge acceptance. If an ACH charge later fails, it would need to be handled manually via QB. Future enhancement: poll charge status for ACH payments.
- **autoChargePaymentRef vs quickbooks_payment_id:** The `autoChargePaymentRef` stores the QB Payments charge/echeck ID. The `quickbooks_payment_id` on the Payment model stores the QB Accounting payment ID. These are different IDs from different QB APIs.

## 12. Success Criteria

1. Invoices due today with payment method on file are charged automatically
2. Invoices due today without payment method on file continue receiving email (no change)
3. Failed charges retry on day +1 and day +3
4. Operator can see charge successes/failures in IntegrationLog
5. Payments created in QB Accounting are linked to the correct invoice
6. Stripe payment links are no longer created for new invoices
7. Existing historical Stripe data is preserved

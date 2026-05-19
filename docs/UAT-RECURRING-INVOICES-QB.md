# UAT: Recurring Invoices with Progressive QuickBooks Publishing

This UAT validates the new recurring-invoice model where:

- only the first invoice is created in QuickBooks immediately
- future installments remain local until the QuickBooks publish window
- future installments can be edited before QuickBooks creation
- the scheduled send cron handles QuickBooks creation and/or email delivery later

## Safety First

Do not run this UAT against a shared production customer.

Current repository risk:

- local env files in this checkout point to shared infrastructure
- QuickBooks auth can be loaded from `system_config` in the database

Minimum safe setup before running:

1. Use a dedicated test customer email you control.
2. Confirm the customer has no active real invoices that could confuse the test.
3. Confirm the QuickBooks company/environment is the intended test target.
4. Confirm the cron will be triggered manually, not by waiting for production timing.
5. Have a cleanup plan ready for created invoices.

## Preconditions

- App running locally: `npm run dev`
- Admin or Finance login available
- Dedicated test customer created in Hub
- QuickBooks integration authenticated for the intended environment
- One valid QuickBooks service item available in invoice creation

Recommended evidence to capture during UAT:

- invoice IDs from Hub
- QuickBooks invoice IDs
- screenshots of invoice list/detail pages
- cron response payloads
- timestamps of sends

## Test Data

Use a recurring series with 3 invoices:

- Installment 1 due date: today or tomorrow
- Installment 2 due date: 6 days from now
- Installment 3 due date: 4 days from now

This single series covers both cron windows:

- installment 2 should hit `create_only`
- installment 3 should hit `create_and_send`

## Scenario 1: Create a recurring series with custom dates

Goal:

- verify only the first invoice is created in QuickBooks immediately
- verify future installments are stored locally as drafts

Steps:

1. Open `/dashboard/invoices/new`
2. Select the dedicated test customer
3. Create a recurring package with 3 invoices
4. Set custom dates per invoice:
   - invoice 1: today or tomorrow
   - invoice 2: now + 6 days
   - invoice 3: now + 4 days
5. Submit the form
6. Open the created invoice series in the dashboard

Expected results:

- invoice 1 is `SENT`
- invoice 2 and 3 are `DRAFT`
- invoice 1 has `quickbooks_invoice_id`
- invoice 2 and 3 have `quickbooks_invoice_id = null`
- invoice 2 and 3 carry installment metadata with `publishStrategy = WINDOWED_QB_CREATE`
- only invoice 1 exists in QuickBooks immediately

Evidence points:

- dashboard invoice detail page
- QuickBooks company invoice list
- local DB values for `status`, `quickbooks_invoice_id`, `installments`

## Scenario 2: Edit a future installment before QuickBooks creation

Goal:

- verify future local installments are editable before publication

Steps:

1. Open invoice 2 from the created series
2. Enter edit mode
3. Change due date
4. Change line items
5. Confirm total amount changes accordingly
6. Save
7. Reload the invoice detail page

Expected results:

- save succeeds
- updated due date persists
- updated line items persist
- `amount` equals the sum of edited line items
- `quickbooks_invoice_id` remains `null`
- no QuickBooks invoice is created yet

Negative check:

- editing a `PAID` or `VOID` invoice must be blocked

## Scenario 3: Future installments stay out of approval noise

Goal:

- verify future local installments do not appear as pending approval work

Steps:

1. Open `/dashboard/invoices/approval-queue`
2. Check whether invoice 2 and 3 appear there
3. Check relevant admin alert surfaces if used by your team

Expected results:

- invoice 2 and 3 do not appear in the approval queue
- they do not generate “pending approval” operational noise

## Scenario 4: Cron creates QuickBooks invoice but does not send yet

Target installment:

- invoice 2 with due date at `now + 6 days`

Goal:

- verify the cron creates the QuickBooks invoice in the publish window
- verify it does not email the customer yet

Steps:

1. Confirm invoice 2 is still `DRAFT` and has no `quickbooks_invoice_id`
2. Trigger the cron manually through the admin cron runner or the cron route
3. Reload invoice 2 detail page
4. Check QuickBooks for the new invoice

Expected results:

- invoice 2 transitions from `DRAFT` to `SENT`
- invoice 2 receives `quickbooks_invoice_id`
- invoice 2 may receive `quickbooks_invoice_link`
- `emailSentAt` remains `null`
- no customer email is sent yet

Go/no-go note:

- if the invoice is created and emailed immediately at 6 days out, the window logic failed

## Scenario 5: Cron creates and sends when inside send window

Target installment:

- invoice 3 with due date at `now + 4 days`

Goal:

- verify the cron creates the QuickBooks invoice and sends the email in the send window

Steps:

1. Confirm invoice 3 is still `DRAFT` and has no `quickbooks_invoice_id`
2. Trigger the cron manually
3. Reload invoice 3 detail page
4. Check QuickBooks for the invoice
5. Check the recipient inbox

Expected results:

- invoice 3 transitions from `DRAFT` to `SENT`
- invoice 3 receives `quickbooks_invoice_id`
- invoice 3 receives or refreshes `quickbooks_invoice_link`
- `emailSentAt` is populated
- customer receives the QuickBooks invoice email

## Recommended Verification Queries

Use Prisma Studio or direct SQL to verify the three invoices in the series.

Fields to inspect:

- `invoiceNumber`
- `status`
- `dueDate`
- `amount`
- `quickbooks_invoice_id`
- `quickbooks_invoice_link`
- `emailSentAt`
- `emailSendAttempts`
- `lastEmailSendError`
- `installments`

## Cleanup

After UAT:

1. Void test invoices in QuickBooks if they were created
2. Remove or archive the local test invoices
3. Keep the captured evidence in the rollout ticket

If cleanup is done locally through the app:

- only Admin/Finance should perform it
- confirm whether delete also voids the QuickBooks invoice first

## Release Gate

Ready for production only if all are true:

- scenario 1 passes
- scenario 2 passes
- scenario 3 passes
- scenario 4 passes
- scenario 5 passes
- no unexpected approval alerts appear
- no wrong customer receives an invoice email
- no extra future installments are created in QuickBooks ahead of time

Not ready for production if any are true:

- future installments appear as normal approval drafts
- a future installment creates too early outside the publish window
- a 6-day installment sends email too early
- a 4-day installment fails to send
- edited future installment data diverges between local record and later QuickBooks creation

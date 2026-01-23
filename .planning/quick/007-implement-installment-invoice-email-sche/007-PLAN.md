---
quick: 007
type: execute
autonomous: true
files_modified:
  - app/api/invoices/route.ts
  - app/api/cron/send-scheduled-invoices/route.ts
  - vercel.json
  - lib/services/invoice-approval.service.ts
---

<objective>
Implement installment invoice email scheduling with 5-day pre-send logic.

**Current Behavior:**
- All approved invoices sent to QB immediately upon approval (including all installments)
- Existing cron job uses 3-day window for scheduled sending
- No distinction between first installment and subsequent installments

**Target Behavior:**
- First installment: Send to QB immediately with email (existing flow)
- Subsequent installments: Create as DRAFT in QB (no email)
- Daily cron job: Check for installment invoices with dueDate 5 days away → send email
- Finance team can create installment plans knowing only the first invoice emails immediately

**Why:** Prevents customer confusion from receiving multiple invoice emails at once. Installments should only email when approaching due date (5 days prior).
</objective>

<execution_context>
@~/.config/Claude/get-shit-done/workflows/execute-plan.md
@~/.config/Claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@prisma/schema.prisma
@app/api/invoices/route.ts
@app/api/cron/send-scheduled-invoices/route.ts
@lib/services/invoice-approval.service.ts
@lib/services/quickbooks.service.ts
</context>

<tasks>

<task type="auto">
  <name>Add installment tracking to Invoice creation and QB sync</name>
  <files>
    app/api/invoices/route.ts
    lib/services/invoice-approval.service.ts
  </files>
  <action>
**File 1: app/api/invoices/route.ts (POST handler)**
When creating invoices from request body:
- Detect installment plan creation: Check if `installments` JSON field is present
- If installments exist:
  - Mark first installment: Add `isFirstInstallment: true` to installments[0]
  - Mark remaining installments: Add `isFirstInstallment: false` to installments[1..N]
- Store enhanced installments JSON in Invoice.installments field

**File 2: lib/services/invoice-approval.service.ts (syncApprovedInvoice method, ~line 280-400)**
Modify QB invoice creation logic:
1. Parse installments JSON from invoice record
2. Detect if this is first installment: Check `installments[].isFirstInstallment === true` OR if installments is null/empty (non-installment invoice)
3. For first installment OR non-installment:
   - Keep existing flow: `createInvoice()` + `sendInvoice()` (lines 339-391)
4. For subsequent installments (isFirstInstallment === false):
   - Call `createInvoice()` to create as DRAFT in QB (line 339)
   - **SKIP** `sendInvoice()` call (comment out or wrap in conditional, lines 350-391)
   - Add IntegrationLog entry: "installment_invoice_created_as_draft" with status SUCCESS

**Why:** QuickBooks createInvoice() defaults to DRAFT status unless explicitly sent. By skipping sendInvoice() for subsequent installments, they remain in DRAFT state until the cron job sends them 5 days before due date.
  </action>
  <verify>
1. Create test invoice with installments via POST /api/invoices
2. Approve first installment → Check IntegrationLog for "invoice_email_sent"
3. Approve second installment → Check IntegrationLog for "installment_invoice_created_as_draft" (no email sent log)
4. Query QB API for second invoice → Verify EmailStatus is null or NeedToSend (DRAFT state)
  </verify>
  <done>
- First installment creates QB invoice + sends email immediately
- Subsequent installments create QB invoice WITHOUT sending email
- IntegrationLog differentiates first vs subsequent installment sync
  </done>
</task>

<task type="auto">
  <name>Update cron job to send installment invoices 5 days before due date</name>
  <files>
    app/api/cron/send-scheduled-invoices/route.ts
    vercel.json
  </files>
  <action>
**File 1: app/api/cron/send-scheduled-invoices/route.ts**
Current logic checks for `daysUntilDue <= 3`. Update to:

1. Change threshold from 3 days to 5 days:
   - Line 57: `if (daysUntilDue <= 5)` instead of `<= 3`
   - Line 79: Update skip message to reference 5 days

2. Add installment detection:
   - Parse invoice.installments JSON
   - Detect if this is an installment invoice (installments field is not null)
   - Detect if this is first installment (isFirstInstallment === true)

3. Apply installment-specific logic:
   - If first installment: Skip in cron (already sent during approval)
   - If subsequent installment AND daysUntilDue <= 5: Send via `invoiceApprovalService.syncApprovedInvoice()`
   - If non-installment invoice: Keep existing logic (send if daysUntilDue <= 5)

4. Update logging to distinguish:
   - "scheduled_installment_sent" for subsequent installments
   - "scheduled_invoice_sent" for non-installment invoices
   - "skipped_first_installment" for first installments (already sent)

**File 2: vercel.json**
Currently no cron for send-scheduled-invoices. Add entry:
```json
{
  "path": "/api/cron/send-scheduled-invoices",
  "schedule": "0 9 * * *"
}
```
This runs daily at 9:00 AM UTC to check for invoices due in 5 days.

**Why:** Cron job was missing from vercel.json deployment config. Without this, the scheduled sending logic never executes in production.
  </action>
  <verify>
1. Check vercel.json has send-scheduled-invoices cron entry
2. Manually trigger cron: `curl http://localhost:3000/api/cron/send-scheduled-invoices`
3. Check logs for installment detection logic (first vs subsequent)
4. Create test installment with dueDate = now + 5 days → verify cron sends it
5. Create test installment with dueDate = now + 10 days → verify cron skips it
  </verify>
  <done>
- Cron job checks for invoices due in 5 days (not 3 days)
- First installments skipped by cron (already sent during approval)
- Subsequent installments sent 5 days before due date
- Cron job scheduled daily at 9:00 AM UTC in vercel.json
  </done>
</task>

</tasks>

<verification>
**End-to-End Installment Flow:**
1. Create invoice with 3 installments (due dates: today, today+30, today+60)
2. Approve all 3 installments via dashboard
3. Verify first installment: IntegrationLog shows "invoice_email_sent"
4. Verify installments 2 & 3: IntegrationLog shows "installment_invoice_created_as_draft"
5. Set installment 2 dueDate to today+5 days
6. Trigger cron: `GET /api/cron/send-scheduled-invoices`
7. Verify cron log: "scheduled_installment_sent" for installment 2
8. Verify installment 3: Still skipped (due in 55 days)

**QuickBooks State:**
- Installment 1: EmailStatus = EmailSent, Balance > 0
- Installment 2: EmailStatus = EmailSent (after cron), Balance > 0
- Installment 3: EmailStatus = NeedToSend (DRAFT), Balance > 0
</verification>

<success_criteria>
- First installment in plan sends QB email immediately upon approval
- Subsequent installments create as DRAFT in QB (no email sent)
- Cron job runs daily at 9:00 AM UTC
- Installment invoices email when due date is exactly 5 days away
- IntegrationLog tracks: "invoice_email_sent" (first), "installment_invoice_created_as_draft" (subsequent), "scheduled_installment_sent" (cron)
- Non-installment invoices unaffected (keep existing approval flow)
</success_criteria>

<output>
After completion, create `.planning/quick/007-implement-installment-invoice-email-sche/007-SUMMARY.md`
</output>

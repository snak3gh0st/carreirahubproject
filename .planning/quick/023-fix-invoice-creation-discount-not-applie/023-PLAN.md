---
task: 023
type: quick
title: "Fix invoice creation: discount not applied, billing address missing, email not sent"
files_modified:
  - lib/services/quickbooks.service.ts
  - app/api/invoices/create/route.ts
---

<objective>
Fix three issues with invoice creation in QuickBooks:

1. **Discount not synced**: The Hub calculates discount correctly (total = baseAmount - discount), but QuickBooks receives line items at full price without any discount representation. QuickBooks expects either a DiscountLineDetail line item OR adjusted amounts.

2. **Billing address missing**: Customer has BillAddr when created, but the invoice itself doesn't include BillAddr. QuickBooks invoices should include billing address from the customer for proper invoice rendering.

3. **Email not sent**: The `/send` endpoint may be failing silently. Need to ensure invoice email is actually delivered or provide better error visibility.

Purpose: Finance team needs invoices in QuickBooks to show correct discounted amounts, include customer billing address, and be sent to customers automatically.
Output: Fixed invoice creation with proper discount, billing address, and reliable email delivery.
</objective>

<context>
@lib/services/quickbooks.service.ts (createInvoiceWithBillEmail method - line 437-508)
@app/api/invoices/create/route.ts (invoice creation API - discount calculation and QB sync)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add discount line item and billing address to QB invoice</name>
  <files>
    lib/services/quickbooks.service.ts
    app/api/invoices/create/route.ts
  </files>
  <action>
1. In `quickbooks.service.ts`, modify `createInvoiceWithBillEmail` to accept additional parameters:
   - `discount?: number` - discount amount to apply
   - `billingAddress?: { line1?: string; city?: string; state?: string; postalCode?: string; country?: string }`

2. When building the invoice payload, add:
   a) **Discount line item** (if discount > 0):
      ```typescript
      // Add DiscountLineDetail as last line item
      if (data.discount && data.discount > 0) {
        invoiceData.Line.push({
          Amount: data.discount,
          DetailType: "DiscountLineDetail",
          DiscountLineDetail: {
            PercentBased: false,  // Fixed amount discount
          },
          Description: "Discount applied",
        });
      }
      ```

   b) **BillAddr on invoice** (copy from customer or use provided):
      ```typescript
      if (data.billingAddress) {
        invoiceData.BillAddr = {
          Line1: data.billingAddress.line1 || "",
          City: data.billingAddress.city || "",
          CountrySubDivisionCode: data.billingAddress.state || "",
          PostalCode: data.billingAddress.postalCode || "",
          Country: data.billingAddress.country || "USA",
        };
      }
      ```

3. In `app/api/invoices/create/route.ts`, update the QB invoice creation call:
   - Pass `discount: discountValue` (from form)
   - Fetch customer address from database and pass as `billingAddress`
   - The customer record already has: address, city, state, zipCode, country fields

4. Log the discount and billing address being sent to QuickBooks for debugging.
  </action>
  <verify>
    - Create test invoice with discount via UI
    - Check QuickBooks invoice shows discount as separate line item
    - Check QuickBooks invoice includes billing address
    - Review IntegrationLog for invoice creation entries
  </verify>
  <done>
    - QB invoice includes DiscountLineDetail when discount > 0
    - QB invoice includes BillAddr from customer
    - Invoice total in QB matches Hub total (with discount applied)
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix email sending with better error handling and retry</name>
  <files>
    lib/services/quickbooks.service.ts
    app/api/invoices/create/route.ts
  </files>
  <action>
1. In `quickbooks.service.ts`, enhance `sendInvoice` method:
   - Add retry logic (2 attempts with 1s delay)
   - Log more details about the failure
   - If first attempt fails, try updating BillEmail on invoice then retry send

2. In the invoice creation route, after creating invoice:
   - If `shouldSendEmail` is true and first send fails, update BillEmail explicitly and retry
   - Add explicit check that invoice was created with BillEmail before attempting send
   - Log clear success/failure message with invoice ID and customer email

3. Add a fallback: if QB /send fails after retries, create an IntegrationLog entry with:
   - status: "NEEDS_MANUAL_SEND"
   - Clear message: "Invoice created but email send failed. Manual send required."
   - Link to QB invoice for manual action

4. Ensure the delay before sending is sufficient (increase from 500ms to 1000ms if needed).
  </action>
  <verify>
    - Create invoice and verify email is sent (check IntegrationLog)
    - If send fails, IntegrationLog shows clear "NEEDS_MANUAL_SEND" status
    - Check QB invoice EmailStatus after creation
  </verify>
  <done>
    - Invoices are reliably sent via QB API or clearly marked for manual send
    - IntegrationLog provides visibility into email delivery status
    - No silent failures - all outcomes are logged
  </done>
</task>

</tasks>

<verification>
1. Create invoice with discount:
   - Hub shows correct total (baseAmount - discount)
   - QB invoice shows discount line item
   - QB invoice total matches Hub total

2. Check billing address:
   - QB invoice displays customer billing address
   - Address appears on PDF invoice when downloaded

3. Verify email delivery:
   - IntegrationLog shows "invoice_email_sent" with SUCCESS status
   - OR shows "NEEDS_MANUAL_SEND" with clear next steps
   - No silent failures
</verification>

<success_criteria>
- Discount applied in Hub is reflected in QuickBooks as DiscountLineDetail
- Customer billing address appears on QuickBooks invoice
- Invoice email is sent successfully OR failure is clearly logged
- IntegrationLog provides full audit trail for invoice creation and email
</success_criteria>

<output>
After completion, create `.planning/quick/023-fix-invoice-creation-discount-not-applie/023-SUMMARY.md`
</output>

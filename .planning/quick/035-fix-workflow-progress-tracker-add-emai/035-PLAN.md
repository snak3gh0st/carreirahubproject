# Quick Task 035: Fix Workflow Progress Tracker - Add Email Tracking Fields

## Problem Statement
The workflow progress tracker incorrectly shows "Email Sent" step as pending even when the invoice email was successfully sent via QuickBooks API. This happens because the system relies on `invoice.status === SENT` to determine email status, but status can change (e.g., OVERDUE, PAID) after the email is sent.

## Root Cause Analysis
1. No explicit email tracking fields in Invoice model
2. Email send status inferred from invoice status (unreliable)
3. No tracking of email send attempts or failures
4. No way to distinguish between "email not sent yet" and "email sent but status changed"

## Solution Design

### 1. Add Email Tracking Fields to Invoice Model
Add three new nullable fields to track email sending:
- `emailSentAt: DateTime?` - Timestamp when email was successfully sent
- `emailSendAttempts: Int @default(0)` - Number of send attempts (success or failure)
- `lastEmailSendError: String?` - Most recent error message if send failed

### 2. Update Invoice Creation API
Modify `app/api/invoices/create/route.ts` to set these fields:
- After successful send (~line 414): Set `emailSentAt` and increment `emailSendAttempts`
- After failed send (~line 436): Increment `emailSendAttempts` and set `lastEmailSendError`

### 3. Update Workflow Display Logic
Modify `app/dashboard/invoices/[id]/page.tsx` workflow step (~lines 122-131):
- Change from checking `invoice.status === SENT` to checking `invoice.emailSentAt`
- Show green checkmark when `emailSentAt` is set
- Show gray/pending when `emailSentAt` is null
- Show error state if `lastEmailSendError` exists

## Implementation Steps

### Step 1: Update Prisma Schema
```prisma
model Invoice {
  // ... existing fields ...
  
  // Email tracking
  emailSentAt DateTime?
  emailSendAttempts Int @default(0)
  lastEmailSendError String?
  
  // ... rest of fields ...
}
```

### Step 2: Generate Prisma Client & Push Schema
```bash
npm run db:generate
npm run db:push
```

### Step 3: Update Invoice Creation API
Modify success block (~line 414):
```typescript
// After sendResult.success && sendResult.sent
await prisma.integrationLog.create({ ... });

// NEW: Update email tracking fields
await prisma.invoice.update({
  where: { id: invoice.id },
  data: {
    emailSentAt: new Date(),
    emailSendAttempts: { increment: 1 },
  },
});
```

Modify failure block (~line 436):
```typescript
// After send failed
await prisma.integrationLog.create({ ... });

// NEW: Update email tracking fields
await prisma.invoice.update({
  where: { id: invoice.id },
  data: {
    emailSendAttempts: { increment: 1 },
    lastEmailSendError: sendResult.error || "Unknown error",
  },
});
```

### Step 4: Update Workflow Display
Modify workflow step in `page.tsx`:
```typescript
{
  title: "Email Sent",
  status: invoice.emailSentAt
    ? ("completed" as const)
    : invoice.lastEmailSendError
    ? ("failed" as const)
    : ("pending" as const),
  date: invoice.emailSentAt,
  description: invoice.emailSentAt
    ? `Email sent to ${invoice.customer.email}`
    : invoice.lastEmailSendError
    ? `Failed to send: ${invoice.lastEmailSendError}`
    : "Email will be sent automatically",
}
```

## Backward Compatibility
- All new fields are nullable/optional
- Existing invoices without these fields will show "pending" status (correct behavior)
- No migration required - fields auto-populate on next invoice creation/update
- No breaking changes to existing code

## Testing Checklist
- [ ] Verify schema migration completes without errors
- [ ] Create new invoice and verify `emailSentAt` is set after successful send
- [ ] Create invoice with invalid email and verify `lastEmailSendError` is set
- [ ] View invoice detail page and verify workflow shows green checkmark for sent emails
- [ ] View old invoices (pre-migration) and verify they show pending status (graceful degradation)
- [ ] Verify `emailSendAttempts` increments on both success and failure

## Success Criteria
1. New invoices track email send status accurately
2. Workflow timeline shows correct visual state:
   - Green checkmark when email sent
   - Gray when pending
   - Red when failed
3. Email status persists even when invoice.status changes (SENT → OVERDUE → PAID)
4. Existing invoices continue working without errors

## Files Modified
1. `prisma/schema.prisma` - Add email tracking fields
2. `app/api/invoices/create/route.ts` - Update email tracking after send
3. `app/dashboard/invoices/[id]/page.tsx` - Use emailSentAt for workflow display

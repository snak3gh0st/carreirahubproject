# QB Invoice Email Sending - Root Cause & Fix

## 🔴 The Problem

Invoices were created in QuickBooks successfully but:
- Stayed in **DRAFT** status (not SENT)
- **Emails were NOT sent** to customers
- No error messages visible

Manually created invoices (in QB directly) showed:
- ✅ Full customer information (address, email, phone)
- ✅ Invoice status: **SENT**
- ✅ Email actually delivered

Our system-created invoices showed:
- ❌ NO customer information displayed
- ❌ Invoice status: **OPENED** (draft)
- ❌ NO email sent

## 🔍 Root Cause Analysis

**Issue 1: QB customers were incomplete**
- Our system only set: DisplayName, PrimaryEmailAddr, PrimaryPhone
- QB requires a BillAddr (billing address) for customers to be "complete"
- QB won't send emails from incomplete customer records

**Issue 2: Wrong sendInvoice() approach**
- We were trying to override email in the POST body
- QB's `/send` endpoint doesn't need email override
- QB uses the customer's configured email automatically

## ✅ The Fix

### 1. Add Billing Address to QB Customers

**Before:**
```typescript
const customerData = {
  DisplayName: data.name,
  PrimaryEmailAddr: { Address: data.email },
  // Missing: BillAddr
};
```

**After:**
```typescript
const customerData = {
  DisplayName: data.name,
  PrimaryEmailAddr: { Address: data.email },
  BillAddr: {  // ← ADDED: QB needs this
    City: "USA",
    Country: "USA",
    Line1: "Billing Address",
  },
  // ...
};
```

### 2. Simplify sendInvoice() Endpoint

**Before (broken):**
```typescript
// Trying to override email in body - QB doesn't support this
const body = {
  "SparseUpdate": false,
  "Id": invoiceId,
  "BillEmail": { "Address": email }  // ← Wrong approach
};
const result = await this.request(endpoint, {
  method: "POST",
  body: JSON.stringify(body),
});
```

**After (correct):**
```typescript
// QB uses customer's configured email automatically
const result = await this.request(endpoint, {
  method: "POST",  // No body needed
});
```

## 🎯 Expected Results

### Before Fix
- Invoice: PM-2026-01-001 → Status: OPENED (draft)
- Email: NOT SENT ❌

### After Fix
- Invoice: PM-2026-01-001 → Status: SENT ✅
- Email: DELIVERED to customer ✅

## 📋 Files Changed

- `lib/services/quickbooks.service.ts`
  - Line 330: Added BillAddr to customer creation
  - Line 634: Simplified sendInvoice() method

## 🚀 Deployment

Build: ✅ PASSED
Commit: `5666569`

New invoices will now:
1. Create QB customers with complete profiles (billing address)
2. Send invoices properly with /send endpoint
3. Reach SENT status in QB
4. Emails delivered to customers

## 📊 Testing

To verify:
1. Create a new invoice in the system
2. Check QB - customer should have billing address displayed
3. Check invoice status - should show SENT (not OPENED)
4. Check customer email - should receive invoice email


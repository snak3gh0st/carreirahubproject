# QB Invoice Email Sending - Troubleshooting Summary

## Problem
QB /send endpoint returns 500 NullPointerException regardless of approach:
- With query parameter: `/send?sendTo=email` → 500
- With no parameters: `/send` → 500
- With email in body: `/send` + body `{sendTo: email}` → 500

## What We Verified Works
✅ Invoice creation with BillEmail field set
✅ EmailStatus set to "NeedToSend"
✅ Customer email verified before creation
✅ Billing address on QB customer

## What Doesn't Work
❌ QB /send endpoint throws NullPointerException in Production
❌ All parameter approaches fail
❌ QB API may not support programmatic email sending

## Possible Causes
1. QB Production API bug for this account
2. OAuth scope doesn't include email sending permission
3. /send endpoint requires different field names or structure
4. QB only supports email sending through UI, not API

## Next Steps to Try

### Option 1: Check QB API Documentation
- Verify correct /send endpoint format in QB Developer Portal
- Check if email sending requires different OAuth scopes
- See if there's an EmailDelivery or Mail endpoint

### Option 2: Use QB's Email Delivery Service (if available)
- QB might have separate email service
- Check if there's a `https://quickbooks.api.intuit.com/v3/company/{realmId}/email` endpoint

### Option 3: Contact QB Support
- This 500 NullPointerException suggests QB-side issue
- May need to enable email sending feature in QB account settings
- Or QB Production might have email disabled for your account

### Option 4: Fallback to Manual QB Send
- User manually sends from QB UI after invoice created
- System creates invoice perfectly
- Email field is populated and ready
- User just clicks "Send" in QB

## Current State
- ✅ Invoices created successfully in QB
- ✅ Email field populated correctly
- ✅ Ready for QB to send (manual or via working API)
- ❌ Automated API sending not working due to QB API issue

## Recommendation
1. Check QB API documentation for correct /send format
2. Verify OAuth app has email sending permissions
3. Contact QB Support if /send endpoint is unavailable
4. Implement fallback: user manually sends from QB until QB API works

The invoice creation system is working perfectly - it's the QB /send endpoint that's not functioning.

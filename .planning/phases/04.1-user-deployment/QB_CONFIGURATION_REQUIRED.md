# QuickBooks Configuration Requirements

**Date:** 2026-01-13
**Status:** ⚠️ REQUIRED BEFORE PRODUCTION USE

---

## Issues Found in Production Logs

From integration logs on **carreirausa.sigmaintel.io**:

1. ❌ **QuickBooks access token not configured**
2. ❌ **Webhook secret not configured**
3. ✅ **Dead letter route error** (FIXED - commit `[PENDING]`)

---

## Required Configuration Steps

### 1. QuickBooks OAuth Authentication

**Issue:** "Quickbooks access token not configured"

**Why:** OAuth flow hasn't been completed yet. Access/refresh tokens are stored in database.

**How to Fix:**

1. **Visit OAuth Connect URL:**
   ```
   https://carreirausa.sigmaintel.io/api/quickbooks/auth/connect
   ```

2. **Authorize App:**
   - Click "Connect to QuickBooks"
   - Sign in to your QuickBooks account
   - Authorize "Carreira USA Hub" app
   - You'll be redirected back with success message

3. **Verify Authentication:**
   ```bash
   # Check SystemConfig table
   SELECT quickbooks_is_authenticated, quickbooks_company_id, quickbooks_token_expires_at
   FROM system_config
   WHERE id = 'system';
   ```

   Expected result:
   ```
   quickbooks_is_authenticated: true
   quickbooks_company_id: "123456789" (your QB company ID)
   quickbooks_token_expires_at: [future date]
   ```

4. **Test Connection:**
   - Visit: https://carreirausa.sigmaintel.io/dashboard/integrations
   - Click "Sync Status"
   - Should show QB company info and connected status

**Automatic Token Refresh:**
- Tokens expire after 60 days
- Automatic refresh runs daily at 2 AM UTC (Phase 04-02 implementation)
- If refresh fails, you'll need to re-authorize via OAuth flow

---

### 2. QuickBooks Webhook Secret Configuration

**Issue:** "Webhook secret not configured"

**Why:** Webhook signature validation requires a shared secret from QuickBooks.

**How to Fix:**

**Option A: Via QuickBooks Developer Portal (Recommended)**

1. **Get Webhook Verifier Token from QuickBooks:**
   - Go to: https://developer.intuit.com/app/developer/dashboard
   - Select your app
   - Navigate to "Webhooks" section
   - Copy the "Webhooks Verifier Token"

2. **Add to Database:**
   ```sql
   UPDATE system_config
   SET quickbooks_webhook_secret = 'your-verifier-token-here'
   WHERE id = 'system';
   ```

3. **Or Set Environment Variable:**
   ```bash
   # In Vercel dashboard → Settings → Environment Variables
   QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN=your-verifier-token-here
   ```

**Option B: Temporarily Disable Validation (Development Only)**

⚠️ **NOT RECOMMENDED FOR PRODUCTION**

If you need to test without setting up the secret:
- The code already returns 200 OK even without secret (to prevent external retry storms)
- Webhooks will be logged but signature won't be validated
- Security risk: anyone can send fake webhooks

**Verify Configuration:**
```sql
SELECT quickbooks_webhook_secret
FROM system_config
WHERE id = 'system';
-- Should return: your token (not NULL)
```

**Configure Webhook Endpoint in QB:**

After secret is configured, tell QuickBooks to send webhooks to:
```
https://carreirausa.sigmaintel.io/api/webhooks/quickbooks
```

In QB Developer Portal:
1. Webhooks → Add Webhook
2. Endpoint URL: https://carreirausa.sigmaintel.io/api/webhooks/quickbooks
3. Events: Select Customer, Invoice, Payment (or all events)
4. Save

---

### 3. Dead Letter Route Fix (Already Fixed)

**Issue:** "Dynamic server usage: Route /api/webhooks/dead-letter couldn't be rendered statically"

**Why:** Next.js tried to statically render a route that uses `getServerSession()` (requires request headers)

**Fix Applied:** Added `export const dynamic = 'force-dynamic'` to route

**Commit:** `[PENDING]` - Will be included in next deployment

---

## Post-Configuration Verification

After completing steps 1 & 2, verify everything works:

### 1. Check Integration Logs

Visit: https://carreirausa.sigmaintel.io/dashboard/integrations/sync-status

Should see:
- ✅ No more "access token not configured" errors
- ✅ No more "webhook secret not configured" errors
- ✅ No more dead letter route errors

### 2. Trigger Manual Sync

1. Visit: https://carreirausa.sigmaintel.io/dashboard/integrations
2. Click "Bulk Import" or use API:
   ```bash
   curl -X POST https://carreirausa.sigmaintel.io/api/quickbooks/sync \
     -H "Cookie: your-session-cookie" \
     -H "Content-Type: application/json"
   ```

3. **Check Vercel Logs:**
   ```
   [QuickBooks Sync] Starting customer sync with pagination
   [QuickBooks Sync] Page 1: fetched 14 customers, total: 14, hasMore: true
   [QuickBooks Sync] Page 2: fetched 20 customers, total: 34, hasMore: true
   ...
   ```

4. **Verify Invoice Count:**
   - All invoices should sync (not just 14)
   - Check database: `SELECT COUNT(*) FROM invoices WHERE quickbooks_invoice_id IS NOT NULL;`
   - Should match total in QuickBooks

### 3. Test Webhook Processing

1. **Trigger Test Webhook from QB:**
   - QB Developer Portal → Webhooks → Test
   - Or make a change in QB (create invoice, update customer)

2. **Check Webhook Event Table:**
   ```sql
   SELECT * FROM webhook_events
   WHERE service = 'quickbooks'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

   Should see:
   - `status = 'success'` (processed successfully)
   - No signature validation errors
   - Payload captured

---

## Security Notes

**Webhook Secret:** REQUIRED for production. Without it:
- Anyone can send fake webhooks to your endpoint
- Could trigger unwanted syncs or data corruption
- Signature validation ensures webhooks are from QuickBooks

**OAuth Tokens:** Stored in database, not environment variables
- Tokens refresh automatically (Phase 04-02)
- If manual refresh needed: re-run OAuth flow
- Tokens expire after 60 days

**Access Control:**
- Integrations page: ADMIN and FINANCE roles only
- Webhook endpoints: Public (but signature validated)
- Dead letter queue: ADMIN and OPERATIONAL roles only

---

## Summary

**Before production use, complete:**

1. ✅ Deploy pagination fix (commit `a9aed17`)
2. ✅ Deploy dashboard navigation fix (commit `42ec5a6`)
3. ✅ Deploy dead letter route fix (commit `[PENDING]`)
4. ⏸️ **Run QuickBooks OAuth flow** (visit `/api/quickbooks/auth/connect`)
5. ⏸️ **Configure webhook secret** (update `system_config` or env var)
6. ⏸️ **Register webhook endpoint in QB Developer Portal**
7. ⏸️ **Trigger manual sync** to verify all invoices fetch
8. ⏸️ **Test webhook** to verify signature validation

**After configuration:**
- All Finance-critical data will sync automatically
- Webhooks will be validated and processed reliably
- No more "not configured" errors in logs

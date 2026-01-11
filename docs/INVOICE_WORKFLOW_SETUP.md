# Invoice Workflow Configuration Guide

This document explains how to configure the complete invoice workflow system, including all external integrations and webhooks.

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables](#environment-variables)
3. [Stripe Configuration](#stripe-configuration)
4. [DocuSign Configuration](#docusign-configuration)
5. [Resend (Email) Configuration](#resend-email-configuration)
6. [QuickBooks Configuration](#quickbooks-configuration)
7. [Webhook Endpoints](#webhook-endpoints)
8. [Cron Jobs](#cron-jobs)
9. [Testing the Workflow](#testing-the-workflow)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The invoice workflow follows this process:

```
1. COMMERCIAL creates invoice → Status: DRAFT, Approval: PENDING
2. FINANCE approves invoice → Status: SENT, Approval: APPROVED
3. DocuSign contract auto-sent to client
4. Client signs contract (reminders at 3, 7 days; expires at 30 days)
5. After signature → Stripe payment link sent to client
6. Client pays via Stripe
7. Payment synced to QuickBooks
8. Workflow complete
```

---

## Environment Variables

Add these to your `.env` file:

```bash
# ===========================================
# STRIPE CONFIGURATION
# ===========================================

# Stripe API Keys (from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_...          # Or sk_test_... for testing
STRIPE_PUBLISHABLE_KEY=pk_live_...      # Or pk_test_... for testing

# Stripe Webhook Secret (from webhook endpoint settings)
STRIPE_WEBHOOK_SECRET=whsec_...

# Payment redirect URLs
STRIPE_PAYMENT_SUCCESS_URL=https://yourdomain.com/payment/success
STRIPE_PAYMENT_CANCEL_URL=https://yourdomain.com/payment/cancel

# ===========================================
# DOCUSIGN CONFIGURATION
# ===========================================

# DocuSign Integration Key (from Apps and Keys page)
DOCUSIGN_INTEGRATION_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# DocuSign User ID (GUID of the user sending envelopes)
DOCUSIGN_USER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# DocuSign Account ID (from account settings)
DOCUSIGN_ACCOUNT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# DocuSign Base URL
# Sandbox: https://demo.docusign.net
# Production: https://na3.docusign.net (or your region)
DOCUSIGN_BASE_URL=https://demo.docusign.net

# DocuSign RSA Private Key (for JWT authentication)
# Must be the full key including -----BEGIN RSA PRIVATE KEY----- headers
# Replace newlines with \n in the .env file
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"

# DocuSign Webhook Secret (optional, for signature verification)
DOCUSIGN_WEBHOOK_SECRET=

# ===========================================
# RESEND (EMAIL) CONFIGURATION
# ===========================================

# Resend API Key (from https://resend.com/api-keys)
RESEND_API_KEY=re_...

# Email addresses
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FINANCE_TEAM=finance@yourdomain.com
EMAIL_SUPPORT_TEAM=support@yourdomain.com

# ===========================================
# QUICKBOOKS CONFIGURATION
# ===========================================

# QuickBooks OAuth (from developer.intuit.com)
QUICKBOOKS_CLIENT_ID=...
QUICKBOOKS_CLIENT_SECRET=...
QUICKBOOKS_REDIRECT_URI=https://yourdomain.com/api/quickbooks/auth/callback

# Environment: "sandbox" or "production"
QUICKBOOKS_ENVIRONMENT=production

# ===========================================
# APP CONFIGURATION
# ===========================================

# Your application URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Cron job authentication secret
CRON_SECRET=your-secure-random-string
```

---

## Stripe Configuration

### Step 1: Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers > API keys**
3. Copy the **Secret key** and **Publishable key**
4. For testing, use the test mode keys (starting with `sk_test_` and `pk_test_`)

### Step 2: Create Webhook Endpoint

1. Go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Enter your endpoint URL:
   ```
   https://yourdomain.com/api/webhooks/stripe
   ```
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `checkout.session.completed`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

### Step 3: Configure Payment Methods

1. Go to **Settings > Payment methods**
2. Enable the payment methods you want to accept:
   - Cards (Visa, Mastercard, etc.)
   - ACH Direct Debit (US bank accounts)
   - Other methods as needed

### Step 4: Test with Stripe CLI (Optional)

For local development, use the Stripe CLI:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to localhost
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Use the webhook signing secret from CLI output
```

---

## DocuSign Configuration

### Step 1: Create DocuSign Developer Account

1. Go to [DocuSign Developer Center](https://developers.docusign.com/)
2. Create a free developer account
3. Go to **Apps and Keys**

### Step 2: Create Integration Key

1. Click **Add App and Integration Key**
2. Name your app (e.g., "CarreiraUSA Hub")
3. Copy the **Integration Key** (GUID)

### Step 3: Generate RSA Key Pair

1. In your app settings, go to **Service Integration**
2. Click **Generate RSA Key Pair**
3. **IMPORTANT**: Download the private key immediately (you can only see it once)
4. Save the private key securely

### Step 4: Get User ID and Account ID

1. Go to **Apps and Keys** in DocuSign Admin
2. Find your **API Account ID**
3. Find your **User ID** (click on your user)

### Step 5: Grant Consent for JWT

For JWT authentication to work, you need to grant consent:

1. Open this URL in a browser (replace values):
   ```
   https://account-d.docusign.com/oauth/auth?
     response_type=code&
     scope=signature%20impersonation&
     client_id=YOUR_INTEGRATION_KEY&
     redirect_uri=https://yourdomain.com/api/webhooks/docusign
   ```
2. Log in and click **Allow Access**
3. This only needs to be done once per user

### Step 6: Configure DocuSign Connect (Webhooks)

1. Go to DocuSign Admin > **Connect**
2. Click **Add Configuration**
3. Configure:
   - **Name**: CarreiraUSA Webhook
   - **URL**: `https://yourdomain.com/api/webhooks/docusign`
   - **Events**:
     - Envelope Sent
     - Envelope Delivered
     - Envelope Completed
     - Envelope Declined
     - Envelope Voided
4. Enable **Include Documents** if you want signed PDFs
5. Save the configuration

### Step 7: Format Private Key for .env

The RSA private key needs to be on a single line with `\n` for newlines:

```bash
# Original key file
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
...
-----END RSA PRIVATE KEY-----

# In .env (single line with \n)
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n...\n-----END RSA PRIVATE KEY-----"
```

---

## Resend (Email) Configuration

### Step 1: Create Resend Account

1. Go to [Resend](https://resend.com)
2. Create an account
3. Go to **API Keys**
4. Create a new API key with **Full access**

### Step 2: Verify Domain

1. Go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `carreirausa.com`)
4. Add the DNS records to your domain registrar:
   - SPF record
   - DKIM records (usually 2-3 CNAME records)
5. Click **Verify** once DNS propagates (may take up to 48 hours)

### Step 3: Test Email Sending

```bash
# Test with curl
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "noreply@yourdomain.com",
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<p>This is a test</p>"
  }'
```

---

## QuickBooks Configuration

### Step 1: Create QuickBooks App

1. Go to [Intuit Developer Portal](https://developer.intuit.com/)
2. Create a developer account
3. Create a new app
4. Select **Accounting** API
5. Copy **Client ID** and **Client Secret**

### Step 2: Configure OAuth

1. In your app settings, go to **Keys & OAuth**
2. Add redirect URI:
   ```
   https://yourdomain.com/api/quickbooks/auth/callback
   ```
3. For production, also add:
   ```
   https://yourdomain.com/api/quickbooks/auth/callback
   ```

### Step 3: Connect QuickBooks

1. Go to your app's integrations page
2. Click **Connect to QuickBooks**
3. Authorize access to your QuickBooks company
4. Tokens will be stored in the database

### Step 4: Verify Connection

```bash
# Check QuickBooks status
curl https://yourdomain.com/api/quickbooks/status
```

---

## Webhook Endpoints

| Service | Endpoint | Purpose |
|---------|----------|---------|
| Stripe | `/api/webhooks/stripe` | Payment events (success, failure) |
| DocuSign | `/api/webhooks/docusign` | Contract events (sent, signed, declined) |
| QuickBooks | `/api/webhooks/quickbooks` | Entity change notifications |

### Webhook Security

All webhooks verify signatures:

- **Stripe**: Uses `STRIPE_WEBHOOK_SECRET` to verify `stripe-signature` header
- **DocuSign**: Verifies X-DocuSign-Signature header (if `DOCUSIGN_WEBHOOK_SECRET` is set)
- **QuickBooks**: Verifies intuit signature headers

---

## Cron Jobs

The following cron jobs are configured in `vercel.json`:

| Job | Schedule | Description |
|-----|----------|-------------|
| Contract Reminders | 9:00 AM UTC daily | Send reminders for unsigned contracts (3, 7 days) |
| Contract Expiration | 1:00 AM UTC daily | Mark contracts as expired after 30 days |
| Payment Reminders | 10:00 AM UTC daily | Remind about unpaid invoices (7, 3, 1 days before due) |
| Overdue Invoices | 2:00 AM UTC daily | Mark invoices as overdue, send notifications |

### Cron Authentication

All cron endpoints require the `CRON_SECRET` in the Authorization header:

```bash
# Manual trigger
curl -X POST https://yourdomain.com/api/cron/contract-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Vercel Cron Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/contract-reminders",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/contract-expiration",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/payment-reminders",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/overdue-invoices",
      "schedule": "0 2 * * *"
    }
  ]
}
```

---

## Testing the Workflow

### 1. Test Stripe Payments

Use Stripe test cards:

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Successful payment |
| `4000 0000 0000 0002` | Declined |
| `4000 0025 0000 3155` | Requires 3D Secure |

### 2. Test DocuSign Contracts

1. Create a test invoice in the dashboard
2. Approve it (as FINANCE role)
3. Check DocuSign sandbox for the envelope
4. Sign the contract in sandbox
5. Verify webhook updates the contract status

### 3. Test Email Notifications

1. Enable Resend with a test API key
2. Create and approve an invoice
3. Check Resend dashboard for sent emails
4. Verify all notification types work

### 4. Full Workflow Test

1. Create invoice (COMMERCIAL role)
2. Approve invoice (FINANCE role)
3. Verify contract sent (check DocuSign)
4. Sign contract (DocuSign)
5. Verify payment link sent (check email)
6. Complete payment (Stripe checkout)
7. Verify payment synced (QuickBooks)

---

## Troubleshooting

### Stripe Webhooks Not Working

1. Check webhook endpoint is accessible:
   ```bash
   curl -X POST https://yourdomain.com/api/webhooks/stripe
   ```
2. Verify `STRIPE_WEBHOOK_SECRET` matches the endpoint
3. Check Stripe Dashboard > Webhooks for failed events
4. Review application logs for errors

### DocuSign JWT Authentication Failing

1. Verify consent was granted (see Step 5 in DocuSign setup)
2. Check private key format (must include headers, proper newlines)
3. Verify Integration Key, User ID, and Account ID are correct
4. Check DocuSign logs in Admin panel

### Emails Not Sending

1. Verify domain is verified in Resend
2. Check `EMAIL_FROM` matches verified domain
3. Review Resend dashboard for failed sends
4. Check application logs for Resend errors

### QuickBooks Sync Failing

1. Check token expiration (tokens expire after 100 days)
2. Reconnect QuickBooks if needed
3. Verify company ID is correct
4. Check QuickBooks API limits

### Cron Jobs Not Running

1. Verify `CRON_SECRET` is set
2. Check Vercel dashboard for cron execution logs
3. Manually trigger to test:
   ```bash
   curl -X POST https://yourdomain.com/api/cron/contract-reminders \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

---

## Security Checklist

- [ ] All API keys are in environment variables (not in code)
- [ ] Webhook secrets are configured for all services
- [ ] HTTPS is enforced for all endpoints
- [ ] Cron endpoints require authentication
- [ ] Database credentials are secure
- [ ] Rate limiting is enabled on API routes
- [ ] Error messages don't expose sensitive data

---

## Support

For issues with this workflow:

1. Check Integration Logs: `/dashboard/integrations/sync-status`
2. Review application logs in Vercel
3. Contact support: support@carreirausa.com

---

*Last updated: January 2026*

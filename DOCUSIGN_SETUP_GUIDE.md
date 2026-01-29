# DocuSign Setup Guide for CarreiraUSA Hub

This guide will walk you through setting up DocuSign JWT authentication for the CarreiraUSA Hub.

## Prerequisites

- Access to the CarreiraUSA email that owns the DocuSign production account
- 15-20 minutes for setup

---

## Step 1: Create Developer Account (5 minutes)

1. **Go to DocuSign Developer Portal**
   - Visit: https://go.docusign.com/o/sandbox/
   
2. **Sign Up**
   - Click "Create Free Account"
   - **Use the CarreiraUSA email** (the one that owns the production account)
   - Fill in:
     - First Name: (your name)
     - Last Name: (your name)
     - Company: Carreira USA
     - Country: United States
   
3. **Verify Email**
   - Check the CarreiraUSA email inbox
   - Click the verification link
   - Complete the account setup

---

## Step 2: Create Integration App (5 minutes)

1. **Access Developer Admin Console**
   - Go to: https://admindemo.docusign.com/apps-and-keys
   - Or navigate: Settings → Apps and Keys
   
2. **Create New App**
   - Click **"+ ADD APP AND INTEGRATION KEY"**
   - Fill in:
     - **App Name**: CarreiraUSA Hub
     - **Description**: API integration for CarreiraUSA middleware system
   - Click "Create App"
   
3. **Configure App Settings**
   - **Redirect URIs**: Add (if needed for future OAuth):
     ```
     https://carreirausa.sigmaintel.io/api/docusign/callback
     ```
   - Click "Save"

---

## Step 3: Generate RSA Keypair (CRITICAL)

1. **Find Service Integration Section**
   - In your app settings, scroll to "Service Integration"
   - Or look for "Authentication" section
   
2. **Generate RSA Key**
   - Click **"+ GENERATE RSA"**
   - A popup appears with your private key
   
3. **⚠️ CRITICAL: Copy the Private Key**
   - You will **ONLY see this ONCE**
   - Copy the ENTIRE key including:
     ```
     -----BEGIN RSA PRIVATE KEY-----
     (multiple lines of encoded text)
     -----END RSA PRIVATE KEY-----
     ```
   - Save it in a secure location (password manager, secure note)
   - If you lose it, you'll need to generate a new one
   
4. **Copy the Integration Key**
   - At the top of your app settings page
   - It's a GUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
   - Save this as well

---

## Step 4: Grant Consent (2 minutes)

1. **Find Consent URL**
   - In your app settings, look for "Grant Consent" button
   - Or copy the consent URL provided
   
2. **Authorize the App**
   - Open the consent URL in a browser
   - You'll see a permission screen
   - Click **"Allow Access"**
   - You should see a success message
   
3. **Verify Consent**
   - Back in app settings, it should show "Consent granted"

---

## Step 5: Get User ID and Account ID

You already have these from your production account:

**From the screenshot you showed earlier:**
- **User ID**: `a95256b8-0fe1-45e5-9018-cbb71410f238`
- **Account ID**: `3ac23f90-19a9-46de-a927-687dc6324fc8`
- **Base URL**: `https://na4.docusign.net`

These will be used for production. For sandbox testing, you can find sandbox IDs in the developer portal.

---

## Step 6: Update .env File

### For Sandbox Testing (Recommended First):

```bash
# DocuSign - SANDBOX (for testing)
DOCUSIGN_INTEGRATION_KEY=your-integration-key-from-step-3
DOCUSIGN_USER_ID=your-sandbox-user-id-from-developer-portal
DOCUSIGN_ACCOUNT_ID=your-sandbox-account-id-from-developer-portal
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCA...(your full key)...-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_URL=https://demo.docusign.net
DOCUSIGN_WEBHOOK_SECRET=""
```

**Important**: Replace actual newlines in the private key with `\n` characters.

### For Production (After Go-Live):

```bash
# DocuSign - PRODUCTION
DOCUSIGN_INTEGRATION_KEY=your-integration-key-from-step-3  # Same key
DOCUSIGN_USER_ID=a95256b8-0fe1-45e5-9018-cbb71410f238  # Production User ID
DOCUSIGN_ACCOUNT_ID=3ac23f90-19a9-46de-a927-687dc6324fc8  # Production Account ID
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...(same key)...-----END RSA PRIVATE KEY-----"
DOCUSIGN_BASE_URL=https://na4.docusign.net  # Production URL
DOCUSIGN_WEBHOOK_SECRET=""
```

---

## Step 7: Format Private Key Correctly

The private key needs to be a single-line string with `\n` for line breaks.

**Original format (from DocuSign):**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
(multiple lines)
...
-----END RSA PRIVATE KEY-----
```

**Formatted for .env:**
```bash
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n...\n-----END RSA PRIVATE KEY-----"
```

**OR use multi-line format in .env:**
```bash
DOCUSIGN_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
(multiple lines exactly as received)
...
-----END RSA PRIVATE KEY-----"
```

---

## Step 8: Test the Integration

Run the test script:

```bash
npm run test:docusign
```

The script will:
1. ✅ Check all environment variables are set
2. ✅ Test JWT authentication
3. ✅ Create a test envelope
4. ✅ Check envelope status
5. ✅ Verify everything works

### Expected Output:

```
🔍 DocuSign Integration Test
============================================================

📋 Step 1: Checking Environment Variables...
✅ All required environment variables are set

🔐 Step 2: Testing JWT Authentication...
✅ JWT authentication successful!

📄 Step 3: Testing Envelope Creation...
✅ Envelope created successfully!

📊 Step 4: Checking Envelope Status...
✅ Envelope status retrieved!

============================================================
✅ DocuSign Integration Test Complete!
```

---

## Step 9: Go-Live (To Use Production Account)

### When Ready for Production:

1. **In Developer Portal**
   - Go to your app settings
   - Look for "Go Live" or "Request Production Access"
   - Click to submit request
   
2. **DocuSign Review**
   - DocuSign will review your integration
   - Typically takes 1-2 business days
   - They may ask questions about your use case
   
3. **After Approval**
   - Update `.env` with production credentials (User ID, Account ID, Base URL)
   - Keep same Integration Key and Private Key
   - Run test script again to verify

---

## Troubleshooting

### Error: "JWT authentication failed"

**Check:**
- Private key is correctly formatted (including BEGIN/END lines)
- Integration Key matches the one that generated the private key
- User ID and Account ID are correct
- Consent was granted (visit consent URL)

### Error: "Invalid grant"

**Solution:**
- Go back to app settings
- Click "Grant Consent" again
- Make sure you're logged in with the correct DocuSign account

### Error: "USER_AUTHENTICATION_FAILED"

**Solution:**
- Verify User ID is correct
- Check that the user exists in the account
- Make sure consent is granted for that specific user

### Error: "ACCOUNT_NOT_AUTHORIZED"

**Solution:**
- Verify Account ID is correct
- Make sure you're using the right environment (sandbox vs production)
- Check Base URL matches the account

---

## Support

If you encounter issues:

1. Check the **Integration Logs** in the database (IntegrationLog table)
2. Review DocuSign documentation: https://developers.docusign.com
3. Contact DocuSign support: https://support.docusign.com

---

## Summary Checklist

- [ ] Created developer account with CarreiraUSA email
- [ ] Created integration app in developer portal
- [ ] Generated RSA keypair and saved private key
- [ ] Copied Integration Key
- [ ] Granted consent
- [ ] Updated .env file with all credentials
- [ ] Formatted private key correctly
- [ ] Ran `npm run test:docusign` successfully
- [ ] (Optional) Submitted Go-Live request for production
- [ ] (After Go-Live) Updated .env with production credentials

---

**Once all steps are complete, your DocuSign integration will be fully operational!**

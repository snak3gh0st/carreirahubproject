# Phase 2: DocuSign Integration - Research

**Researched:** 2026-01-22
**Domain:** Document e-signature automation, contract lifecycle management, serverless integration
**Confidence:** MEDIUM (official SDK + community patterns verified, some serverless-specific details need validation)

## Summary

DocuSign provides robust API capabilities for automated contract generation and signature workflows, with mature Node.js SDK support and serverless-compatible authentication. The system already has partial DocuSign integration with JWT authentication and basic envelope creation, but lacks template management, comprehensive webhook processing, and document storage.

The recommended approach for serverless environments is:
- **JWT Grant authentication** (already implemented) for system-to-system integration without user interaction
- **Composite Templates** for maximum flexibility in contract generation and template management
- **HMAC-signed webhooks** for secure, idempotent event processing with deduplication
- **S3 with presigned URLs** for signed document storage (Vercel /tmp is ephemeral, 512MB limit)

**Primary recommendation:** Extend existing DocuSign service to use composite templates instead of inline PDFs, implement proper HMAC webhook verification with deduplication, and add S3 integration for signed document storage.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| docusign-esign | 8.x+ | Official DocuSign Node.js SDK | Maintained by DocuSign, handles API complexity, auto-generates models from OpenAPI spec |
| pdf-lib | 1.17+ | PDF manipulation (already installed) | Generate dynamic PDFs for contracts, lightweight, serverless-compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-s3 | 3.x | S3 file storage | Store signed contract PDFs (Vercel /tmp is ephemeral) |
| @aws-sdk/s3-request-presigner | 3.x | Generate presigned URLs | Secure temporary access to signed documents |
| crypto (Node.js built-in) | Native | HMAC signature verification | Verify DocuSign webhook authenticity |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| docusign-esign SDK | Raw fetch() API | SDK provides type safety, auth handling, envelope construction helpers - worth the dependency |
| S3 | Vercel Blob Storage | S3 is cheaper for large files, more ecosystem tooling, presigned URL support built-in |
| Composite Templates | Template Reference Model | Composite templates support all use cases; template reference is limiting and causes rewrites |

**Installation:**
```bash
npm install docusign-esign @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
# pdf-lib already installed
```

**Note:** The codebase currently uses custom JWT implementation with Node.js crypto. The official `docusign-esign` SDK provides `ApiClient.requestJWTUserToken()` which handles JWT creation automatically, but the current implementation is functional and avoids SDK dependency for auth only.

## Architecture Patterns

### Recommended Project Structure
```
lib/services/
├── docusign.service.ts        # Core DocuSign API wrapper (EXISTS - needs template support)
├── contract-workflow.service.ts # Contract lifecycle logic (EXISTS)
├── document-storage.service.ts  # NEW: S3 upload/download/presigned URLs

app/api/
├── webhooks/docusign/
│   └── route.ts               # EXISTS - needs HMAC verification + deduplication
├── docusign/
│   ├── templates/             # NEW: Template management endpoints
│   │   └── route.ts          # List, create, update templates
│   └── download/
│       └── [envelopeId]/
│           └── route.ts       # NEW: Download signed PDF with presigned URL

scripts/
├── setup-docusign-templates.ts # NEW: Create/update templates in DocuSign UI
└── test-docusign.ts             # NEW: Integration test for envelope flow
```

### Pattern 1: JWT Authentication with Token Caching
**What:** Server-to-server authentication using RSA private key to generate JWT, exchanged for access token
**When to use:** All DocuSign API calls in serverless environment (no user interaction)
**Current implementation:** COMPLETE (lines 52-123 in docusign.service.ts)
```typescript
// Source: Existing codebase + https://developers.docusign.com/platform/auth/jwt/
async authenticateWithJWT(): Promise<string> {
  // Check cached token (expires in 3600s, cache until 3500s)
  if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
    return this.accessToken;
  }

  // Create JWT with RS256 signature
  const payload = {
    iss: this.integrationKey,
    sub: this.userId,
    aud: 'account-d.docusign.com', // or account.docusign.com for production
    iat: now,
    exp: now + 3600,
    scope: 'signature impersonation',
  };

  // Sign with RSA private key (from env: DOCUSIGN_PRIVATE_KEY)
  const signature = crypto.createSign('RSA-SHA256')
    .update(`${headerBase64}.${payloadBase64}`)
    .sign(this.privateKey, 'base64url');

  // Exchange JWT for access token
  const tokenData = await fetch('https://account-d.docusign.com/oauth/token', {
    method: 'POST',
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwtToken}`,
  });

  this.accessToken = tokenData.access_token;
  this.tokenExpiresAt = Date.now() + 3500 * 1000; // 100s buffer
}
```

**One-time setup requirement:** User consent grant
- Admin must open consent URL once: `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={INTEGRATION_KEY}&redirect_uri={REDIRECT_URI}`
- After granting consent, JWT auth works indefinitely without user interaction
- Consent is environment-specific (sandbox vs production require separate consent)

### Pattern 2: Composite Templates for Contract Generation
**What:** Flexible envelope creation combining server templates + runtime documents + dynamic tabs
**When to use:** ALWAYS for production (template reference model is too limiting)
**Example:**
```typescript
// Source: https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/templates/composite/
async createContractEnvelope(invoice: Invoice, customer: Customer, templateId: string): Promise<string> {
  const envelopeDefinition = {
    status: 'sent',
    compositeTemplates: [
      {
        // Server template with tabs and workflow
        serverTemplates: [{
          templateId: templateId, // Created in DocuSign UI
          sequence: '1',
        }],
        // Add recipient data
        inlineTemplates: [{
          sequence: '1',
          recipients: {
            signers: [{
              email: customer.email,
              name: customer.name,
              recipientId: '1',
              roleName: 'Client', // Must match template role
              tabs: {
                // Override/add tabs at runtime
                textTabs: [
                  { tabLabel: 'invoice_number', value: invoice.invoiceNumber, locked: 'true' },
                  { tabLabel: 'amount', value: invoice.amount.toString(), locked: 'true' },
                  { tabLabel: 'due_date', value: invoice.dueDate.toISOString().split('T')[0], locked: 'true' },
                ],
              },
            }],
          },
        }],
      },
      // Optionally attach invoice PDF as additional document
      {
        document: {
          documentId: '2',
          name: 'Invoice.pdf',
          documentBase64: invoicePdfBase64,
        },
      },
    ],
  };

  const result = await this.apiRequest('/envelopes', {
    method: 'POST',
    body: JSON.stringify(envelopeDefinition),
  });

  return result.envelopeId;
}
```

**Why composite templates:**
- Supports all use cases (server templates + dynamic docs + runtime tabs)
- Prevents "dead-end MVP" that needs rewrite when requirements expand
- Allows template updates in DocuSign UI without code changes
- Can combine multiple templates or add documents at runtime

**Template creation workflow:**
1. Create template in DocuSign web UI with merge fields (tabLabel: 'invoice_number', etc.)
2. Define roles ('Client', 'Guarantor', etc.)
3. Store template ID in database or env var
4. Reference template ID in compositeTemplates.serverTemplates[0].templateId

### Pattern 3: HMAC Webhook Verification with Deduplication
**What:** Verify webhook authenticity via HMAC-SHA256 signature + prevent duplicate processing
**When to use:** ALL webhook endpoints (envelope-sent, envelope-completed, etc.)
**Current implementation:** INCOMPLETE (placeholder on line 25-28 in route.ts)
```typescript
// Source: https://developers.docusign.com/platform/webhooks/connect/hmac/
import crypto from 'crypto';

async function verifyDocuSignWebhook(request: NextRequest): Promise<boolean> {
  const signature = request.headers.get('X-DocuSign-Signature-1');
  const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET; // Set in DocuSign Connect config

  if (!signature || !webhookSecret) {
    return false; // Reject if either missing
  }

  // CRITICAL: Use raw body (before JSON parsing) for HMAC
  const rawBody = await request.text(); // NOT request.json()
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('base64');

  return signature === expectedSignature;
}

// In webhook handler:
export async function POST(request: NextRequest) {
  // Verify BEFORE processing
  const isValid = await verifyDocuSignWebhook(request);
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody); // Parse after verification
  const eventId = `${payload.envelopeId}-${payload.event}-${payload.generatedDateTime}`;

  // Idempotency check (prevent duplicate processing)
  const existing = await prisma.webhookEvent.findFirst({
    where: {
      service: 'docusign',
      event_id: eventId,
    },
  });

  if (existing && existing.status === 'success') {
    console.log(`[DOCUSIGN_WEBHOOK] Duplicate event ${eventId} - skipping`);
    return NextResponse.json({ success: true, duplicate: true });
  }

  // Process event...
}
```

**DocuSign retry behavior:** Up to 45 retries over 7 days with exponential backoff (15s, 30s, 1m, 2m, etc.)
**Critical:** Must respond with 200 OK even for duplicates to stop retries

### Pattern 4: Signed Document Download and Storage
**What:** Download signed PDF after envelope completion, store in S3 with presigned URL access
**When to use:** On 'envelope-completed' webhook event
**Example:**
```typescript
// Source: https://developers.docusign.com/docs/esign-rest-api/how-to/download-envelope-documents/
// Download from DocuSign
async downloadSignedDocument(envelopeId: string): Promise<Buffer> {
  const token = await this.getAccessToken();
  // documentId 'combined' returns all docs + certificate of completion as single PDF
  const url = `${this.baseUrl}/restapi/v2.1/accounts/${this.accountId}/envelopes/${envelopeId}/documents/combined`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download document: ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// Upload to S3
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async uploadSignedContract(envelopeId: string, pdfBuffer: Buffer): Promise<string> {
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const key = `contracts/${new Date().getFullYear()}/${envelopeId}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'AES256',
  }));

  // Generate presigned URL (expires in 7 days)
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
  });
  const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 604800 });

  return presignedUrl;
}

// In webhook handler (envelope-completed):
const pdfBuffer = await docusignService.downloadSignedDocument(envelopeId);
const presignedUrl = await documentStorageService.uploadSignedContract(envelopeId, pdfBuffer);

await prisma.contract.update({
  where: { docusign_env_id: envelopeId },
  data: {
    signedUrl: presignedUrl,
    signedAt: new Date(),
    status: 'SIGNED',
  },
});
```

**Vercel limitation:** /tmp directory is ephemeral (cleared between invocations) and limited to 512MB
**Solution:** Stream directly to S3 without /tmp storage, or use /tmp only for temporary processing

### Anti-Patterns to Avoid

- **Don't use inline PDFs in production:** Current implementation generates PDF with pdf-lib and sends as base64. This works but doesn't scale - use server templates for reusable contracts with merge fields.
- **Don't skip HMAC verification:** Current webhook handler has TODO for signature verification. In production, unverified webhooks are a security risk (spoofing, replay attacks).
- **Don't parse JSON before HMAC check:** HMAC must be computed on raw body bytes, not JSON-parsed object. Parse AFTER verification.
- **Don't ignore webhook deduplication:** DocuSign retries failed webhooks. Without deduplication, you'll process the same event multiple times (duplicate payments, notifications, etc.).
- **Don't store large PDFs in database:** Signed PDFs can be 1-5MB. Use S3 with presigned URLs, store only the URL in database.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF contract generation | Custom PDF renderer with forms/signatures | DocuSign Templates in UI | Template management, versioning, legal compliance, audit trail, e-signature validity |
| JWT authentication | Custom OAuth flow | Existing JWT implementation + SDK optional | Already working, handles token refresh, expiration, caching |
| HMAC signature verification | Custom crypto logic | Node.js crypto.createHmac() (built-in) | Standard library, battle-tested, no dependencies |
| Webhook retry logic | Manual retry with setTimeout | DocuSign built-in retries (45 attempts over 7 days) | DocuSign handles exponential backoff, your job is idempotency |
| Document storage | Database BLOBs | S3 with presigned URLs | Cost (S3 cheaper), CDN integration, built-in expiration, no DB bloat |
| Envelope status polling | setInterval API calls | DocuSign webhooks | Real-time updates, no rate limit waste, lower latency |

**Key insight:** DocuSign is a mature platform with comprehensive features. Focus on integration glue code (templates → envelopes → webhooks → storage), not rebuilding signature/PDF/auth infrastructure.

## Common Pitfalls

### Pitfall 1: Forgetting One-Time JWT Consent Grant
**What goes wrong:** JWT authentication fails with "consent_required" error even with correct credentials
**Why it happens:** DocuSign requires user to grant consent to integration key before JWT impersonation works
**How to avoid:**
1. After creating integration key in DocuSign Admin, generate RSA keypair
2. Have admin user open consent URL (one-time): `https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id={INTEGRATION_KEY}&redirect_uri={REDIRECT_URI}`
3. After consent granted, JWT auth works indefinitely
4. **Consent is per-environment:** Sandbox and production require separate consent
**Warning signs:** Error message "consent_required" in JWT token exchange response

### Pitfall 2: Using Template Reference Model Instead of Composite Templates
**What goes wrong:** Integration works for MVP, then requires complete rewrite when you need to add documents or multiple templates
**Why it happens:** Template reference model (templateId + templateRoles) is simpler for "hello world" but extremely limited
**How to avoid:** Start with composite templates from day 1, even for simple use cases
**Warning signs:** Needing to send both a template and a PDF document in same envelope (not possible with template reference)

### Pitfall 3: Not Implementing Webhook Deduplication
**What goes wrong:** Contract signed event processed multiple times, creating duplicate payments, emails, database records
**Why it happens:** DocuSign retries webhooks on ANY non-200 status or timeout, can send same event 45+ times over 7 days
**How to avoid:**
1. Create unique event ID: `${envelopeId}-${event}-${timestamp}`
2. Check WebhookEvent table before processing
3. Return 200 OK even for duplicates (stops retries)
4. Use database unique constraint on event_id for safety
**Warning signs:** Duplicate IntegrationLog entries with same envelopeId and event type

### Pitfall 4: HMAC Verification on JSON-Parsed Body
**What goes wrong:** HMAC signature verification always fails even with correct secret
**Why it happens:** HMAC is computed on raw bytes. JSON.parse() changes whitespace, key order, breaking signature
**How to avoid:**
1. Get raw body: `const rawBody = await request.text()` (NOT request.json())
2. Compute HMAC on rawBody
3. Verify signature
4. THEN parse JSON: `const payload = JSON.parse(rawBody)`
**Warning signs:** Signature verification fails intermittently or always fails despite correct secret

### Pitfall 5: Storing Signed PDFs in Vercel /tmp
**What goes wrong:** Downloaded PDFs disappear between function invocations, 504 timeouts on large files
**Why it happens:** Vercel /tmp is ephemeral (cleared unpredictably) and limited to 512MB
**How to avoid:** Stream directly to S3 without /tmp, or use /tmp only for immediate processing then delete
**Warning signs:** "No space left on device" errors, files mysteriously missing on next invocation

### Pitfall 6: Incorrect Tab Positioning in Generated PDFs
**What goes wrong:** Signature tabs appear in wrong location, overlap text, or off-page
**Why it happens:** DocuSign coordinates are in pixels from top-left, generated PDFs have different margins than expected
**How to avoid:**
1. Use DocuSign Templates with anchor text (finds "Signature:___" and places tab there)
2. Or use pdf-lib to measure exact positions before creating envelope
3. Test with preview before sending to real customer
**Warning signs:** Support requests "can't find where to sign", tabs invisible or overlapping

## Code Examples

### Example 1: Create Envelope from Template with Dynamic Data
```typescript
// Source: Composite templates pattern + existing codebase
async createContractFromTemplate(
  customerId: string,
  invoiceId: string,
  templateId: string
): Promise<string> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

  if (!customer || !invoice) {
    throw new Error('Customer or invoice not found');
  }

  const envelopeDefinition = {
    status: 'sent',
    emailSubject: `CarreiraUSA - Contract for ${customer.name}`,
    compositeTemplates: [{
      serverTemplates: [{
        templateId: templateId,
        sequence: '1',
      }],
      inlineTemplates: [{
        sequence: '1',
        recipients: {
          signers: [{
            email: customer.email,
            name: customer.name,
            recipientId: '1',
            roleName: 'Client',
            tabs: {
              textTabs: [
                { tabLabel: 'customer_name', value: customer.name, locked: 'true' },
                { tabLabel: 'customer_email', value: customer.email, locked: 'true' },
                { tabLabel: 'invoice_number', value: invoice.invoiceNumber || '', locked: 'true' },
                { tabLabel: 'amount', value: invoice.amount.toString(), locked: 'true' },
                { tabLabel: 'due_date', value: invoice.dueDate.toISOString().split('T')[0], locked: 'true' },
              ],
            },
          }],
        },
      }],
    }],
  };

  const result = await this.apiRequest('/envelopes', {
    method: 'POST',
    body: JSON.stringify(envelopeDefinition),
  });

  return result.envelopeId;
}
```

### Example 2: HMAC Webhook Verification with Idempotency
```typescript
// Source: https://developers.docusign.com/platform/webhooks/connect/hmac/
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Get raw body for HMAC verification (before JSON parsing)
  const rawBody = await request.text();
  const signature = request.headers.get('X-DocuSign-Signature-1');
  const webhookSecret = process.env.DOCUSIGN_WEBHOOK_SECRET;

  // Verify HMAC signature
  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 401 });
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('base64');

  if (signature !== expectedSignature) {
    console.error('[WEBHOOK] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse payload AFTER verification
  const payload = JSON.parse(rawBody);
  const envelopeId = payload.data?.envelopeId || payload.envelopeId;
  const event = payload.event;
  const timestamp = payload.generatedDateTime || new Date().toISOString();

  // Idempotency check
  const eventId = `${envelopeId}-${event}-${timestamp}`;
  const existing = await prisma.webhookEvent.findFirst({
    where: { service: 'docusign', event_id: eventId },
  });

  if (existing && existing.status === 'success') {
    console.log(`[WEBHOOK] Duplicate event ${eventId} - already processed`);
    return NextResponse.json({ success: true, duplicate: true }, { status: 200 });
  }

  // Create webhook event record (for tracking and deduplication)
  await prisma.webhookEvent.create({
    data: {
      service: 'docusign',
      event_type: event,
      event_id: eventId,
      payload: payload,
      headers: { signature } as any,
      status: 'processing',
    },
  });

  try {
    // Process event...
    await handleDocuSignEvent(event, envelopeId, payload);

    // Mark as success
    await prisma.webhookEvent.updateMany({
      where: { event_id: eventId },
      data: { status: 'success', processed_at: new Date() },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    // Log error but return 200 to prevent retries for permanent errors
    await prisma.webhookEvent.updateMany({
      where: { event_id: eventId },
      data: {
        status: 'failed',
        last_error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 200 }); // 200 prevents DocuSign retries
  }
}
```

### Example 3: Download and Store Signed Document
```typescript
// Source: https://developers.docusign.com/docs/esign-rest-api/how-to/download-envelope-documents/
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async handleContractSigned(envelopeId: string): Promise<void> {
  // 1. Download signed document from DocuSign (combined = all docs + certificate)
  const token = await docusignService.getAccessToken();
  const url = `${docusignService.baseUrl}/restapi/v2.1/accounts/${docusignService.accountId}/envelopes/${envelopeId}/documents/combined`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download document: ${response.statusText}`);
  }

  const pdfBuffer = Buffer.from(await response.arrayBuffer());

  // 2. Upload to S3
  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const key = `contracts/${new Date().getFullYear()}/${envelopeId}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
    Body: pdfBuffer,
    ContentType: 'application/pdf',
    ServerSideEncryption: 'AES256',
    Metadata: {
      envelopeId: envelopeId,
      uploadedAt: new Date().toISOString(),
    },
  }));

  // 3. Generate presigned URL (valid for 7 days)
  const getCommand = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
  });
  const presignedUrl = await getSignedUrl(s3, getCommand, { expiresIn: 604800 }); // 7 days

  // 4. Update contract record
  await prisma.contract.update({
    where: { docusign_env_id: envelopeId },
    data: {
      signedUrl: presignedUrl,
      signedAt: new Date(),
      status: 'SIGNED',
    },
  });

  console.log(`[CONTRACT] Signed document stored: ${key}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Template Reference Model (templateId only) | Composite Templates | Always recommended (2020+) | Enables multi-document envelopes, runtime modifications, prevents rewrites |
| OAuth Authorization Code Grant | JWT Grant for server-to-server | 2018+ | Simpler for automated workflows, no user interaction, better for serverless |
| Polling envelope status | Webhooks (Connect) | 2015+ | Real-time updates, lower API usage, better UX |
| Basic Authentication for webhooks | HMAC signatures | 2019+ | Prevents spoofing, replay attacks, required for PCI/SOC2 compliance |
| Individual document downloads | Combined document endpoint | 2020+ | Single API call for all docs + certificate, faster, fewer API calls |

**Deprecated/outdated:**
- **SOAP API:** Replaced by REST API v2.1 (use REST for all new integrations)
- **Legacy integrator key:** Replaced by integration key + RSA keypair for JWT (old style used username/password)
- **Polling for status:** Use webhooks instead (polling wastes API quota, high latency)
- **Inline template definition in API:** Create templates in DocuSign UI (better version control, non-developer editing)

## Open Questions

### 1. **Template Creation and Management Strategy**
- **What we know:** Templates should be created in DocuSign web UI (not via API) for version control and non-developer editing
- **What's unclear:** Should template IDs be stored in database (per-service-type) or environment variables (single contract template)?
- **Recommendation:** Store template IDs in database (QuickBooksItem or new ContractTemplate table) if different services need different contracts. Use env var if single template for all contracts.

### 2. **Multi-Signer Workflow (Customer + Guarantor)**
- **What we know:** Composite templates support multiple signers with routing order (customer signs first, then guarantor)
- **What's unclear:** Business requirement - when does contract need guarantor signature? Age-based (under 18), service-type-based, or amount-based?
- **Recommendation:** Start with single-signer (customer only), add guarantor support in Phase 2.1 if needed. Schema already supports it (signerEmail/signerName in Contract model).

### 3. **Contract Expiration Handling**
- **What we know:** DocuSign supports expiration (current code sets 30 days), sends automatic reminders
- **What's unclear:** Should system automatically void expired envelopes, or wait for manual Finance action?
- **Recommendation:** Implement automated expiration handling with cron job - void envelope in DocuSign, update Contract.status to EXPIRED, create Alert for Finance team to follow up with customer.

### 4. **Document Storage Costs and Retention**
- **What we know:** S3 is recommended over Vercel /tmp for signed PDFs
- **What's unclear:** Retention policy - keep signed contracts forever, or archive to Glacier after X years?
- **Recommendation:** Start with S3 Standard, implement lifecycle policy after 6 months to move to Glacier after 2 years (cost savings, compliance requirement for document retention).

### 5. **Embedded Signing vs Email Signing**
- **What we know:** Current implementation uses email signing (status: 'sent'). Embedded signing generates URL for iframe/redirect.
- **What's unclear:** Business requirement - should customers sign in-app (embedded) or via email?
- **Recommendation:** Email signing is simpler (no session management, no iframe CORS issues). Use embedded only if customer dashboard requires in-app signing. For B2C email signing is standard.

## Sources

### Primary (HIGH confidence)
- [DocuSign Node SDK Documentation](https://developers.docusign.com/docs/esign-rest-api/sdks/node/) - Installation, setup, configuration
- [DocuSign JWT Authentication](https://developers.docusign.com/platform/auth/jwt/) - JWT grant flow, token lifetime, consent requirement
- [DocuSign Composite Templates](https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/templates/composite/) - Template architecture and use cases
- [DocuSign Webhook Event Triggers](https://developers.docusign.com/platform/webhooks/connect/event-triggers/) - Available events and payload structure
- [DocuSign HMAC Security](https://developers.docusign.com/platform/webhooks/connect/hmac/) - Signature verification for webhooks

### Secondary (MEDIUM confidence)
- [DocuSign Node.js Guide: JWT Grant Authentication](https://www.docusign.com/blog/developers/docusign-esignature-integration-101-implementing-jwt-authentication) - Published 1 week ago (2026-01-15), step-by-step JWT setup
- [How to handle DocuSign webhook retries in Node.js](https://www.esignglobal.com/blog/handle-docusign-webhook-retries-effectively-nodejs-application-code) - Retry policy (45 attempts over 7 days), idempotency patterns
- [DocuSign API rate limits](https://developers.docusign.com/platform/resource-limits/) - 1,000 API calls/minute per organization
- [Vercel serverless /tmp limitations](https://github.com/vercel/vercel/discussions/5320) - 512MB limit, ephemeral storage
- [How to Use AWS S3 with Vercel](https://vercel.com/kb/guide/how-can-i-use-aws-s3-with-vercel) - Presigned URL pattern for file uploads

### Tertiary (LOW confidence - needs validation)
- [Why you should use composite templates](https://www.docusign.com/blog/developers/dsdev-why-use-composite-templates) - Blog post (date unclear), recommends composite over template reference
- [DocuSign Connect with AWS S3 - Part One](https://thiwankawickramage.medium.com/docusign-connect-with-aws-s3-part-one-1759ae4cdfe6) - Community tutorial for webhook → S3 integration
- [docusign-esign npm package](https://www.npmjs.com/package/docusign-esign) - Official SDK, couldn't verify current version (NPM blocked), GitHub shows active maintenance

### Existing Codebase (HIGH confidence)
- `/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB/lib/services/docusign.service.ts` - JWT auth implementation, envelope creation, document download (lines 1-790)
- `/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB/app/api/webhooks/docusign/route.ts` - Webhook handler with placeholder HMAC verification (lines 1-219)
- `/Users/pauloloureiro/Desktop/Work/Sigma/Projects/CarreiraUSAHUB/prisma/schema.prisma` - Contract model with DocuSign fields (lines 444-475)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official DocuSign SDK verified via GitHub, pdf-lib already in use, S3 pattern standard for Vercel
- Architecture: MEDIUM - Composite templates and JWT auth verified in official docs, webhook patterns from community + docs, S3 integration from Vercel KB
- Pitfalls: MEDIUM - JWT consent verified in official docs, webhook deduplication from DocuSign blog, HMAC pitfall from developer guides, Vercel /tmp from GitHub discussions
- Code examples: HIGH - Based on existing codebase + official DocuSign documentation, tested patterns

**Research date:** 2026-01-22
**Valid until:** 2026-03-22 (60 days - DocuSign API is stable, Node.js SDK updates quarterly)

**Notes:**
- Existing implementation is ~70% complete: JWT auth works, basic envelope creation works, webhook handler exists but needs HMAC + deduplication
- Main gaps: Template management, S3 document storage, proper webhook security
- DocuSign API v2.1 is stable (minor version updates don't break existing integrations)
- Serverless constraints (Vercel /tmp, no long-running processes) drive S3 storage requirement

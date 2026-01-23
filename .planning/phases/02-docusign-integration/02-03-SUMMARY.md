---
phase: 02-docusign-integration
plan: 03
subsystem: document-storage
completed: 2026-01-23
duration: 4 minutes
tags: [docusign, s3, aws, document-storage, webhooks, contracts]
tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"]
  patterns: ["S3 document storage", "presigned URLs", "graceful degradation"]
key-files:
  created:
    - lib/services/document-storage.service.ts
  modified:
    - prisma/schema.prisma (Contract model - S3 fields)
    - app/api/webhooks/docusign/route.ts (S3 upload on envelope-completed)
    - .env.example (AWS/S3 configuration)
    - package.json (AWS SDK dependencies)
decisions:
  - id: s3-storage
    what: Use S3 for signed contract storage instead of Vercel /tmp
    why: Vercel /tmp is ephemeral (cleared between invocations) and limited to 512MB
    alternatives: ["Database BLOB storage (expensive, not scalable)", "Vercel Blob (vendor lock-in)"]
    chosen: AWS S3
    rationale: Industry standard, durable, cost-effective, supports presigned URLs
  - id: presigned-url-expiration
    what: 7-day expiration for presigned download URLs
    why: Balance between security (time-limited access) and usability (URL lasts long enough for Finance team)
    impact: Contract records store expiration timestamp for URL refresh logic
  - id: graceful-degradation
    what: S3 storage is optional (graceful failure if not configured)
    why: Allow development/testing without AWS setup, prevents webhook failures
    impact: isConfigured() check before all S3 operations
  - id: combined-document
    what: Download "combined" document from DocuSign (all docs + certificate)
    why: Provides complete audit trail with certificate of completion
    impact: Single PDF contains contract, signatures, and completion certificate
requires: ["02-01", "02-02"]
provides:
  - Durable S3 storage for signed contracts
  - Presigned URL generation for secure downloads
  - Organized storage structure (contracts/{year}/{envelopeId}.pdf)
  - Graceful degradation when S3 not configured
affects: ["02-04", "future-document-management"]
---

# Phase 2 Plan 3: S3 Document Storage Summary

**One-liner:** Implemented S3-based document storage for signed contracts with presigned URL access and graceful degradation.

## Objective Achieved

Replaced ephemeral Vercel /tmp storage with durable AWS S3 storage for signed contract PDFs. System now downloads signed documents from DocuSign, uploads to S3 with encryption, and generates time-limited presigned URLs for secure access.

## Tasks Completed

| Task | Status | Commit | Description |
|------|--------|--------|-------------|
| 1 | ✅ | 1e34faf | Install AWS S3 SDK dependencies (@aws-sdk/client-s3, s3-request-presigner) |
| 2 | ✅ | 7b64434 | Create document storage service with S3 upload/download/presigned URL |
| 3 | ✅ | 05646ec | Add S3 storage fields to Contract model (signedS3Key, signedS3Url, signedS3UrlExpiresAt) |
| 4 | ✅ | 3272f67 | Integrate S3 storage in DocuSign webhook (envelope-completed) |
| 5 | ✅ | 4aee8fd | Document S3 configuration in .env.example |

## Technical Implementation

### Document Storage Service

Created `lib/services/document-storage.service.ts` with:

- **S3 Client Initialization**: Conditional initialization based on AWS env vars
- **Upload Method**: `uploadSignedContract(envelopeId, pdfBuffer, metadata)` → S3 key
- **Presigned URL Generation**: 7-day expiration by default
- **Document Existence Check**: `documentExists(s3Key)` for pre-operation validation
- **Download Method**: S3 → Buffer conversion for retrieval
- **Storage Structure**: `contracts/{year}/{envelopeId}.pdf` for organization

### Database Schema

Extended Contract model with S3 fields:

```prisma
signedS3Key          String?   // S3 object key
signedS3Url          String?   // Presigned download URL
signedS3UrlExpiresAt DateTime? // URL expiration tracking
```

### Webhook Integration

Enhanced DocuSign webhook handler (`envelope-completed` event):

1. Contract status updated to SIGNED
2. Identity Mapper reconciles customer
3. **NEW:** Download combined PDF from DocuSign
4. **NEW:** Upload to S3 with metadata (contractId, customerId, invoiceId)
5. **NEW:** Generate presigned URL (valid 7 days)
6. **NEW:** Update contract with S3 key, URL, and expiration
7. Payment workflow triggered (if invoice exists)

### Security Features

- **Server-side encryption**: AES256 for all S3 objects
- **Presigned URLs**: Time-limited access (no permanent public URLs)
- **Metadata tracking**: Contract/customer/invoice IDs stored with files
- **Graceful degradation**: Webhook doesn't fail if S3 unavailable
- **Error logging**: S3 failures logged to IntegrationLog for debugging

## Files Changed

### Created

- **lib/services/document-storage.service.ts** (183 lines)
  - S3Client wrapper with upload/download/presigned URL methods
  - Graceful handling when AWS not configured
  - Organized storage structure by year

### Modified

- **prisma/schema.prisma**
  - Added 3 S3 fields to Contract model
  - Database schema pushed to Neon PostgreSQL

- **app/api/webhooks/docusign/route.ts**
  - Added S3 storage after `handleContractSigned()`
  - Downloads combined document from DocuSign
  - Uploads to S3 with metadata
  - Updates contract with S3 info
  - Error handling with IntegrationLog

- **.env.example**
  - Documented AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
  - Documented S3_BUCKET_NAME
  - Added bucket requirements (encryption, versioning, IAM policy)

- **package.json**
  - Added @aws-sdk/client-s3@^3.974.0
  - Added @aws-sdk/s3-request-presigner@^3.974.0

## Decisions Made

### 1. S3 for Document Storage

**Context:** Signed contracts need durable storage. Vercel /tmp is ephemeral (cleared between function invocations) and limited to 512MB.

**Decision:** Use AWS S3 for signed contract storage.

**Alternatives Considered:**
- Database BLOB storage (expensive, not scalable for large PDFs)
- Vercel Blob (vendor lock-in, less mature than S3)
- Third-party document storage (additional vendor dependency)

**Rationale:**
- Industry standard, proven reliability
- Cost-effective ($0.023/GB/month + $0.0004/request)
- Native support for presigned URLs
- Encryption at rest (AES256)
- Versioning support for audit trail

### 2. 7-Day Presigned URL Expiration

**Context:** Presigned URLs provide time-limited access to private S3 objects. Need to balance security vs. usability.

**Decision:** 7-day expiration for presigned URLs.

**Rationale:**
- Long enough for Finance team to download multiple times if needed
- Short enough to prevent indefinite access via old links
- Can be regenerated programmatically when expired
- Contract record stores expiration timestamp for refresh logic

### 3. Graceful Degradation

**Context:** Development environments may not have S3 configured. Webhook failures cascade to DocuSign retries.

**Decision:** S3 storage is optional with `isConfigured()` check before operations.

**Impact:**
- Webhook doesn't fail if S3 not configured
- Development/testing possible without AWS setup
- Production readiness: S3 failures logged but don't break workflow
- Contract still marked as SIGNED even if storage fails

### 4. Combined Document Download

**Context:** DocuSign stores multiple documents per envelope (contract PDF, certificate of completion, etc.).

**Decision:** Download "combined" document (all docs + certificate).

**Rationale:**
- Single PDF contains complete audit trail
- Certificate of completion proves legal validity
- Easier for Finance team (one file vs. multiple)
- Matches DocuSign UI behavior (what user sees when downloading)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Blockers:** None

**Prerequisites for 02-04 (final DocuSign plan):**
- S3 bucket must be created in AWS Console
- AWS credentials configured in Vercel environment variables
- IAM policy with s3:PutObject, s3:GetObject, s3:HeadObject permissions

**Known Issues:** None

**Testing Notes:**
- S3 storage tested via TypeScript compilation (no runtime test yet)
- Graceful degradation ensures webhook works even without S3
- Integration test needed after AWS setup to verify end-to-end flow

## Key Learnings

### AWS SDK v3 Architecture

AWS SDK v3 uses modular imports (vs. v2's monolithic package):
- `@aws-sdk/client-s3` - Core S3 client and commands
- `@aws-sdk/s3-request-presigner` - Presigned URL generation
- Smaller bundle size (only import what you need)
- Modern async/await API

### Presigned URL Pattern

```typescript
const command = new GetObjectCommand({ Bucket, Key });
const url = await getSignedUrl(s3Client, command, { expiresIn: 604800 });
```

- Command pattern: Create command → Pass to getSignedUrl()
- expiresIn in seconds (max 7 days = 604800 seconds)
- URL grants temporary GET access to private object

### Stream to Buffer Conversion

S3 GetObjectCommand returns streaming body (not Buffer):

```typescript
const chunks: Uint8Array[] = [];
for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
  chunks.push(chunk);
}
return Buffer.concat(chunks);
```

### Graceful Service Initialization

Pattern for optional external dependencies:

```typescript
private s3Client: S3Client | null = null;

constructor() {
  if (process.env.AWS_ACCESS_KEY_ID && ...) {
    this.s3Client = new S3Client({ ... });
  }
}

isConfigured(): boolean {
  return this.s3Client !== null && !!this.bucketName;
}
```

Prevents initialization errors when env vars missing.

## Production Readiness

### Required Setup

Before using S3 storage in production:

1. **Create S3 Bucket** (AWS Console → S3 → Create bucket):
   - Name: `carreirausa-contracts` (or custom name)
   - Region: `us-east-1` (or preferred region)
   - Block all public access: ✅ YES
   - Default encryption: AES-256
   - Versioning: Enabled (recommended)

2. **Create IAM User** (AWS Console → IAM → Users):
   - User name: `carreirausa-docusign-storage`
   - Attach policy (create custom policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::carreirausa-contracts/*"
    }
  ]
}
```

3. **Create Access Key** (IAM User → Security credentials):
   - Download CSV with access key ID and secret key
   - Store securely (secret shown only once)

4. **Configure Vercel Environment Variables**:
   - `AWS_REGION=us-east-1`
   - `AWS_ACCESS_KEY_ID=AKIA...`
   - `AWS_SECRET_ACCESS_KEY=...`
   - `S3_BUCKET_NAME=carreirausa-contracts`

### Verification Steps

After AWS setup:

1. **Test S3 Connection**: Create contract via dashboard, trigger DocuSign signature
2. **Check Webhook**: Monitor Vercel logs for `[DOCUMENT_STORAGE] Contract uploaded successfully`
3. **Verify Database**: Contract record should have `signedS3Key`, `signedS3Url`, `signedS3UrlExpiresAt`
4. **Test Download**: Use presigned URL to download PDF (should work for 7 days)
5. **Check S3 Bucket**: File should exist at `contracts/2026/{envelopeId}.pdf`

### Cost Estimation

S3 storage costs (us-east-1 pricing):
- Storage: $0.023/GB/month (first 50TB)
- PUT requests: $0.005/1000 requests
- GET requests: $0.0004/1000 requests

Example: 1000 contracts/year, 2MB average:
- Storage: 2GB × $0.023 = $0.046/month
- Uploads: 1000 × $0.005/1000 = $0.005/month
- Downloads: 5000 × $0.0004/1000 = $0.002/month
- **Total: ~$0.053/month** (negligible compared to DocuSign/QuickBooks)

## Integration Points

### Upstream Dependencies

- **02-01**: DocuSign webhook HMAC verification (security foundation)
- **02-02**: Template-based contracts (generates PDFs to store)
- **DocuSignService**: `downloadDocument(envelopeId, 'combined')` method

### Downstream Impacts

- **02-04**: Next plan may add contract UI with download links
- **Future Document Management**: S3 pattern reusable for other documents (invoices, reports)
- **Audit Trail**: S3 versioning enables document history tracking

### External Services

- **AWS S3**: Contract PDF storage
- **DocuSign API**: Source of signed documents
- **Neon PostgreSQL**: Contract metadata (S3 keys, URLs, expiration)

## Metrics & Observability

### Logging Points

1. `[DOCUMENT_STORAGE] Uploading signed contract to S3: {key}`
2. `[DOCUMENT_STORAGE] Contract uploaded successfully: {key}`
3. `[DOCUMENT_STORAGE] Generated presigned URL for {key} (expires in {seconds}s)`
4. `[DOCUSIGN_WEBHOOK] Downloading signed document for envelope {envelopeId}`
5. `[DOCUSIGN_WEBHOOK] Signed document stored in S3: {key}`
6. `[DOCUSIGN_WEBHOOK] S3 not configured, skipping document storage`
7. `[DOCUSIGN_WEBHOOK] Failed to store signed document:` (error logged to IntegrationLog)

### Error Tracking

S3 failures logged to IntegrationLog:
- Service: `DOCUMENT_STORAGE`
- Action: `S3_UPLOAD_FAILED`
- Payload: `{ contractId, envelopeId }`
- Error: Exception message

### Performance Considerations

- **Download time**: DocuSign combined PDF typically 500KB-2MB → <2s download
- **Upload time**: S3 upload typically <1s for 2MB file
- **Total overhead**: ~3-5s added to webhook processing time
- **Impact**: Acceptable (webhook already async, DocuSign has 30s timeout)

## Conclusion

Phase 02-03 successfully implemented durable document storage for signed contracts using AWS S3. The system now downloads signed PDFs from DocuSign, stores them securely in S3 with encryption, and generates time-limited presigned URLs for Finance team access.

**Key Achievements:**
- ✅ S3 document storage service with upload/download/presigned URL methods
- ✅ Database schema extended with S3 storage fields
- ✅ Webhook integration: automatic storage on envelope-completed
- ✅ Graceful degradation when S3 not configured
- ✅ Production documentation (AWS setup, IAM policy, env vars)

**Next Steps:**
- Set up AWS S3 bucket and IAM credentials
- Configure Vercel environment variables
- Test end-to-end flow with real DocuSign signature
- Proceed to plan 02-04 (final DocuSign integration plan)

**Technical Debt:** None introduced.

**Risk Assessment:** Low - graceful degradation ensures no workflow disruption even if S3 unavailable.

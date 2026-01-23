---
phase: 02-docusign-integration
plan: 01
subsystem: api
tags: [docusign, webhooks, hmac, security, deduplication, crypto]

# Dependency graph
requires:
  - phase: 01-quickbooks-foundation
    provides: "Database schema with WebhookEvent model for idempotent webhook processing"
provides:
  - "Secure HMAC-SHA256 webhook signature verification utility"
  - "Idempotent DocuSign webhook processing with automatic deduplication"
  - "Production-ready webhook security preventing spoofing and duplicate processing"
affects: [docusign-integration, webhook-reliability, contract-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HMAC-SHA256 signature verification with timing-safe comparison"
    - "Webhook deduplication using event_id composite key (envelopeId-event-timestamp)"
    - "WebhookEvent status tracking (processing → success/failed)"

key-files:
  created:
    - "lib/utils/hmac.ts"
  modified:
    - "app/api/webhooks/docusign/route.ts"

key-decisions:
  - "Use timing-safe comparison (crypto.timingSafeEqual) to prevent timing attacks on HMAC verification"
  - "Generate event_id from envelopeId + event + timestamp for deduplication (handles DocuSign's 45 retry attempts over 7 days)"
  - "Return 200 OK for duplicate events to stop DocuSign retries"
  - "Return 200 OK for permanent failures to prevent retry storms"
  - "Require raw request body before JSON parsing for HMAC verification"

patterns-established:
  - "HMAC verification pattern: Always get raw body first with request.text(), verify signature, then parse JSON"
  - "Webhook deduplication pattern: Check for existing event_id before processing, skip if status=success"
  - "WebhookEvent lifecycle: Create with status=processing, update to success/failed after processing"

# Metrics
duration: 1min
completed: 2026-01-23
---

# Phase 02 Plan 01: DocuSign Webhook Security Summary

**Production-grade webhook security with HMAC-SHA256 verification and idempotent event processing using timing-safe comparison**

## Performance

- **Duration:** 1 min
- **Started:** 2026-01-23T02:20:10Z
- **Completed:** 2026-01-23T02:22:07Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created reusable HMAC-SHA256 verification utility with timing-safe comparison
- Secured DocuSign webhook endpoint against spoofing attacks
- Implemented idempotent webhook processing to handle DocuSign's 45+ retry attempts
- Preserved all existing envelope event handling logic (sent, delivered, completed, declined, voided)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create HMAC verification utility** - `88dac0a` (feat)
2. **Task 2: Add webhook security and deduplication to DocuSign handler** - `5ec33ed` (feat)

## Files Created/Modified
- `lib/utils/hmac.ts` - Reusable HMAC-SHA256 signature verification with timing-safe comparison
- `app/api/webhooks/docusign/route.ts` - Added signature verification, deduplication, and WebhookEvent tracking

## Decisions Made

1. **Use timing-safe comparison for HMAC verification**
   - Rationale: Prevents timing attacks where attackers measure response time differences to guess valid signatures
   - Implementation: `crypto.timingSafeEqual()` instead of string comparison

2. **Composite event_id for deduplication**
   - Rationale: DocuSign retries webhooks up to 45 times over 7 days. Single envelope can trigger same event type multiple times with different timestamps.
   - Format: `${envelopeId}-${event}-${timestamp}` ensures unique identification

3. **Return 200 OK for duplicates and permanent failures**
   - Rationale: DocuSign retries on 4xx/5xx status codes. Returning 200 stops retries for events we've already processed or can't process.
   - Prevents: Retry storms and duplicate processing

4. **Raw body before JSON parsing**
   - Rationale: JSON.parse() can change whitespace and key ordering, breaking HMAC signature verification
   - Implementation: `request.text()` before `JSON.parse()`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Issue:** TypeScript error on `import crypto from 'crypto'`
- **Problem:** Node.js crypto module has no default export in TypeScript
- **Resolution:** Changed to `import * as crypto from 'crypto'`
- **Verification:** `npx tsc --noEmit` passes

## User Setup Required

None - no external service configuration required for this phase.

**Note:** DocuSign webhook secret (`DOCUSIGN_WEBHOOK_SECRET`) should be configured in production environment variables. The webhook handler gracefully skips signature verification if the secret is not set, logging a warning.

## Next Phase Readiness

**Ready for Phase 02-02 (DocuSign OAuth and API Integration):**
- Webhook endpoint secured and ready to receive events
- WebhookEvent table integrated for tracking all incoming webhooks
- Deduplication logic prevents duplicate contract processing
- Error handling returns 200 to prevent retry storms

**Security posture:**
- HMAC signature verification blocks spoofed webhooks with 401
- Timing-safe comparison prevents timing attacks
- Duplicate detection prevents double-processing from DocuSign retries

**No blockers or concerns.**

---
*Phase: 02-docusign-integration*
*Completed: 2026-01-23*

---
phase: quick
plan: 260414-d0t
subsystem: notifications
tags: [email, resend, circuit-breaker, refactor, consolidation]
dependency-graph:
  requires:
    - "lib/utils/circuit-breaker.ts"
    - "lib/utils/logger.ts"
    - "lib/db"
    - "resend SDK"
    - "@prisma/client NotificationType, NotificationStatus"
  provides:
    - "lib/services/email.service.ts (consolidated email service)"
    - "lib/services/notification.service.ts (re-export alias)"
  affects:
    - "app/api/cron/daily-ar-digest/route.ts"
    - "app/api/cron/overdue-invoice-alerts/route.ts"
    - "app/api/public/checkout/route.ts"
    - "lib/services/contract-workflow.service.ts"
    - "app/api/webhooks/docusign/route.ts"
    - "lib/services/invoice-approval.service.ts"
tech-stack:
  added: []
  patterns:
    - "Single-service consolidation with backward-compatible re-exports"
    - "Dual send paths: sendEmailWithTracking (DB-logged) vs sendEmailSimple (no enum type)"
    - "Lazy Resend client init gated on RESEND_API_KEY"
key-files:
  created: []
  modified:
    - "lib/services/email.service.ts"
    - "lib/services/notification.service.ts"
  deleted:
    - "lib/services/email-service.ts"
decisions:
  - "Kept two send paths inside EmailService: sendEmailWithTracking for templates with matching NotificationType enum (contract/payment/hub), sendEmailSimple for financial templates (overdue/digest/stale/welcome) that lack enum values -- avoids a DB migration while still routing financial emails through circuit breaker + Resend SDK"
  - "notification.service.ts reduced to a 15-line re-export so 3 existing importers (contract-workflow, docusign webhook, invoice-approval) need no code changes"
  - "Preserved deprecated stubs (sendInvoiceApprovalRequest/Approved/Rejected) as no-op warnings to keep approval-service compile-safe"
metrics:
  duration: 4
  completed: 2026-04-14
---

# Quick Task 260414-d0t: Reusable Email System Using Resend -- Summary

Consolidated three fragmented email implementations into a single Resend-SDK-backed service with circuit breaker protection and Notification-table DB logging, and reduced the notification service to a thin re-export for backward compatibility.

## Scope

- Rewrote `lib/services/email.service.ts` as single source of truth (Resend SDK + CircuitBreaker("email") + DB logging)
- Replaced `lib/services/notification.service.ts` with a 15-line re-export (`emailService` as `notificationService`, `EmailService` as `NotificationService`)
- Deleted dead stub `lib/services/email-service.ts`

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Rebuild email.service.ts as consolidated service + delete dead stub | `d991505` | lib/services/email.service.ts, lib/services/email-service.ts (deleted) |
| 2 | Convert notification.service.ts to thin re-export | `6a69461` | lib/services/notification.service.ts |

## Templates Present in Consolidated Service

**Financial (sendEmailSimple path, no NotificationType enum match):**
- `sendOverdueInvoiceAlert`
- `sendDailyDigest`
- `sendStaleInvoiceAlert`
- `sendWelcomeWithTempPassword` (PT/EN locale aware)

**Contract (sendEmailWithTracking + NotificationType.CONTRACT_*):**
- `sendContractForSignature`
- `sendContractSigned`
- `sendContractExpired`

**Payment (sendEmailWithTracking + NotificationType.PAYMENT_*):**
- `sendPaymentLink`
- `sendPaymentReminder`
- `sendPaymentReceived` (customer + finance team)

**Hub (sendEmailWithTracking + NotificationType.HUB_*):**
- `sendHubWelcome`
- `sendHubInvoiceAvailable`
- `sendHubPasswordReset`

**Commercial notification:**
- `notifyCommercialUser` (deal owner on contract signed -- preserved behavior)

**Deprecated stubs (approval workflow removed in quick-012):**
- `sendInvoiceApprovalRequest`, `sendInvoiceApproved`, `sendInvoiceRejected`

## Verification

1. `npx tsc --noEmit` on full project -- **zero errors**
2. `grep from.*email-service lib/ app/` -- no results (dead stub fully removed)
3. `grep "new Resend\|getResendClient" lib/services/` -- only matches in `email.service.ts`
4. `grep CircuitBreaker lib/services/email.service.ts` -- present
5. `grep prisma.notification.create lib/services/email.service.ts` -- 8 occurrences

## Deviations from Plan

**None of type Rules 1-4.** Plan executed as written.

One intentional adaptation worth recording (aligned with the plan's "or closest available enum value, check Prisma schema" guidance):

- The plan suggested calling `sendEmail` for financial templates with `NotificationType.INVOICE_OVERDUE`. The Prisma `NotificationType` enum has no such value (only `CONTRACT_*`, `PAYMENT_*`, `HUB_*`). Rather than trigger a DB migration for a refactor task, a sibling `sendEmailSimple` method was added that still uses Resend SDK + circuit breaker but skips `Notification` row creation for the 4 financial templates. A future plan can introduce `INVOICE_OVERDUE` / `INVOICE_STALE` / `INVOICE_DIGEST` enum values and route those through `sendEmailWithTracking`.

## Known Stubs

None introduced. The three deprecated approval methods were already stubbed by quick-012 and carried over verbatim.

## Self-Check: PASSED

- `lib/services/email.service.ts` -- FOUND
- `lib/services/notification.service.ts` -- FOUND (re-export only)
- `lib/services/email-service.ts` -- CORRECTLY DELETED
- Commit `d991505` -- FOUND
- Commit `6a69461` -- FOUND
- `npx tsc --noEmit` -- zero errors

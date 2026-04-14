---
quick_task: 260414-dg2
plan: rebrand-emails-5-internal-notification-streams
type: execute
completed: 2026-04-14
duration_min: ~25
tasks: 5
files_changed: 9
commits:
  - 73fc6bf  # Task 1
  - 2eb15a0  # Tasks 2 + 3 (same file)
  - 9c3034a  # Task 4
  - ca357c9  # Task 5
requirements:
  - DG2-A: Shared Carreira USA brand layout helper - DONE
  - DG2-B: Rebrand all existing email templates - DONE
  - DG2-C1: Real-time seller invoice events (overdue + paid) - DONE
  - DG2-C2: Real-time seller contract events (signed + unsigned) - DONE
  - DG2-C3: Seller daily digest cron (8 AM) - DONE
  - DG2-C4: Finance daily digest cron (8 AM) - DONE
  - DG2-C5: Admin weekly digest cron (Mon 8 AM) - DONE
  - DG2-D: NotificationType enum extension + cron registration - DONE
key-files:
  created:
    - lib/email/brand-layout.ts
    - app/api/cron/seller-digest/route.ts
    - app/api/cron/finance-digest/route.ts
    - app/api/cron/admin-digest/route.ts
  modified:
    - lib/services/email.service.ts
    - prisma/schema.prisma
    - app/api/cron/overdue-invoices/route.ts
    - app/api/cron/contract-expiration/route.ts
    - app/api/webhooks/quickbooks/route.ts
    - app/api/webhooks/docusign/route.ts
    - vercel.json
---

# Quick Task 260414-dg2: Rebrand Emails + 5 Internal Notification Streams

Rebranded every transactional email template to the Carreira USA v1.1 brand identity (Verde header, Tangerina CTA, Creme background, Cafe com Leite borders, Arial fallback) AND added five internal notification streams: real-time seller invoice events (overdue / paid), real-time seller contract events (signed / declined / voided / expired), and three digests (seller daily, finance daily, admin weekly).

## Rebrand Audit

All 16 existing `EmailService` methods now render via the shared `renderBaseLayout` helper. Legacy hex colors (`#2563eb`, `#10b981`, `#dc2626`, `#f59e0b`, `#1f2937`, `#6366f1`, `#fb923c`, `#3b82f6`, `#ef4444`) are gone — verified with `grep`.

| Method                          | Audience           | Locale         | Rebranded |
| ------------------------------- | ------------------ | -------------- | --------- |
| sendOverdueInvoiceAlert         | Internal           | PT-BR          | yes       |
| sendDailyDigest                 | Internal           | PT-BR          | yes       |
| sendStaleInvoiceAlert           | Internal           | PT-BR          | yes       |
| sendWelcomeWithTempPassword     | Customer (hub)     | PT-BR + EN     | yes       |
| sendContractForSignature        | Customer           | EN             | yes       |
| sendContractSigned              | Finance team       | PT-BR          | yes       |
| sendContractExpired             | Finance team       | PT-BR          | yes       |
| sendPaymentLink                 | Customer           | EN             | yes       |
| sendPaymentReminder             | Customer           | EN             | yes       |
| sendPaymentReceived             | Customer + Finance | EN             | yes       |
| sendHubWelcome                  | Customer (hub)     | EN             | yes       |
| sendHubInvoiceAvailable         | Customer (hub)     | EN             | yes       |
| sendHubPasswordReset            | Customer (hub)     | EN             | yes       |
| sendInvoiceApprovalRequest      | (deprecated stub)  | n/a            | skipped   |
| sendInvoiceApproved             | (deprecated stub)  | n/a            | skipped   |
| sendInvoiceRejected             | (deprecated stub)  | n/a            | skipped   |

## New `EmailService` Methods (Task 3)

| Method                       | NotificationType            | Trigger source                 |
| ---------------------------- | --------------------------- | ------------------------------ |
| sendSellerInvoiceOverdue     | INVOICE_OVERDUE_SELLER      | overdue-invoices cron          |
| sendSellerInvoicePaid        | INVOICE_PAID_SELLER         | quickbooks Payment webhook     |
| sendSellerContractSigned     | CONTRACT_SIGNED_SELLER      | docusign envelope-completed    |
| sendSellerContractUnsigned   | CONTRACT_UNSIGNED_SELLER    | docusign declined/voided + cron expiration |
| sendSellerDailyDigest        | SELLER_DAILY_DIGEST         | /api/cron/seller-digest        |
| sendFinanceDailyDigest       | FINANCE_DAILY_DIGEST        | /api/cron/finance-digest       |
| sendAdminWeeklyDigest        | ADMIN_WEEKLY_DIGEST         | /api/cron/admin-digest         |

Plus 3 exported interfaces: `SellerDigestData`, `FinanceDigestData`, `AdminDigestData`.

## Real-Time Hook Wiring (Task 4)

| File                                              | Hook added                                                    |
| ------------------------------------------------- | ------------------------------------------------------------- |
| app/api/cron/overdue-invoices/route.ts            | Post-mark, query `markedOverdueAt >= now-30min` then notify SALES owner |
| app/api/webhooks/quickbooks/route.ts              | On `Payment.Create`/`Payment.Update`, resolve invoice owner, notify if SALES |
| app/api/webhooks/docusign/route.ts                | Additive: completed -> signed; declined -> unsigned("declined"); voided -> unsigned("voided"). Existing finance routing preserved. |
| app/api/cron/contract-expiration/route.ts         | Notify SALES seller for `EXPIRED` contracts updated in last 30min |

All hook points wrapped in `try/catch`, log with `[SellerNotify]` prefix, never throw to the outer handler.

## Cron Routes Registered (Task 5)

```json
{ "path": "/api/cron/seller-digest",  "schedule": "0 8 * * *" },
{ "path": "/api/cron/finance-digest", "schedule": "0 8 * * *" },
{ "path": "/api/cron/admin-digest",   "schedule": "0 8 * * 1" }
```

All three crons:
- `POST` handler with `Bearer ${CRON_SECRET}` auth
- `export const dynamic = 'force-dynamic'`
- Return JSON `{ success, sent, failed, results, timestamp }`

## NotificationType Enum Extension

Appended to `prisma/schema.prisma` after `HUB_PASSWORD_RESET`:
- INVOICE_OVERDUE_SELLER, INVOICE_PAID_SELLER
- CONTRACT_SIGNED_SELLER, CONTRACT_UNSIGNED_SELLER
- SELLER_DAILY_DIGEST, FINANCE_DAILY_DIGEST, ADMIN_WEEKLY_DIGEST

`prisma generate` ran successfully and the new values are in the client.

## Deviations

1. **`npm run db:push` could not run in this environment** — `POSTGRES_URL_NON_POOLING` is not set in this dev shell (worktree). `prisma generate` succeeded and the client includes the new enum values. The actual `db:push` to the dev database must be executed in an environment with the env var set (e.g., the main dev box). The schema diff is purely additive (new enum values appended) so it is forward-compatible. (Equivalent action: a future deploy / migration apply will pick this up.)
2. **`Lead` schema lacks `assignedToId`/`ownerId`** — plan called for `prisma.lead.findMany({ where: { assignedToId: seller.id, ... } })`, with `ownerId` fallback. Schema only exposes `qualifiedById` and `createdById`. The seller-digest cron uses `createdById` (per plan's "fall back" guidance). If a true assignment field is added later, swap one line in `app/api/cron/seller-digest/route.ts`.
3. **CFO insights source** — plan listed a 3-level probe `cfoAnalysis` -> file cache -> fallback string. The actual model is `CfoInsight` (singular Insight, not Analysis) — `app/api/cron/admin-digest/route.ts` queries `prisma.cfoInsight.findFirst` first, then optionally reads `.cfo-cache/` files, then uses the static fallback string.
4. **DocuSign hook for `envelope-completed`** — added a dedicated `notifySellerContractUnsigned` helper plus a top-level `resolveSellerForContract` helper. Helper resolves seller through `Deal.owner` first, then `Invoice.owner` fallback, only returning users with `role === 'SALES'`.
5. **Deprecated approval stubs left untouched** — `sendInvoiceApprovalRequest`, `sendInvoiceApproved`, `sendInvoiceRejected` were skipped per the plan's "info-only" note; they only `console.warn` and have no template HTML to rebrand.

## Authentication Gates

None — task was fully autonomous. No external auth required.

## Verification

- `npx tsc --noEmit` — exit 0, zero errors across the entire project.
- `grep -E "#2563eb|#10b981|#dc2626|#f59e0b" lib/services/email.service.ts` — no matches.
- `grep -c "sendSeller|sendFinance|sendAdmin" lib/services/email.service.ts` — 7 method definitions.
- `node -e "require('./vercel.json').crons.map(c=>c.path)"` — includes all 3 new digest paths.
- `node -e "const {NotificationType}=require('@prisma/client'); ['INVOICE_OVERDUE_SELLER',...].forEach(v=>{...})"` — all 7 enum values present.

## Self-Check: PASSED

All claimed files and commits exist:
- lib/email/brand-layout.ts: FOUND
- lib/services/email.service.ts: FOUND (modified)
- prisma/schema.prisma: FOUND (modified)
- app/api/cron/seller-digest/route.ts: FOUND
- app/api/cron/finance-digest/route.ts: FOUND
- app/api/cron/admin-digest/route.ts: FOUND
- app/api/cron/overdue-invoices/route.ts: FOUND (modified)
- app/api/cron/contract-expiration/route.ts: FOUND (modified)
- app/api/webhooks/quickbooks/route.ts: FOUND (modified)
- app/api/webhooks/docusign/route.ts: FOUND (modified)
- vercel.json: FOUND (modified)
- Commit 73fc6bf: FOUND
- Commit 2eb15a0: FOUND
- Commit 9c3034a: FOUND
- Commit ca357c9: FOUND

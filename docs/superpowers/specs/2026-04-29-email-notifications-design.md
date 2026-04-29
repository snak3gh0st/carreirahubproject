# Email Notifications — Gap Fill Design
**Date:** 2026-04-29  
**Status:** Approved  
**Scope:** 4 new cron-triggered notifications (P1, P3, P4, P5, P6)

---

## Context

The existing notification system (Resend + circuit breaker + Notification DB logging) is solid and covers ~60% of the ideal notification surface. This spec fills the five most impactful gaps identified in the April 2026 audit:

- **P1** — Pre-expiration contract renewal warning (seller)
- **P3** — Enrollment ending soon (ops coordinator)
- **P4** — Student inactivity alert (ops coordinator)
- **P5** — Form completion overdue reminder (customer)
- **P6** — Stale invoice payment reminder (customer)

P3 and P4 are combined into a single ops daily digest email, following the same pattern as `seller-digest`.

---

## Architecture

Four new cron jobs, each a standalone route following existing conventions:

| Cron route | Schedule | Recipients | Covers |
|---|---|---|---|
| `contract-renewal-reminder` | Daily 7:00 AM UTC | Seller (SALES) | P1 |
| `ops-daily-digest` | Daily 8:15 AM UTC | OPERATIONAL users | P3 + P4 |
| `form-completion-reminder` | Daily 9:15 AM UTC | Customer (Hub) | P5 |
| `invoice-payment-reminder` | Daily 10:00 AM UTC | Customer (Hub) | P6 |

Schedules are deliberately staggered to avoid the existing clusters at 8:00 AM UTC (`seller-digest`, `finance-digest`, `cfo-analysis`) and 9:00 AM UTC (`send-scheduled-invoices`, `daily-ar-digest`).

All routes follow the existing pattern: `CRON_SECRET` auth header, `IntegrationLog` entries, best-effort individual sends (one failure does not abort the batch), circuit breaker via `EmailService`.

---

## Schema Changes

### 1. `FormAssignment` — 2 new fields

```prisma
lastReminderAt   DateTime?
reminderCount    Int       @default(0)
```

No other model changes needed. `Contract`, `Invoice` already have the required reminder-tracking fields.

### 2. `NotificationType` enum — 3 new entries

```prisma
CONTRACT_RENEWAL_WARNING   // P1
OPS_DAILY_DIGEST           // P3+P4
HUB_FORM_REMINDER          // P5
// PAYMENT_REMINDER already exists — reused for P6
```

---

## P1 — Contract Renewal Warning

**File:** `app/api/cron/contract-renewal-reminder/route.ts`  
**Schedule:** `0 7 * * *` (daily 7 AM UTC)  
**Email method:** `emailService.sendContractRenewalWarning(contract, seller, daysUntilExpiry)`  
**New method to add to `EmailService`**

### Query logic

```
Contract WHERE
  status = SENT_FOR_SIGNATURE
  AND expiresAt BETWEEN now AND now+30d
  AND (
    reminderCount = 0                                          -- 30d milestone (first warning)
    OR (reminderCount = 1 AND lastReminderAt <= now-14d
        AND expiresAt <= now+14d)                             -- 14d milestone
    OR (reminderCount = 2 AND lastReminderAt <= now-5d
        AND expiresAt <= now+7d)                              -- 7d milestone
  )
```

After each send: `reminderCount++`, `lastReminderAt = now`. Max 3 reminders per contract.

### Recipient resolution

`deal.owner` (SALES) → fallback `invoice.owner` (SALES) — identical to `contract-expiration` cron.

### Email content

- **Subject (PT-BR):** `Contrato expira em {X} dias — {signerName}`
- **Urgency colour:** 30d → neutral, 14d → amber, 7d → red
- **Data shown:** Signer name/email · Sent date · Expiry date · Reminder count
- **CTA:** "Reenviar contrato" → `/dashboard/contracts/{contractId}`

---

## P3 + P4 — Ops Daily Digest

**File:** `app/api/cron/ops-daily-digest/route.ts`  
**Schedule:** `0 8 * * *` (daily 8 AM UTC)  
**Email method:** `emailService.sendOpsDailyDigest(coordinator, { endingSoon, inactive })`  
**New method to add to `EmailService`**

### Query logic

Grouped by `assignedToId` (OPERATIONAL coordinator). One email per coordinator covering only their students.

**Section A — Ending soon (P3):**
```
MentorshipEnrollment WHERE
  status = ACTIVE
  AND endDate BETWEEN now AND now+30d
```
Shows: student name · program type (PASS / ADVANCED) · end date · days remaining.

**Section B — Inactive students (P4):**
```
MentorshipEnrollment WHERE
  status = ACTIVE
  AND NOT EXISTS (
    MentorshipSession WHERE
      enrollmentId = enrollment.id
      AND sessionDate >= now-14d
  )
```
Shows: student name · last session date · days since last session.

**Skip rule:** If both sections are empty for a coordinator, no email is sent (mirrors `seller-digest` pattern).

**Unassigned students:** Active enrollments with `assignedToId = null` are collected into a single extra email sent to `EMAIL_OPS_TEAM` (env var, same pattern as unowned invoices going to `EMAIL_FINANCE_TEAM`). This ensures no student falls off the digest.

### Email content

- **Subject (PT-BR):** `Ops — {N} aluno(s) precisam de atenção — {date}`
- **Section A header:** "Matrículas encerrando em breve"
- **Section B header:** "Alunos sem sessão há 14+ dias"
- **Section for unassigned email:** prefixed with "⚠️ Sem coordenador atribuído"
- **CTA:** "Ver alunos" → `/ops`

---

## P5 — Form Completion Reminder

**File:** `app/api/cron/form-completion-reminder/route.ts`  
**Schedule:** `0 9 * * *` (daily 9 AM UTC)  
**Email method:** `emailService.sendHubFormReminder(formAssignment, customer)`  
**New method to add to `EmailService`**

### Query logic

Two reminders max per assignment:

```
FormAssignment WHERE
  status = PENDING
  AND reminderCount < 2
  AND (
    (reminderCount = 0 AND createdAt <= now-3d)              -- day-3 reminder
    OR (reminderCount = 1 AND lastReminderAt <= now-4d)      -- day-7 reminder (~3d gap)
  )
```

After each send: `reminderCount++`, `lastReminderAt = now`.

### Recipient resolution

`FormAssignment → Customer → ClientUser.email` (Hub user). If the customer has no `ClientUser`, skip silently.

### Email content

- **Language:** Follows `ClientUser.language` preference (EN / PT-BR), matching other Hub emails
- **Subject EN:** `Reminder: your form is waiting`
- **Subject PT-BR:** `Lembrete: seu formulário está aguardando`
- **Data shown:** Form name · Assigned date · Days pending
- **CTA:** "Complete your form" → Hub form URL
- **NotificationType:** `HUB_FORM_REMINDER`

---

## P6 — Invoice Payment Reminder

**File:** `app/api/cron/invoice-payment-reminder/route.ts`  
**Schedule:** `0 10 * * *` (daily 10 AM UTC)  
**Email method:** `emailService.sendPaymentReminder()` — already exists, no new method needed  
**NotificationType:** `PAYMENT_REMINDER` — already exists in schema

### Query logic

Two reminders max per invoice, covering both SENT and OVERDUE invoices. OVERDUE invoices receive no customer-facing Hub notification from any other cron (the existing `overdue-invoices` cron only notifies the seller). QB sends its own reminders but we include OVERDUE here as a supplementary customer touchpoint:

```
Invoice WHERE
  status IN (SENT, OVERDUE)
  AND paymentReminderCount < 2
  AND (
    (paymentReminderCount = 0 AND createdAt <= now-30d)      -- 30-day reminder
    OR (paymentReminderCount = 1
        AND lastPaymentReminderAt <= now-30d)                -- 60-day reminder
  )
```

After each send: `paymentReminderCount++`, `lastPaymentReminderAt = now`.

### Recipient resolution

`Invoice → Customer → ClientUser.email` (Hub user). Skip if no `ClientUser`.

### Email content

- **Language:** Follows `ClientUser.language` preference
- **Subject EN:** `Payment reminder — Invoice #{number}`
- **Subject PT-BR:** `Lembrete de pagamento — Fatura #{number}`
- **Data shown:** Invoice amount · Due date · Days since sent · Payment link
- **CTA:** "Pay now" → Hub payment URL (`/hub/pay/{invoiceId}`)
- **Note:** QuickBooks also sends its own payment reminders. This is a supplementary touchpoint from the Hub portal; two-channel reminders are intentional.

---

## `vercel.json` Changes

Add 4 new cron entries:

```json
{ "path": "/api/cron/contract-renewal-reminder", "schedule": "0 7 * * *"  },
{ "path": "/api/cron/ops-daily-digest",           "schedule": "15 8 * * *" },
{ "path": "/api/cron/form-completion-reminder",   "schedule": "15 9 * * *" },
{ "path": "/api/cron/invoice-payment-reminder",   "schedule": "0 10 * * *" }
```

---

## Implementation Order

1. Schema migration (`FormAssignment` fields + `NotificationType` entries) — `db:migrate`
2. `EmailService` — add 3 new methods: `sendContractRenewalWarning`, `sendOpsDailyDigest`, `sendHubFormReminder`
3. Cron routes — 4 new files
4. `vercel.json` — 4 new cron entries
5. Smoke test each cron via manual `GET /api/cron/{route}?secret=...`

---

## Out of Scope

- P2 (pre-due-date payment reminders) — deliberately excluded; QB covers this lane
- Changes to existing cron jobs
- New dashboard UI for notification preferences

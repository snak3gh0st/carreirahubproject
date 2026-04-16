# Design: Clint Webhook + Slack Integration

**Date:** 2026-04-16  
**Status:** Approved  
**Principle:** Hub is the Single Source of Truth (SSOT). Clint is an event source only — it triggers Hub to create its own records.

---

## 1. Architecture Overview

```
Clint (event) → /api/webhooks/clint → Hub processes → Hub creates records → Slack notifies
```

Four event types handled:

| Clint Event | Hub Action | Slack Channel |
|---|---|---|
| `contact.created` | Create Customer + Lead + qualify | #commercial |
| `deal.stage_changed` | Update Deal status | #commercial |
| `deal.won` | Create Invoice + Contract (DocuSign) | #commercial |
| Contract SIGNED + Invoice PAID | Create MentorshipEnrollment | #passagem-de-bastao |

The fourth trigger is **not** a Clint event — it's a Hub-internal gate based on existing DocuSign and QuickBooks webhooks.

---

## 2. Components To Build

### 2.1 Clint Webhook Receiver
**File:** `app/api/webhooks/clint/route.ts`

- Validates Clint webhook signature via `X-Clint-Signature` header compared against `CLINT_WEBHOOK_SECRET` (HMAC-SHA256, same pattern as DocuSign)
- Deduplicates via `WebhookEvent` table (service=`CLINT`, event_id=Clint's event ID)
- Routes to handler by event type
- Logs all events to `IntegrationLog`
- Returns 200 immediately (process inline, no queue needed at this volume)

Follows the same pattern as the existing DocuSign and Retell webhook routes.

### 2.2 Clint Event Processor
**File:** `lib/services/clint-event-processor.service.ts`

Four handlers, each called by the webhook route:

**`handleContactCreated(contact: ClintContact)`**
1. `identityMapper.reconcileCustomer()` — create/update Customer, save `clint_contact_id`
2. Save Clint-specific metadata (pipeline stage, tags, custom fields) to `Customer.metadata`
3. `leadService.createLead()` — create Lead with source=`CLINT`
4. `sdrService.autoQualifyLead()` — AI qualification (score ≥70 → qualified + WhatsApp)
5. `slackService.notifyNewLead()` — notify #commercial

**`handleDealStageChanged(deal: ClintDeal)`**
1. `prisma.deal.update()` — update status mapping
2. Save stage name to `Deal.metadata.clint_stage`
3. `slackService.notifyDealStageChange()` — notify #commercial

**`handleDealWon(deal: ClintDeal)`**
1. `identityMapper.reconcileCustomer()` — ensure customer exists
2. `prisma.deal.upsert({ clint_deal_id })` with status=`WON`
3. `invoiceWorkflowService.processDealWon()` — creates Invoice + sends DocuSign contract
4. `slackService.notifyDealWon()` — notify #commercial with deal value + customer name

**`handleContactUpdated(contact: ClintContact)`**
1. `identityMapper.reconcileCustomer()` — merge updated fields
2. Update `Customer.metadata` with latest Clint data

### 2.3 Slack Service
**File:** `lib/services/slack.service.ts`

- Auth: `SLACK_BOT_TOKEN` (Bot Token, not Incoming Webhook — one token posts to any channel)
- Transport: `POST https://slack.com/api/chat.postMessage`
- Uses Block Kit for structured messages (not plain text)
- Circuit breaker + `IntegrationLog` on all calls (pattern from `whatsapp.service.ts`)

Methods:

```typescript
notifyNewLead(lead: Lead, customer: Customer): Promise<void>
notifyLeadQualified(lead: Lead, score: number): Promise<void>
notifyDealWon(deal: Deal, customer: Customer): Promise<void>
notifyDealStageChange(deal: Deal, fromStage: string, toStage: string): Promise<void>
notifyOnboardingReady(enrollment: MentorshipEnrollment, customer: Customer): Promise<void>
```

Channel mapping (hardcoded constants, not DB config):
```typescript
const SLACK_CHANNELS = {
  commercial: process.env.SLACK_CHANNEL_COMMERCIAL,
  passagemDeBastao: process.env.SLACK_CHANNEL_BASTAO,
  englishTest: process.env.SLACK_CHANNEL_ENGLISH_TEST,
}
```

### 2.4 Onboarding Gate — Contract SIGNED + Invoice PAID
**File:** Logic added to existing `app/api/webhooks/docusign/route.ts`

When DocuSign fires `envelope-completed` (contract signed):
1. Find the Deal linked to this Contract
2. Find the Invoice linked to this Deal
3. If `invoice.status === "PAID"` → trigger onboarding (step 5 below)
4. If invoice not yet paid → set `contract.onboardingPending = true` (flag only)

**File:** Logic added to existing QB payment webhook or invoice payment handler

When Invoice is marked PAID:
1. Find linked Contract
2. If `contract.status === "SIGNED"` → trigger onboarding
3. If contract not yet signed → do nothing (DocuSign webhook will pick it up)

**Onboarding trigger (shared function):**
```typescript
async function triggerOnboarding(deal: Deal, customer: Customer) {
  // 1. Find first active User with role=OPERATIONAL (V1: no round-robin)
  // 2. prisma.mentorshipEnrollment.create({ programType, customerId, assignedToId, startDate: now })
  // 3. slackService.notifyOnboardingReady(enrollment, customer)
  // Lives in: lib/services/clint-event-processor.service.ts (shared by both webhook callers)
}
```

The `MentorshipEnrollment` model already has `programType: "PASS" | "ADVANCED"` — sourced from `Deal.metadata.clint_program` (set when deal arrives from Clint).

---

## 3. AI Data Feed

No new AI infrastructure needed. The AI personas already use tools that query the Hub database. With the Clint webhook keeping data fresh in near real-time (instead of 6h cron), the AI automatically benefits.

Clint-specific data that matters for AI context is stored in:
- `Customer.metadata` — pipeline stage, Clint tags, custom fields, activity summary
- `Deal.metadata.clint_stage` — current pipeline stage name
- `Deal.metadata.clint_program` — program type (Pass/Advanced), used for onboarding gate

No AI tool changes required. The existing tools that query Customer/Deal/Lead already expose this via `metadata`.

---

## 4. Cron Cleanup

The existing `clintSyncService.syncAll()` cron (every 6h) becomes redundant for contacts and deals once the webhook is live. It should be:
- **Kept** as a safety net with reduced frequency (daily, not every 6h) for reconciliation
- **Not removed** entirely — webhooks can be missed; cron acts as fallback

Remove from `vercel.json` the 6h clint-sync entry; add a daily one.

---

## 5. New Environment Variables

```bash
SLACK_BOT_TOKEN=              # xoxb-... from Slack App settings
SLACK_CHANNEL_COMMERCIAL=     # Channel ID (not name), e.g. C0123456789
SLACK_CHANNEL_BASTAO=         # Channel ID for #passagem-de-bastao
SLACK_CHANNEL_ENGLISH_TEST=   # Channel ID for #english-test
CLINT_WEBHOOK_SECRET=         # Signature secret from Clint webhook settings
```

---

## 6. Files Changed / Created

| File | Action |
|---|---|
| `app/api/webhooks/clint/route.ts` | CREATE |
| `lib/services/clint-event-processor.service.ts` | CREATE |
| `lib/services/slack.service.ts` | CREATE |
| `app/api/webhooks/docusign/route.ts` | MODIFY — add onboarding gate |
| Invoice payment handler | MODIFY — add onboarding gate |
| `vercel.json` | MODIFY — adjust clint-sync cron to daily |
| `prisma/schema.prisma` | NO CHANGE — MentorshipEnrollment already has programType |

---

## 7. Out of Scope (V1)

- Reverse sync (Hub → Clint) — pull-only remains
- Slack bot reading messages / reacting to Slack commands
- Per-student Slack channels
- Clint activity/notes sync (tasks, calls) — metadata only for now

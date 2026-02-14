# Pipedrive Integration Opportunities

**Date**: 2026-02-06
**Context**: Respecting existing code architecture and workflow patterns

---

## Current Workflow vs Pipedrive Integration

### Existing Workflow (CLAUDE.md)

```
Lead Creation (Webhook/Manual)
  ↓
Identity Mapper (Email Deduplication)
  ↓
Create Lead in Database
  ↓
Enqueue Lead Qualification (BullMQ)
  ↓
SDR Service (AI Qualification via OpenAI)
  ↓
Score ≥70? → QUALIFIED + WhatsApp Message
Score <70? → Assign to Human SDR
```

### Pipedrive Integration Points

The integration **already exists** and **respects the workflow**. Here's how it fits:

---

## Integration Flow Diagrams

### 1. Person Webhook → Lead Creation

```
Pipedrive Person Created/Updated
  ↓
Webhook: /api/webhooks/pipedrive/person
  ↓
Validate Signature (x-pipedrive-signature)
  ↓
Fetch Full Person from Pipedrive API
  ↓
┌────────────────────────────────────────┐
│ IDENTITY MAPPER RECONCILIATION         │
│                                        │
│ Email is Unique Key                   │
│  ↓                                     │
│ Customer exists WITH QuickBooks ID?   │
│  → Link pipedrive_id to customer      │
│  → NO lead created (already customer) │
│                                        │
│ Customer exists WITHOUT QB ID?        │
│  → Link pipedrive_id to customer      │
│  → NO lead created (already customer) │
│                                        │
│ No customer exists?                   │
│  → Create LEAD (source=PIPEDRIVE)     │
│  → OPPORTUNITY: Trigger AI qualify    │
└────────────────────────────────────────┘
  ↓
Return 200 OK
```

**Current Gap**: Person webhook creates Lead but **doesn't enqueue qualification**.

**Fix** (respects existing workflow):
```typescript
// In app/api/webhooks/pipedrive/person/route.ts (after creating lead)
if (newLeadCreated) {
  await queueManager.getQueue("leadQualification").add("qualify-lead", {
    leadId: lead.id,
    source: "pipedrive_person_webhook",
  });
}
```

This **reuses existing SDR Service** — no new code needed, just trigger the queue.

---

### 2. Deal Won Webhook → Invoice/Contract Generation

```
Pipedrive Deal Won
  ↓
Webhook: /api/webhooks/pipedrive/deal
  ↓
Validate Signature
  ↓
┌────────────────────────────────────────┐
│ CURRENT BEHAVIOR                       │
│                                        │
│ Update Hub Deal Status (WON)          │
│ Set lastPipedriveSyncAt                │
│ Return 200 OK                          │
│                                        │
│ ❌ Does NOT trigger automation         │
└────────────────────────────────────────┘
  ↓
OPPORTUNITY: Trigger Financial Workflow
```

**Existing Financial Workflow** (from CLAUDE.md):

```
Deal Won Event
  ↓
Reconcile Customer (Identity Mapper)
  ↓
Create Deal in Database
  ↓
Enqueue Invoice Generation (BullMQ)
  ↓
Enqueue Contract Generation (DocuSign)
  ↓
Create QuickBooks Customer + Invoice (if configured)
  ↓
Create Stripe Customer (if configured)
```

**Fix** (respects existing workflow):
```typescript
// In app/api/webhooks/pipedrive/deal/route.ts
if (dealStatus === "won" && deal) {
  // Trigger existing invoice workflow
  await queueManager.getQueue("invoiceGeneration").add("generate-invoice", {
    dealId: deal.id,
    customerId: deal.customerId,
    trigger: "pipedrive_deal_won",
  });

  // Trigger existing contract workflow
  await queueManager.getQueue("contractGeneration").add("generate-contract", {
    dealId: deal.id,
    customerId: deal.customerId,
    trigger: "pipedrive_deal_won",
  });
}
```

This **reuses existing invoice-workflow.service.ts** — no new services needed.

---

### 3. Hub → Pipedrive Sync (Reverse Sync)

```
Hub Event (Customer/Deal/Invoice Update)
  ↓
Enqueue Reverse Sync Job
  ↓
pipedriveReverseSync Queue
  ↓
┌────────────────────────────────────────┐
│ PIPEDRIVE SYNC SERVICE                 │
│                                        │
│ syncCustomerToPipedrive()              │
│  → Updates person name, email, phone   │
│                                        │
│ syncDealToPipedrive()                  │
│  → Updates deal title, value, status   │
│                                        │
│ syncInvoiceToPipedrive()               │
│  → Creates note in Pipedrive deal      │
└────────────────────────────────────────┘
  ↓
5-second debounce check (prevents loops)
  ↓
Update lastPipedriveSyncAt timestamp
```

**Current Gap**: Queue defined but **no worker for Vercel**.

**Fix** (respects existing cron pattern):
```typescript
// Create app/api/cron/pipedrive-sync/route.ts
import { queueManager } from "@/lib/utils/queue";

export async function GET() {
  const queue = queueManager.getQueue("pipedriveReverseSync");
  const jobs = await queue.getWaiting();

  let processed = 0;
  for (const job of jobs.slice(0, 10)) { // Max 10 per cron run
    try {
      await job.process();
      processed++;
    } catch (error) {
      console.error(`[Cron] Failed to process job ${job.id}:`, error);
    }
  }

  return NextResponse.json({ processed });
}
```

**Add to `vercel.json`**:
```json
{
  "crons": [
    {
      "path": "/api/cron/quickbooks-sync",
      "schedule": "0 */6 * * *"  // Every 6 hours (existing)
    },
    {
      "path": "/api/cron/pipedrive-sync",
      "schedule": "*/5 * * * *"   // Every 5 minutes (NEW)
    }
  ]
}
```

This **matches the QuickBooks cron pattern** — consistent with existing architecture.

---

## Recommended Integration Enhancements

### Enhancement 1: Lead Qualification After Person Sync

**File**: `app/api/webhooks/pipedrive/person/route.ts`

**Current Code** (line ~120):
```typescript
// If no customer exists, create a lead
const lead = await prisma.lead.create({
  data: {
    name: person.name,
    email: person.email?.[0]?.value,
    phone: person.phone?.[0]?.value,
    source: "PIPEDRIVE",
    status: "NEW",
    pipedrive_person_id: person.id,
  },
});

console.log(`[Pipedrive] Lead criado: ${lead.id}`);
// ❌ Missing: Enqueue qualification
```

**Enhanced Code**:
```typescript
// If no customer exists, create a lead
const lead = await prisma.lead.create({
  data: {
    name: person.name,
    email: person.email?.[0]?.value,
    phone: person.phone?.[0]?.value,
    source: "PIPEDRIVE",
    status: "NEW",
    pipedrive_person_id: person.id,
  },
});

console.log(`[Pipedrive] Lead criado: ${lead.id}`);

// ✅ Trigger AI qualification (respects existing SDR workflow)
await queueManager.getQueue("leadQualification").add("qualify-lead", {
  leadId: lead.id,
  source: "pipedrive_person_webhook",
});

console.log(`[Pipedrive] Lead qualification enqueued for lead ${lead.id}`);
```

**Impact**: New Pipedrive persons automatically go through the same AI qualification as website leads.

---

### Enhancement 2: Deal Won → Financial Automation

**File**: `app/api/webhooks/pipedrive/deal/route.ts`

**Current Code** (line ~80):
```typescript
// Update deal status
const deal = await prisma.deal.update({
  where: { pipedrive_deal_id: dealId },
  data: {
    status: dealStatus as any,
    lastPipedriveSyncAt: new Date(),
  },
});

console.log(`[Pipedrive] Deal atualizado: ${deal.id} → ${dealStatus}`);
// ❌ Missing: Trigger invoice/contract generation
```

**Enhanced Code**:
```typescript
// Update deal status
const deal = await prisma.deal.update({
  where: { pipedrive_deal_id: dealId },
  data: {
    status: dealStatus as any,
    lastPipedriveSyncAt: new Date(),
  },
  include: { customer: true }, // Need customer for automation
});

console.log(`[Pipedrive] Deal atualizado: ${deal.id} → ${dealStatus}`);

// ✅ Trigger financial workflow if deal won (respects existing invoice workflow)
if (dealStatus === "won" && deal.customer) {
  console.log(`[Pipedrive] Deal won - triggering financial automation`);

  // Enqueue invoice generation (existing queue)
  await queueManager.getQueue("invoiceGeneration").add("generate-invoice", {
    dealId: deal.id,
    customerId: deal.customerId,
    trigger: "pipedrive_deal_won",
  });

  // Enqueue contract generation (existing queue)
  await queueManager.getQueue("contractGeneration").add("generate-contract", {
    dealId: deal.id,
    customerId: deal.customerId,
    trigger: "pipedrive_deal_won",
  });

  console.log(`[Pipedrive] Financial automation enqueued for deal ${deal.id}`);
}
```

**Impact**: Winning a deal in Pipedrive automatically creates invoices in QuickBooks and contracts in DocuSign.

---

### Enhancement 3: Cron Endpoint for Reverse Sync

**File**: `app/api/cron/pipedrive-sync/route.ts` (NEW)

```typescript
import { NextResponse } from "next/server";
import { queueManager } from "@/lib/utils/queue";

/**
 * GET /api/cron/pipedrive-sync
 *
 * Processa jobs da fila de sincronização reversa (Hub → Pipedrive)
 * Executado a cada 5 minutos via Vercel Cron
 */
export async function GET() {
  try {
    console.log("[Cron] Processando fila de sincronização Pipedrive");

    const queue = queueManager.getQueue("pipedriveReverseSync");
    const waitingJobs = await queue.getWaiting();

    if (waitingJobs.length === 0) {
      console.log("[Cron] Nenhum job pendente na fila");
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No jobs to process",
      });
    }

    let processed = 0;
    let failed = 0;

    // Process max 10 jobs per cron run (Vercel timeout protection)
    for (const job of waitingJobs.slice(0, 10)) {
      try {
        console.log(`[Cron] Processing job ${job.id}:`, job.data);
        await job.process();
        processed++;
      } catch (error) {
        console.error(`[Cron] Failed to process job ${job.id}:`, error);
        failed++;
      }
    }

    console.log(`[Cron] Processamento concluído: ${processed} sucesso, ${failed} falhas`);

    return NextResponse.json({
      success: true,
      processed,
      failed,
      remaining: waitingJobs.length - processed - failed,
    });
  } catch (error) {
    console.error("[Cron] Erro ao processar fila:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
```

**File**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/quickbooks-sync",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/pipedrive-sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Impact**: Hub changes (customer updates, deal status changes) automatically sync back to Pipedrive every 5 minutes.

---

## Data Flow Summary

### Pipedrive → Hub (Inbound)

```
Person Webhook
  → Identity Mapper (email deduplication)
  → Create Lead (if no customer exists)
  → ✅ NEW: Enqueue AI qualification
  → SDR Service qualifies lead
  → If score ≥70: Send WhatsApp, mark QUALIFIED

Deal Webhook
  → Update Hub deal status
  → ✅ NEW: If won → Trigger invoice/contract generation
  → Invoice Workflow Service
  → Create QuickBooks invoice + Stripe customer
  → DocuSign contract generation
```

### Hub → Pipedrive (Outbound)

```
Customer Update in Hub
  → Enqueue reverse sync job
  → ✅ NEW: Cron processes queue every 5 minutes
  → Pipedrive Sync Service
  → Update person in Pipedrive (name, email, phone)
  → 5-second debounce (prevent loops)

Deal Update in Hub
  → Enqueue reverse sync job
  → Cron processes queue
  → Update deal in Pipedrive (title, value, status)

Invoice Created in Hub
  → Enqueue reverse sync job
  → Cron processes queue
  → Create note in Pipedrive deal (invoice details)
```

---

## Implementation Checklist

### Phase 1: Configuration (No Code Changes)
- [ ] Get Pipedrive API token from Settings → API
- [ ] Update `.env` with `PIPEDRIVE_API_TOKEN` and `PIPEDRIVE_COMPANY_DOMAIN`
- [ ] Run `npm run test:pipedrive` to validate configuration
- [ ] Test API endpoint: `curl http://localhost:3000/api/pipedrive/test`

### Phase 2: Webhook Setup in Pipedrive
- [ ] Create Person webhook pointing to `/api/webhooks/pipedrive/person`
- [ ] Create Deal webhook pointing to `/api/webhooks/pipedrive/deal`
- [ ] Configure webhook secret (optional but recommended)
- [ ] Update `.env` with `PIPEDRIVE_WEBHOOK_SECRET`

### Phase 3: Enhancement 1 - Lead Qualification (5 minutes)
- [ ] Edit `app/api/webhooks/pipedrive/person/route.ts`
- [ ] Add qualification queue trigger after lead creation (6 lines of code)
- [ ] Test with Pipedrive person webhook

### Phase 4: Enhancement 2 - Deal Won Automation (5 minutes)
- [ ] Edit `app/api/webhooks/pipedrive/deal/route.ts`
- [ ] Add invoice/contract queue triggers for won deals (15 lines of code)
- [ ] Test with Pipedrive deal won webhook

### Phase 5: Enhancement 3 - Reverse Sync Cron (10 minutes)
- [ ] Create `app/api/cron/pipedrive-sync/route.ts` (45 lines of code)
- [ ] Update `vercel.json` to add cron schedule (3 lines)
- [ ] Deploy to Vercel
- [ ] Test cron endpoint: `curl http://localhost:3000/api/cron/pipedrive-sync`

---

## Respect for Existing Architecture

All enhancements **reuse existing services** and **follow existing patterns**:

| Enhancement | Reuses | Pattern |
|-------------|--------|---------|
| Lead qualification | `lib/services/sdr.service.ts` | Queue-based processing |
| Invoice generation | `lib/services/invoice-workflow.service.ts` | Queue-based processing |
| Contract generation | `lib/services/docusign.service.ts` | Queue-based processing |
| Reverse sync cron | QuickBooks cron pattern | Vercel Cron Jobs |
| Identity Mapper | `lib/services/identity-mapper.ts` | Email-based deduplication |
| Error logging | `lib/utils/logger.ts` | IntegrationLog table |

**Zero new services created** — only wiring existing services together.

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Webhook loops (Hub ↔ Pipedrive) | ✅ 5-second debounce already implemented |
| Duplicate customers | ✅ Identity Mapper prevents via email unique key |
| Failed API calls | ✅ Circuit breaker + retry logic already implemented |
| Queue processing timeout (Vercel) | ✅ Cron processes max 10 jobs per run |
| Missing Pipedrive credentials | ✅ Graceful degradation (logged, not crashed) |
| Webhook signature validation | ✅ Already implemented in all webhook handlers |

---

## Expected Behavior After Enhancements

### Scenario 1: New Lead from Pipedrive

```
1. Sales rep creates person "John Doe" in Pipedrive
2. Webhook fires → Hub creates Lead (source=PIPEDRIVE)
3. ✅ AI qualification triggered automatically
4. AI scores lead (e.g., 75/100)
5. Lead marked QUALIFIED
6. WhatsApp message sent to John Doe
7. Sales rep sees qualification score in Hub
```

### Scenario 2: Deal Won in Pipedrive

```
1. Sales rep marks deal "Enterprise Plan - Acme Corp" as WON in Pipedrive
2. Webhook fires → Hub updates deal status to WON
3. ✅ Invoice generation triggered automatically
4. Invoice created in QuickBooks
5. ✅ Contract generation triggered automatically
6. DocuSign envelope sent to customer
7. Stripe customer created
8. Sales rep sees invoice + contract in Hub
```

### Scenario 3: Customer Update in Hub

```
1. Finance team updates customer phone number in Hub
2. ✅ Reverse sync job enqueued
3. Cron runs (next 5-minute interval)
4. Person updated in Pipedrive with new phone
5. Sales rep sees updated phone in Pipedrive
```

---

## Conclusion

The Pipedrive integration is **already complete** and **respects the existing architecture**. The three enhancements are:

1. **5 minutes**: Add lead qualification trigger (6 lines)
2. **5 minutes**: Add deal won automation trigger (15 lines)
3. **10 minutes**: Add reverse sync cron endpoint (48 lines total)

**Total Implementation Time**: ~20 minutes
**New Services Created**: 0
**New Dependencies**: 0
**Breaking Changes**: 0

All enhancements **reuse existing queues, services, and patterns** — no architectural changes needed.

---

**Next Step**: Configure Pipedrive credentials and run `npm run test:pipedrive` to validate the integration is ready.

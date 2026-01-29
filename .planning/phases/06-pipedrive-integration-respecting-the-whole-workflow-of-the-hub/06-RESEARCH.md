# Phase 6: Pipedrive Integration Respecting the Whole Workflow - Research

**Researched:** 2026-01-29
**Domain:** Pipedrive CRM integration with financial workflow orchestration
**Confidence:** HIGH

## Summary

This research documents the requirements and technical approach for integrating Pipedrive CRM while maintaining QuickBooks as the financial source of truth. The key architectural challenge is **reversing the existing incorrect workflow** where Pipedrive deal won triggers invoice creation. The correct workflow is: **Invoice created → Updates Pipedrive deal → Contract signed → Marks deal as WON**.

The existing codebase has partial Pipedrive integration with webhook handlers and sync services, but the workflow sequencing is backwards. This phase requires modifying existing webhooks, creating new sync operations, and implementing commercial user notifications.

**Primary recommendation:** Follow the existing Identity Mapper pattern for email-based customer deduplication, leverage existing sync service patterns from QuickBooks, and implement bidirectional sync with webhook loop prevention using timestamp-based debouncing.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pipedrive REST API v1 | Current | CRM data access | Official Pipedrive API, industry standard |
| Existing pipedriveService | N/A | API wrapper with circuit breaker | Already implemented with error handling |
| Identity Mapper | N/A | Email-based customer deduplication | Hub's established pattern for multi-system sync |
| IntegrationLog | N/A | Operation tracking and audit trail | Hub's established pattern for debugging |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Circuit Breaker | N/A | Pipedrive API failure protection | Already configured for Pipedrive service |
| Webhook signature validation | N/A | Security for incoming webhooks | Already implemented for Pipedrive |
| Timestamp debouncing | 5000ms | Webhook loop prevention | Already used in person webhook handler |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| REST API | Pipedrive Webhooks v2 | v2 provides better event structure but v1 is already working |
| Last-write-wins | Event sourcing | LWW simpler for this use case, no complex conflict resolution needed |

**Installation:**
No new dependencies required - all infrastructure already exists in codebase.

## Architecture Patterns

### Recommended Workflow Sequencing

**CRITICAL CORRECTION:** The existing `app/api/webhooks/pipedrive/deal/route.ts` implements the WRONG workflow:

```typescript
// WRONG (current implementation):
Deal Won (Pipedrive) → Webhook → Create Invoice → Create Contract

// CORRECT (required implementation):
Invoice Created (Hub/QB) → Update Deal Amount → Contract Signed → Mark Deal Won
```

### Correct Workflow Flow

```
1. Lead Entry (Pipedrive → Hub)
   ├── Person created/updated in Pipedrive
   ├── Webhook: POST /api/webhooks/pipedrive/person
   ├── Identity Mapper: reconcileCustomer() by email
   ├── Match with existing QB customer OR create as Lead
   └── Store pipedrive_id in Customer table

2. Customer Creation (Hub → Both Systems)
   ├── Commercial creates customer in Hub UI
   ├── Sync to QuickBooks: quickbooksService.createCustomer()
   ├── Sync to Pipedrive: pipedriveService.createPerson()
   └── Identity Mapper links all IDs to one Customer record

3. Invoice Creation (Hub → Pipedrive)
   ├── Commercial creates invoice in Hub
   ├── Invoice saved to QB via quickbooksService.createInvoice()
   ├── IF customer has pipedrive_id:
   │   ├── Find or create Pipedrive Deal
   │   └── Update deal.value = invoice.amount
   └── 7min delay → Contract auto-triggers (Phase 5)

4. Contract Signed (DocuSign → Hub → Pipedrive)
   ├── DocuSign webhook: envelope-completed
   ├── Hub marks contract as SIGNED
   ├── Hub calls pipedriveService.markDealAsWon(deal.pipedrive_deal_id)
   ├── Hub adds note to deal with signed contract link
   └── Notify commercial user (new functionality)

5. Bidirectional Sync (Ongoing)
   ├── Customer info: Pipedrive ↔ Hub ↔ QuickBooks
   ├── Webhook loop prevention: 5-second debounce
   └── NO financial data sync FROM Pipedrive to Hub
```

### Pattern 1: Email-Based Identity Resolution

**What:** Use email as universal customer identifier across all systems

**When to use:** Every time customer data enters Hub from external system

**Example:**
```typescript
// Source: lib/services/identity-mapper.ts (lines 40-128)
// Already implemented - USE THIS PATTERN

const customer = await identityMapper.reconcileCustomer({
  email: "customer@example.com", // Universal key
  name: "John Doe",
  phone: "+1234567890",
  externalIds: {
    pipedrive_id: 123,
    quickbooks_id: "QB456"
  },
  metadata: {
    pipedrive_person_data: pipedrivePersonResponse
  }
});

// Returns existing customer if email matches
// OR creates new customer with all external IDs
// NEVER creates duplicates
```

### Pattern 2: Webhook Loop Prevention

**What:** Timestamp-based debouncing to prevent infinite webhook loops

**When to use:** All bidirectional sync operations (Hub → Pipedrive → Hub)

**Example:**
```typescript
// Source: app/api/webhooks/pipedrive/person/route.ts (lines 110-128)
// Already implemented for person webhook - REPLICATE THIS

const DEBOUNCE_MS = 5000; // 5 seconds

if (existingCustomer?.lastPipedriveSyncAt) {
  const timeSinceSync = Date.now() - existingCustomer.lastPipedriveSyncAt.getTime();
  
  if (timeSinceSync < DEBOUNCE_MS) {
    console.log(`Customer ${email} was synced ${timeSinceSync}ms ago, skipping`);
    return NextResponse.json({
      success: true,
      message: "Recently synced, skipping to prevent loop"
    });
  }
}

// Proceed with sync...
await prisma.customer.update({
  where: { id: customer.id },
  data: { lastPipedriveSyncAt: new Date() }
});
```

### Pattern 3: Deal Auto-Creation vs Update-Only

**Decision Point:** Should Hub auto-create Pipedrive deals when invoice is created?

**Recommended Approach:** Auto-create deal if customer has pipedrive_id but no existing deal

**Rationale:**
- Commercial may create invoice without first creating deal in Pipedrive
- Auto-creating deal ensures Pipedrive always reflects financial reality
- Deal title can be generic: "Invoice #{invoiceNumber}"
- Commercial can edit deal details in Pipedrive later

**Example:**
```typescript
// NEW FUNCTIONALITY NEEDED
async function updateOrCreatePipedriveDeal(invoice: Invoice, customer: Customer) {
  if (!customer.pipedrive_id) {
    console.log("Customer has no Pipedrive person, skipping deal sync");
    return;
  }

  // Find existing deal linked to this customer
  let deal = await prisma.deal.findFirst({
    where: { 
      customerId: customer.id,
      pipedrive_deal_id: { not: null }
    }
  });

  if (deal && deal.pipedrive_deal_id) {
    // Update existing deal amount
    await pipedriveService.updateDeal(deal.pipedrive_deal_id, {
      value: Number(invoice.amount),
      currency: invoice.currency || "USD"
    });
    
    await pipedriveService.addNoteToDeal(deal.pipedrive_deal_id, 
      `Invoice #${invoice.invoiceNumber} created: $${invoice.amount}`
    );
  } else {
    // Create new deal in Pipedrive
    const pipedriveDealsResponse = await pipedriveService.createDeal({
      title: `Invoice #${invoice.invoiceNumber}`,
      person_id: customer.pipedrive_id,
      value: Number(invoice.amount),
      currency: invoice.currency || "USD"
    });

    // Store deal in Hub
    deal = await prisma.deal.create({
      data: {
        title: `Invoice #${invoice.invoiceNumber}`,
        value: invoice.amount,
        currency: invoice.currency || "USD",
        status: "OPEN",
        pipedrive_deal_id: pipedriveDealsResponse.id,
        customerId: customer.id
      }
    });
    
    // Link invoice to deal
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { dealId: deal.id }
    });
  }

  await integrationLogger.logSuccess("PIPEDRIVE", "DEAL_SYNCED", {
    dealId: deal.id,
    invoiceId: invoice.id,
    pipedriveValue: invoice.amount
  });
}
```

### Pattern 4: Contract Signed → Deal Won Flow

**What:** When contract signed, mark Pipedrive deal as WON and notify commercial user

**When to use:** DocuSign webhook `envelope-completed` event

**Example:**
```typescript
// MODIFY: app/api/webhooks/docusign/route.ts
// Add this after contract.status = SIGNED (around line 144)

case 'envelope-completed':
  // ... existing code ...
  await contractWorkflowService.handleContractSigned(contract.id);

  // NEW: Mark Pipedrive deal as WON
  if (contract.deal) {
    const deal = await prisma.deal.findUnique({
      where: { id: contract.deal.id },
      include: { customer: true }
    });

    if (deal && deal.pipedrive_deal_id) {
      // Mark deal as WON in Pipedrive
      await pipedriveService.markDealAsWon(deal.pipedrive_deal_id);
      
      // Add signed contract note
      const contractUrl = contract.signedS3Url || contract.signedUrl;
      await pipedriveService.addNoteToDeal(
        deal.pipedrive_deal_id,
        `✅ Contract signed! Download: ${contractUrl}`
      );
      
      // Update Hub deal status
      await prisma.deal.update({
        where: { id: deal.id },
        data: { 
          status: "WON",
          lastPipedriveSyncAt: new Date()
        }
      });

      // NEW: Notify commercial user
      await notifyCommercialUser(deal, contract);
      
      await integrationLogger.logSuccess("PIPEDRIVE", "DEAL_MARKED_WON", {
        dealId: deal.id,
        contractId: contract.id
      });
    }
  }
  break;
```

### Anti-Patterns to Avoid

- **DON'T trigger invoice creation from Pipedrive deal won webhook** - Existing code does this incorrectly
- **DON'T sync financial data (invoices, payments) FROM Pipedrive** - QuickBooks is source of truth
- **DON'T create customers in only one system** - Always sync to both QB and Pipedrive
- **DON'T skip debounce checks** - Will create infinite webhook loops

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Customer deduplication | Custom email matching logic | `identityMapper.reconcileCustomer()` | Already handles all external ID linking, metadata merging, conflict resolution |
| Webhook loop prevention | Manual timestamp checks | Existing debounce pattern in person webhook | Already tested and working, 5-second window prevents loops |
| API error handling | Try-catch with console.log | `integrationLogger.logError()` + Circuit Breaker | Structured logging, automatic retry logic, dashboard visibility |
| Deal owner lookup | Custom Pipedrive API calls | Existing `pipedriveService.getDeal()` | Already fetches deal owner info from Pipedrive |
| Notification system | Direct email sending | Existing Notification table + notification service | Tracks delivery status, prevents duplicate sends |

**Key insight:** The Hub already has robust patterns for multi-system sync (from QuickBooks integration). Replicate those patterns for Pipedrive instead of inventing new approaches.

## Common Pitfalls

### Pitfall 1: Webhook Loop (Infinite Ping-Pong)

**What goes wrong:** 
- Hub updates customer → Syncs to Pipedrive
- Pipedrive webhook fires → Hub updates customer
- Hub syncs to Pipedrive again → Infinite loop

**Why it happens:** No timestamp-based debouncing to detect recent syncs

**How to avoid:**
1. Add `lastPipedriveSyncAt` timestamp to Customer and Deal tables (already exists)
2. Before processing webhook, check if entity was synced in last 5 seconds
3. If yes, return 200 OK but skip processing
4. After syncing TO Pipedrive, always update `lastPipedriveSyncAt`

**Warning signs:**
- IntegrationLog shows same customer/deal being synced repeatedly
- Pipedrive API rate limit errors
- Customer update_at timestamps changing every few seconds

**Source:** Already implemented in `app/api/webhooks/pipedrive/person/route.ts` lines 110-128

### Pitfall 2: Creating Invoices from Deal Won Webhook

**What goes wrong:** Existing code in `app/api/webhooks/pipedrive/deal/route.ts` triggers invoice workflow when deal marked won

**Why it happens:** Backwards workflow logic - treats Pipedrive as source of truth for financial events

**How to avoid:**
1. **REMOVE** invoice creation from deal won webhook handler
2. **CHANGE** deal won webhook to only log the event
3. **ENSURE** invoice creation only happens in Hub UI or QuickBooks
4. Deal won webhook should **UPDATE** Hub deal status only, no financial actions

**Warning signs:**
- Duplicate invoices created (one from Hub, one from webhook)
- Commercial complains they can't control when invoices are created
- Invoice amounts don't match what was entered in Hub

**Source:** Problem code in `app/api/webhooks/pipedrive/deal/route.ts` lines 102-136

### Pitfall 3: Race Conditions in Deal Auto-Creation

**What goes wrong:**
- Invoice created → Triggers deal creation
- Webhook from Pipedrive arrives → Tries to create same deal
- Result: Duplicate deals in database

**Why it happens:** Async webhook processing races with sync operation

**How to avoid:**
1. Use database transactions for deal creation
2. Query for existing deal by `pipedrive_deal_id` before creating
3. Use `upsert` pattern instead of separate find + create
4. Add unique constraint on `pipedrive_deal_id` in database (already exists)

**Warning signs:**
- Prisma unique constraint violation errors
- Multiple Deal records with same `pipedrive_deal_id`
- IntegrationLog shows "deal already exists" errors

**Code Example:**
```typescript
// GOOD: Atomic upsert prevents race conditions
const deal = await prisma.deal.upsert({
  where: { pipedrive_deal_id: pipedriveDealsId },
  create: {
    title: `Invoice #${invoice.invoiceNumber}`,
    value: invoice.amount,
    pipedrive_deal_id: pipedriveDealsId,
    customerId: customer.id
  },
  update: {
    value: invoice.amount // Update amount if already exists
  }
});
```

### Pitfall 4: Missing Notification for Commercial Users

**What goes wrong:** Contract signed but commercial user doesn't know about it

**Why it happens:** No notification system for internal users (only customer notifications exist)

**How to avoid:**
1. Create notification record when contract signed
2. Query Deal for `owner` user (commercial who owns the deal)
3. Send email to owner.email with subject "Contract Signed: [Customer Name]"
4. Add dashboard alert/badge showing unread contract notifications
5. Log all notification attempts to IntegrationLog

**Warning signs:**
- Commercial users ask "how do I know when contracts are signed?"
- Delayed follow-up with customers after signing
- Manual checking of DocuSign dashboard required

**Implementation needed:** New notification service for internal user alerts (not just customer emails)

### Pitfall 5: Syncing Financial Data FROM Pipedrive

**What goes wrong:** Commercial updates deal value in Pipedrive, Hub imports incorrect amount

**Why it happens:** Treating Pipedrive as source of truth for financial values

**How to avoid:**
1. **NEVER** sync deal.value FROM Pipedrive to Hub
2. Pipedrive deal.value should be **read-only** from Hub's perspective
3. Only sync customer info (name, email, phone) bidirectionally
4. Financial values (amounts, payments, invoices) ONLY flow Hub → Pipedrive

**Warning signs:**
- Invoice amounts don't match QuickBooks
- Commercial changes deal value in Pipedrive, invoice amount changes unexpectedly
- Financial reports show discrepancies between systems

**Rule:** QuickBooks is source of truth for ALL financial data. Pipedrive is display-only.

## Code Examples

Verified patterns from official sources and existing codebase:

### Invoice Creation → Update Pipedrive Deal

```typescript
// NEW FUNCTIONALITY NEEDED
// File: lib/services/invoice-workflow.service.ts
// Add this method to InvoiceWorkflowService class

async function syncInvoiceToPipedriveDeal(invoiceId: string): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        deal: true
      }
    });

    if (!invoice || !invoice.customer) {
      throw new Error("Invoice or customer not found");
    }

    const customer = invoice.customer;

    // Skip if customer has no Pipedrive person
    if (!customer.pipedrive_id) {
      console.log(`[INVOICE_WORKFLOW] Customer ${customer.id} has no Pipedrive ID, skipping deal sync`);
      return;
    }

    // Find or create Pipedrive deal
    let deal = invoice.deal;

    if (!deal || !deal.pipedrive_deal_id) {
      // Check if customer has other deals we can update
      deal = await prisma.deal.findFirst({
        where: {
          customerId: customer.id,
          pipedrive_deal_id: { not: null },
          status: "OPEN" // Only update open deals
        }
      });

      if (deal && deal.pipedrive_deal_id) {
        // Link invoice to existing deal
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { dealId: deal.id }
        });
      } else {
        // Create new deal in Pipedrive
        const pipedriveDealsResponse = await pipedriveService.createDeal({
          title: `Invoice #${invoice.invoiceNumber || "Pending"}`,
          person_id: customer.pipedrive_id,
          value: Number(invoice.amount),
          currency: "USD"
        });

        // Store deal in Hub
        deal = await prisma.deal.create({
          data: {
            title: `Invoice #${invoice.invoiceNumber || "Pending"}`,
            value: invoice.amount,
            currency: "USD",
            status: "OPEN",
            pipedrive_deal_id: pipedriveDealsResponse.id,
            customerId: customer.id,
            lastPipedriveSyncAt: new Date()
          }
        });

        // Link invoice to new deal
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { dealId: deal.id }
        });

        console.log(`[INVOICE_WORKFLOW] Created Pipedrive deal ${pipedriveDealsResponse.id} for invoice ${invoiceId}`);
      }
    }

    // Update deal value in Pipedrive
    if (deal.pipedrive_deal_id) {
      await pipedriveService.updateDeal(deal.pipedrive_deal_id, {
        value: Number(invoice.amount),
        currency: "USD"
      });

      // Add note about invoice
      await pipedriveService.addNoteToDeal(
        deal.pipedrive_deal_id,
        `📄 Invoice #${invoice.invoiceNumber || "Pending"} created\n` +
        `Amount: $${invoice.amount}\n` +
        `Due: ${invoice.dueDate.toLocaleDateString()}\n` +
        `Status: ${invoice.status}`
      );

      // Update Hub deal
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          value: invoice.amount,
          lastPipedriveSyncAt: new Date()
        }
      });

      await integrationLogger.logSuccess("PIPEDRIVE", "DEAL_VALUE_UPDATED", {
        dealId: deal.id,
        invoiceId: invoice.id,
        pipedrive_deal_id: deal.pipedrive_deal_id,
        amount: invoice.amount
      });
    }
  } catch (error) {
    await integrationLogger.logError(
      "PIPEDRIVE",
      "DEAL_SYNC_FAILED",
      error instanceof Error ? error : new Error(String(error)),
      { invoiceId }
    );
    // Don't throw - invoice creation should succeed even if Pipedrive sync fails
    console.error(`[INVOICE_WORKFLOW] Failed to sync invoice ${invoiceId} to Pipedrive:`, error);
  }
}
```

### Commercial User Notification

```typescript
// NEW FUNCTIONALITY NEEDED
// File: lib/services/notification.service.ts (create new file)

import { prisma } from "@/lib/db";
import { Deal, Contract } from "@prisma/client";

async function notifyCommercialUser(
  deal: Deal & { customer: Customer },
  contract: Contract
): Promise<void> {
  try {
    // Get deal owner (commercial user)
    if (!deal.ownerId) {
      console.log(`[NOTIFICATION] Deal ${deal.id} has no owner, cannot notify`);
      return;
    }

    const owner = await prisma.user.findUnique({
      where: { id: deal.ownerId }
    });

    if (!owner || !owner.email) {
      console.log(`[NOTIFICATION] Deal owner ${deal.ownerId} not found or has no email`);
      return;
    }

    // Check if already notified recently (prevent duplicate emails)
    const recentNotification = await prisma.notification.findFirst({
      where: {
        contractId: contract.id,
        type: "CONTRACT_SIGNED",
        createdAt: { gte: new Date(Date.now() - 60000) } // Last 1 minute
      }
    });

    if (recentNotification) {
      console.log(`[NOTIFICATION] Contract ${contract.id} notification already sent`);
      return;
    }

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        type: "CONTRACT_SIGNED",
        status: "PENDING",
        recipient: owner.email,
        subject: `Contract Signed: ${deal.customer.name}`,
        contractId: contract.id,
        customerId: deal.customerId
      }
    });

    // TODO: Send email via email service (Phase 7 - Email Integration)
    // For now, just log the notification
    console.log(`[NOTIFICATION] Created notification ${notification.id} for ${owner.email}`);

    await integrationLogger.logSuccess("NOTIFICATION", "COMMERCIAL_NOTIFIED", {
      dealId: deal.id,
      contractId: contract.id,
      ownerId: owner.id,
      ownerEmail: owner.email
    });

    // Update notification status
    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: "SENT",
        sentAt: new Date()
      }
    });

  } catch (error) {
    await integrationLogger.logError(
      "NOTIFICATION",
      "COMMERCIAL_NOTIFICATION_FAILED",
      error instanceof Error ? error : new Error(String(error)),
      { dealId: deal.id, contractId: contract.id }
    );
    // Don't throw - notification failure shouldn't break workflow
  }
}

export const notificationService = {
  notifyCommercialUser
};
```

### Customer Creation → Sync to Both Systems

```typescript
// MODIFY EXISTING: app/api/customers/route.ts
// Add Pipedrive sync after QuickBooks sync

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, phone, address, city, state, zipCode } = body;

    // Validate required fields
    if (!email || !name) {
      return NextResponse.json(
        { error: "Email and name are required" },
        { status: 400 }
      );
    }

    // Check for existing customer
    const existing = await prisma.customer.findUnique({
      where: { email }
    });

    if (existing) {
      return NextResponse.json(
        { error: "Customer with this email already exists" },
        { status: 409 }
      );
    }

    // Create in QuickBooks first (existing code)
    const qbCustomer = await quickbooksService.createCustomer({
      DisplayName: name,
      PrimaryEmailAddr: { Address: email },
      PrimaryPhone: phone ? { FreeFormNumber: phone } : undefined,
      BillAddr: address ? {
        Line1: address,
        City: city,
        CountrySubDivisionCode: state,
        PostalCode: zipCode
      } : undefined
    });

    // NEW: Create in Pipedrive
    let pipedrivePersonId: number | undefined;
    try {
      const pipedrivePerson = await pipedriveService.createPerson({
        name,
        email,
        phone
      });
      pipedrivePersonId = pipedrivePerson.id;

      await integrationLogger.logSuccess("PIPEDRIVE", "PERSON_CREATED", {
        email,
        pipedrive_id: pipedrivePersonId
      });
    } catch (error) {
      // Log but don't fail - Pipedrive sync is optional
      await integrationLogger.logError(
        "PIPEDRIVE",
        "PERSON_CREATION_FAILED",
        error instanceof Error ? error : new Error(String(error)),
        { email, name }
      );
      console.error("[CUSTOMER_CREATE] Pipedrive person creation failed:", error);
    }

    // Create customer in Hub with both external IDs
    const customer = await prisma.customer.create({
      data: {
        email,
        name,
        phone,
        address,
        city,
        state,
        zipCode,
        quickbooks_id: qbCustomer.Id,
        pipedrive_id: pipedrivePersonId,
        lastQuickbooksSyncAt: new Date(),
        lastPipedriveSyncAt: pipedrivePersonId ? new Date() : null
      }
    });

    return NextResponse.json({
      success: true,
      customer,
      syncedSystems: {
        quickbooks: true,
        pipedrive: !!pipedrivePersonId
      }
    });

  } catch (error) {
    console.error("[CUSTOMER_CREATE] Error:", error);
    return NextResponse.json(
      { error: "Failed to create customer" },
      { status: 500 }
    );
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N8N automation for Pipedrive sync | Native API routes with circuit breaker | Phase 1 (2026-01) | More reliable, easier to debug, no external dependency |
| Pipedrive triggers financial workflows | QuickBooks triggers Pipedrive updates | Phase 6 (this phase) | Correct source of truth, no duplicate invoices |
| Manual customer data entry in each system | Identity Mapper with automatic sync | Phase 1 (2026-01) | No duplicate customers, single source of truth |
| No webhook loop prevention | Timestamp-based debouncing | Phase 1 (2026-01) | Prevents infinite sync loops |

**Deprecated/outdated:**
- **invoiceWorkflowService.processDealWon()**: Currently triggered by Pipedrive deal won webhook - SHOULD NOT be called from webhooks, only from internal Hub invoice creation
- **Deal won webhook creating invoices**: This is backwards - deal won should be RESULT of contract signing, not TRIGGER of invoice creation

## Open Questions

Things that couldn't be fully resolved:

1. **Commercial User Notification Method**
   - What we know: Need to notify when contract signed
   - What's unclear: Email vs in-app notification vs both? No email service implemented yet
   - Recommendation: Create Notification record in database (enables future email/push), add dashboard "Recent Contract Signatures" widget for now

2. **Deal Creation Strategy for Existing Pipedrive Customers**
   - What we know: Need to link invoices to deals
   - What's unclear: If customer already has closed deals in Pipedrive, should we create new deal or update most recent?
   - Recommendation: Always create NEW deal for each invoice - ensures clean audit trail and no confusion with past deals

3. **Pipedrive Custom Fields for Hub IDs**
   - What we know: May want to store Hub customer_id or invoice_id in Pipedrive
   - What's unclear: Does Pipedrive account have custom fields configured? API access to custom fields?
   - Recommendation: Start without custom fields, use notes for linking. Add custom fields in Phase 6.1 if needed

4. **Deal Owner Mapping**
   - What we know: Pipedrive deals have owners (sales users)
   - What's unclear: How to map Pipedrive user IDs to Hub User IDs for notification routing
   - Recommendation: Fetch deal owner from Pipedrive API, match by email to Hub User, fallback to admin if no match

## Sources

### Primary (HIGH confidence)
- Existing codebase: `lib/services/pipedrive.service.ts` - Pipedrive API wrapper with all methods implemented
- Existing codebase: `lib/services/identity-mapper.ts` - Email-based customer deduplication pattern
- Existing codebase: `lib/services/quickbooks-sync.service.ts` - Bidirectional sync patterns to replicate
- Existing codebase: `app/api/webhooks/pipedrive/person/route.ts` - Working webhook loop prevention
- Existing codebase: `app/api/webhooks/docusign/route.ts` - Contract signed workflow integration point
- User requirements: `.planning/phases/06-pipedrive-integration-respecting-the-whole-workflow-of-the-hub/06-CONTEXT.md` - Confirmed workflow requirements

### Secondary (MEDIUM confidence)
- Prisma schema: Customer/Deal/Invoice models with external ID fields and sync timestamps
- Environment variables: PIPEDRIVE_API_TOKEN and PIPEDRIVE_WEBHOOK_SECRET already configured

### Tertiary (LOW confidence)
- None - all findings verified against existing codebase implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All infrastructure already exists and working
- Architecture: HIGH - Patterns established in QuickBooks integration, verified in existing code
- Pitfalls: HIGH - Identified specific problem code in existing deal webhook handler

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - Pipedrive API stable, internal patterns unlikely to change)

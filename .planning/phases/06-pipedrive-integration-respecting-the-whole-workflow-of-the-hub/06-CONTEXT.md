# Phase 6 Context: Pipedrive Integration Respecting the Whole Workflow

## Phase Goal

Integrate Pipedrive CRM with the Hub's complete workflow, ensuring QuickBooks remains the source of truth for financial data while Pipedrive manages lead/deal lifecycle.

## User-Confirmed Workflow Requirements

### 1. Lead Entry (Pipedrive → Hub)
- Leads/Persons created in Pipedrive sync to Hub
- **Match by email** with existing QuickBooks customers
- If customer exists in QB → link to Pipedrive person
- If new → create as Lead in Hub (not QB customer yet)

### 2. Customer Creation (Hub → Pipedrive & QuickBooks)
- **Commercial creates customer in Hub** → sync to BOTH:
  - QuickBooks (create customer)
  - Pipedrive (create person)
- Email-based deduplication using Identity Mapper

### 3. Invoice Creation (Hub/QuickBooks Priority)
- Commercial creates invoice in Hub with all financial details (amount, installments, due dates)
- If customer has linked Pipedrive person → **Update Pipedrive Deal** with invoice amount
- Invoice sent → Contract auto-triggers (Phase 5 workflow)
- **QuickBooks is source of truth for finances** (no sync from Pipedrive to QB)

### 4. Contract Signed (Hub → Pipedrive)
- Contract signed in DocuSign → Webhook to Hub
- Hub marks **Deal as WON** in Pipedrive
- Hub displays **notification to Commercial** that contract was signed
- Optionally add note to Pipedrive deal with signed contract link

### 5. Bidirectional Sync (Ongoing)
- **Customer Info**: Pipedrive Person ↔ Hub Customer ↔ QuickBooks Customer
- **Contract Status**: Hub → Pipedrive (signed/declined/expired)
- **NO invoice financial details sync** from Pipedrive (QuickBooks owns this)

## Key Architectural Decisions

1. **Email is the universal identifier** (Identity Mapper pattern from Phase 1)
2. **QuickBooks is source of truth for finances** - Pipedrive deals follow invoices, not create them
3. **Hub is the orchestration layer** - all workflows flow through Hub
4. **Existing Phase 5 workflow intact** - Invoice → 7min delay → Contract (no changes)

## Existing Infrastructure

### Already Implemented
- `lib/services/pipedrive.service.ts` - Basic Pipedrive API wrapper
- `lib/services/pipedrive-sync.service.ts` - Sync service
- `app/api/webhooks/pipedrive/deal/route.ts` - Deal webhook (currently triggers invoice workflow - WRONG)
- `app/api/webhooks/pipedrive/lead/route.ts` - Lead webhook
- `app/api/webhooks/pipedrive/person/route.ts` - Person webhook
- `lib/services/identity-mapper.ts` - Email-based customer deduplication

### Needs Modification
- **Deal webhook**: Currently tries to create invoice when deal won - should be OPPOSITE (invoice creates/updates deal)
- **Person webhook**: May need enhancement for QB customer matching
- **Invoice creation**: Should update Pipedrive deal amount

### Needs Creation
- Commercial notification system for signed contracts
- Dashboard notification UI
- Customer creation sync to both QB + Pipedrive

## Success Criteria

- [ ] Leads from Pipedrive appear in Hub and match with QB customers by email
- [ ] Commercial can create customer in Hub → syncs to QB + Pipedrive
- [ ] Invoice creation updates linked Pipedrive deal amount
- [ ] Signed contract marks Pipedrive deal as WON
- [ ] Commercial sees notification when contract is signed
- [ ] No duplicate customers across systems (email-based dedup)
- [ ] QuickBooks financial data never overwritten by Pipedrive

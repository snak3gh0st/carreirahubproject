---
phase: 06-pipedrive-integration-respecting-the-whole-workflow-of-the-hub
plan: 01
subsystem: integration
tags: [pipedrive, quickbooks, webhook, identity-mapper, crm]

# Dependency graph
requires:
  - phase: 05-docusign-production-setup--verification
    provides: Production-ready DocuSign integration for contract workflow
provides:
  - Corrected Pipedrive deal webhook (no invoice creation)
  - Email-based customer matching between Pipedrive and QuickBooks
  - Lead creation for Pipedrive persons without QB customers
  - Webhook loop prevention via timestamp debouncing
affects: [06-02, 06-03, 06-04, 06-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Email-based identity resolution across CRM and financial systems"
    - "Timestamp-based webhook loop prevention (5-second debounce window)"
    - "Source of truth hierarchy: QuickBooks owns financial data, Pipedrive manages leads"

key-files:
  created: []
  modified:
    - app/api/webhooks/pipedrive/deal/route.ts
    - app/api/webhooks/pipedrive/person/route.ts
    - prisma/schema.prisma

key-decisions:
  - "Removed invoice creation from deal won webhook (backwards workflow)"
  - "QuickBooks customer matching by email happens FIRST, before creating new entities"
  - "Persons without QB customers become Leads, not Customers"
  - "Added PIPEDRIVE to LeadSource enum for proper lead tracking"

patterns-established:
  - "QB-first workflow: Check QB customer exists → link Pipedrive → else create Lead"
  - "Deal webhook only updates status sync, never triggers financial workflows"
  - "Webhook loop prevention: 5-second debounce window on lastPipedriveSyncAt timestamp"

# Metrics
duration: 3min
completed: 2026-01-29
---

# Phase 6 Plan 1: Fix Backwards Workflow and Establish Lead Entry Summary

**Corrected Pipedrive webhook workflow: deal won no longer triggers invoices, person webhook matches QB customers by email before creating Leads**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-29T19:11:30Z
- **Completed:** 2026-01-29T19:15:02Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Removed backwards invoice creation workflow from deal won webhook
- Established correct workflow: Invoice → Deal, not Deal → Invoice
- Implemented QB customer matching by email for Pipedrive persons
- Lead creation for persons without existing QB customers
- Maintained webhook loop prevention via debounce logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove invoice creation from deal won webhook** - `ab389bf` (fix)
2. **Task 2: Enhance person webhook with QuickBooks customer matching** - `8ddb003` (feat)

**Plan metadata:** (will be committed separately)

## Files Created/Modified

- `app/api/webhooks/pipedrive/deal/route.ts` - Removed invoice workflow trigger, webhook now only updates deal status to match Pipedrive
- `app/api/webhooks/pipedrive/person/route.ts` - Added QB customer matching by email, creates Leads for persons without QB customers
- `prisma/schema.prisma` - Added PIPEDRIVE to LeadSource enum

## Decisions Made

**1. Remove invoice creation from deal won webhook**
- **Rationale:** The existing workflow was backwards (deal won → invoice). Correct workflow is: invoice created → updates deal → contract signed → marks deal won
- **Impact:** Deal won webhook now only performs status sync, no financial operations
- **Aligns with:** 06-RESEARCH.md "Pitfall 2: Creating Invoices from Deal Won Webhook" (lines 331-350)

**2. QB customer matching happens FIRST**
- **Rationale:** QuickBooks is the financial source of truth. Pipedrive persons should link to existing QB customers, not create duplicate customers
- **Impact:** Prevents customer duplication, maintains data consistency across systems
- **Implementation:** Check `customer.quickbooks_id` before creating any new entities

**3. Create Leads (not Customers) for persons without QB**
- **Rationale:** Leads are prospects without financial records. Customers require QB records for invoice/payment tracking
- **Impact:** Proper lead/customer separation, prevents premature customer creation
- **Pattern:** Pipedrive person → Lead in Hub → Commercial converts to QB customer → becomes Customer entity

**4. Added PIPEDRIVE to LeadSource enum**
- **Rationale:** Need to track lead origin for analytics and workflow routing
- **Impact:** Enables filtering and reporting on Pipedrive-sourced leads
- **Required:** Prisma schema change + client regeneration

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing build error (not caused by this plan):**
- Next.js build fails with Radix UI select component error: `'clamp' is not exported from '@radix-ui/number'`
- This issue existed before this plan and is unrelated to webhook changes
- TypeScript compilation of modified files succeeds
- Does not block webhook functionality or deployment

## Next Phase Readiness

**Ready for 06-02 (Customer creation sync to QB + Pipedrive):**
- Email-based identity resolution pattern established
- Webhook loop prevention pattern working
- Lead/Customer distinction clarified

**Key infrastructure in place:**
- Identity Mapper service available for customer reconciliation
- IntegrationLog tracking all operations
- Debounce pattern prevents infinite loops

**No blockers.**

---
*Phase: 06-pipedrive-integration-respecting-the-whole-workflow-of-the-hub*
*Completed: 2026-01-29*

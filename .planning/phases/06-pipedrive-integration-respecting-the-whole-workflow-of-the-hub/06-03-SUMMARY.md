---
phase: 06-pipedrive-integration-respecting-the-whole-workflow-of-the-hub
plan: 03
subsystem: integration
tags: [pipedrive, crm, invoice, deal-sync, workflow]

# Dependency graph
requires:
  - phase: 06-02
    provides: Customer creation sync to QB + Pipedrive
provides:
  - Invoice → Pipedrive deal sync workflow
  - Auto-create deal if customer has Pipedrive person but no deal
  - Deal value updates from invoice amounts
affects: [06-04, 06-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fire-and-forget pattern for Pipedrive sync (non-blocking)
    - Upsert pattern to prevent deal creation race conditions
    - Graceful degradation when Pipedrive unavailable

key-files:
  created: []
  modified:
    - lib/services/invoice-workflow.service.ts
    - app/api/invoices/create/route.ts

key-decisions:
  - "Auto-create Pipedrive deal if customer has pipedrive_id but no linked deal"
  - "Sync only first invoice in series (not all installments)"
  - "Fire-and-forget pattern - Pipedrive sync failures don't block invoice creation"
  - "Use upsert pattern to prevent race conditions during deal creation"

patterns-established:
  - "Invoice → Deal sync: Invoice drives deal updates, not vice versa"
  - "QuickBooks as financial source of truth: Pipedrive reflects Hub/QB data"

# Metrics
duration: 6 min
completed: 2026-01-29
---

# Phase 06 Plan 03: Invoice Creation → Pipedrive Deal Update Summary

**Invoice creation now triggers Pipedrive deal updates with auto-creation, graceful degradation, and fire-and-forget async execution**

## Performance

- **Duration:** 6 min
- **Started:** 2026-01-29T19:21:25Z
- **Completed:** 2026-01-29T19:28:11Z
- **Tasks:** 3/3
- **Files modified:** 2

## Accomplishments

- Implemented `syncInvoiceToPipedriveDeal` method in InvoiceWorkflowService
- Auto-creates Pipedrive deal if customer has pipedrive_id but no existing deal
- Updates existing deal values when invoices created
- Adds notes to Pipedrive deals with invoice details
- Fire-and-forget execution doesn't block invoice creation API responses
- Graceful handling of customers without Pipedrive IDs and Pipedrive API failures

## Task Commits

Each task was committed atomically:

1. **Task 1: Create syncInvoiceToPipedriveDeal method** - `d0e48d9` (feat)
2. **Task 2: Add createDeal and updateDeal methods to Pipedrive service** - No commit (methods already existed)
3. **Task 3: Trigger Pipedrive sync after invoice creation** - `eae6a3d` (feat)

**Plan metadata:** (to be committed after summary)

## Files Created/Modified

- `lib/services/invoice-workflow.service.ts` - Added syncInvoiceToPipedriveDeal method (127 new lines)
- `app/api/invoices/create/route.ts` - Added Pipedrive sync trigger after invoice creation

## Decisions Made

**1. Auto-create vs update-only strategy**
- Decision: Auto-create Pipedrive deal if customer has pipedrive_id but no linked deal
- Rationale: Commercial may create invoice without first creating deal in Pipedrive. Auto-creating ensures Pipedrive always reflects financial reality.
- Impact: Pipedrive deals will be created automatically for any invoice where customer has a Pipedrive person

**2. Sync only first invoice in series**
- Decision: For installment invoices, sync only the first invoice to Pipedrive
- Rationale: Deal value represents total contract value, not individual installments
- Impact: Reduces Pipedrive API calls, keeps deal value at contract level

**3. Fire-and-forget execution pattern**
- Decision: Use async catch pattern without await for Pipedrive sync
- Rationale: Invoice creation should not be blocked by Pipedrive API availability
- Impact: Faster API responses, graceful degradation, failures logged but non-blocking

**4. Upsert pattern for deal creation**
- Decision: Use Prisma upsert instead of separate find + create
- Rationale: Prevents race conditions when webhook and sync operation run simultaneously
- Impact: Atomic database operations, no duplicate deals with same pipedrive_deal_id

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all existing Pipedrive service methods were already implemented with correct signatures.

## Next Phase Readiness

**Ready for 06-04:** Notification infrastructure and Pipedrive markDealAsWon

**Workflow established:**
- Lead Entry: Pipedrive → Hub (06-01) ✓
- Customer Creation: Hub → QB + Pipedrive (06-02) ✓
- Invoice Creation: Hub/QB → Pipedrive deal update (06-03) ✓
- Next: Contract Signed → Deal Won + Notifications (06-04, 06-05)

**No blockers:** All dependencies satisfied, Pipedrive service fully operational.

---
*Phase: 06-pipedrive-integration-respecting-the-whole-workflow-of-the-hub*
*Completed: 2026-01-29*

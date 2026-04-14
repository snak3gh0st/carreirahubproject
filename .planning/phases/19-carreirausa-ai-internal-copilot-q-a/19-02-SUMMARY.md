---
phase: 19-carreirausa-ai-internal-copilot-q-a
plan: "02"
subsystem: ai-tools
tags: [ai, tools, rbac, prisma, quickbooks, docusign, dto]
dependency_graph:
  requires: [lib/ai/tools/_base, lib/ai/types, lib/ai/dto/index, lib/db, lib/services/quickbooks.service, lib/services/docusign.service, prisma/schema.prisma]
  provides: [lib/ai/tools/index (toolRegistry 20 tools), lib/ai/tools/finance/*, lib/ai/tools/students/*, lib/ai/tools/leads/*, lib/ai/tools/contracts/*, lib/ai/tools/ops/*, lib/ai/tools/meta/*, lib/ai/tools/utility/*]
  affects: [plan 19-03 (chat route wraps this registry), plans 19-04 and 19-05]
tech_stack:
  added: []
  patterns: [defineAiTool helper, requireRole defense-in-depth, DTO sanitizers, 20s external timeout with Promise.race, IntegrationLog audit trail for QB+DocuSign]
key_files:
  created:
    - lib/ai/tools/finance/get-invoices.ts
    - lib/ai/tools/finance/get-overdue-invoices.ts
    - lib/ai/tools/finance/get-payments-timeline.ts
    - lib/ai/tools/finance/get-quickbooks-report.ts
    - lib/ai/tools/students/get-students-by-phase.ts
    - lib/ai/tools/students/get-student-profile.ts
    - lib/ai/tools/students/get-student-sessions.ts
    - lib/ai/tools/students/get-student-next-actions.ts
    - lib/ai/tools/leads/get-leads-by-status.ts
    - lib/ai/tools/leads/get-lead-qualification.ts
    - lib/ai/tools/leads/get-leads-by-source.ts
    - lib/ai/tools/contracts/get-contracts.ts
    - lib/ai/tools/contracts/get-document-status.ts
    - lib/ai/tools/ops/get-daily-action-view.ts
    - lib/ai/tools/ops/get-coordinator-overview.ts
    - lib/ai/tools/meta/list-capabilities.ts
    - lib/ai/tools/meta/explain-data-model.ts
    - lib/ai/tools/meta/get-current-date.ts
    - lib/ai/tools/utility/search-customers.ts
    - lib/ai/tools/utility/search-students.ts
  modified:
    - lib/ai/tools/index.ts
    - tests/ai/tools.test.ts
    - tests/ai/rbac.test.ts
    - tests/ai/chat-route.test.ts
decisions:
  - "getStudentsByPhase filters via currentPhase: { key: phaseKey } (nested where) because MentorshipEnrollment uses currentPhaseId FK, not a currentPhaseKey column"
  - "get-payments-timeline uses prisma.payment.findMany (not invoice) since Payment is the financial transaction model"
  - "Tests require POSTGRES_PRISMA_URL env var at CLI invocation — process.env set in ESM test body is hoisted-past by tsx; env must come from shell"
  - "QuickBooks/DocuSign service circuit breakers emit benign DB warnings in test output (catch-and-continue) — not test failures"
  - "getCoordinatorOverview uses in-memory phase grouping (findMany + reduce) to avoid can-not-use-include-and-select-together Prisma constraint"
  - "IntegrationLog.response field does not exist — QB report stored in payload JSON instead"
metrics:
  duration_minutes: 7
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 20
  files_modified: 4
requirements:
  - AI-CORE-03
  - AI-CORE-04
  - AI-CORE-11
---

# Phase 19 Plan 02: AI Tool Registry — 20 Copilot Tools Summary

**One-liner:** 20 AI copilot tools implemented with PT-BR descriptions, Zod input schemas, RBAC gates, DTO sanitizers, and QB/DocuSign live-service tools with 20s timeouts — registry is the sole data I/O surface for Plan 03's chat route.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Implement 18 Postgres-only tools (Finance/Students/Leads/Contracts/Ops/Meta/Utility) | 852acac | 18 new tool files, updated test files |
| 2 | Implement 2 live-service tools (QB + DocuSign), finalize registry to 20, update tests | bc25284 | get-quickbooks-report.ts, get-document-status.ts, index.ts |

## What Was Built

### All 20 Tools

**Finance (ADMIN + FINANCE):**
- `getInvoices` — list invoices by status/customer, returns count + totalAmount + DTOs
- `getOverdueInvoices` — filter by dueDate < cutoff and status in OPEN/OVERDUE
- `getPaymentsTimeline` — payment history with invoice + customer joins
- `getQuickBooksReport` — dispatches to 4 QB report methods (P&L, cashflow, balance, AR aging), 20s timeout, IntegrationLog

**Students (ADMIN + OPERATIONAL + SUPPORT):**
- `getStudentsByPhase` — enrollments filtered by currentPhase.key + status=ACTIVE
- `getStudentProfile` — full enrollment with transitions, sessions, open invoice count
- `getStudentSessions` — session history ordered by sessionDate desc
- `getStudentNextActions` — SLA calc (7 days/phase), returns overdue flag + suggestedNextAction PT-BR string

**Leads (ADMIN + SALES + SDR):**
- `getLeadsByStatus` — leads with latest qualification score
- `getLeadQualification` — lead + rubric (criteria JSON from LeadQualification model)
- `getLeadsBySource` — aggregation by source within N days

**Contracts (ADMIN + FINANCE):**
- `getContracts` — contracts by status/customer via ContractStatus enum
- `getDocumentStatus` — live DocuSign envelope status, 20s timeout, IntegrationLog

**Ops (ADMIN + OPERATIONAL [+SUPPORT for daily]):**
- `getDailyActionView` — SLA bucket grouping (overdue/warning/onTrack) matching Phase 17 logic
- `getCoordinatorOverview` — aggregate counts by phase (in-memory groupBy) + by status

**Meta (all 7 roles):**
- `listCapabilities` — introspects toolRegistry filtered to ctx.user.role
- `explainDataModel` — static PT-BR markdown per entity (leads/students/invoices/contracts/deals)
- `getCurrentDate` — ISO + PT-BR formatted in America/New_York timezone

**Utility:**
- `searchCustomers` (ADMIN + SALES + FINANCE) — case-insensitive name/email search
- `searchStudents` (ADMIN + OPERATIONAL + SUPPORT) — enrollment search via customer join

### RBAC Role Coverage (verified by tests)

| Role | Tools | Names |
|------|-------|-------|
| ADMIN | 20 | All |
| FINANCE | 10 | 4 finance + 2 contracts + searchCustomers + 3 meta |
| SALES | 7 | 3 leads + searchCustomers + 3 meta |
| SDR | 6 | 3 leads + 3 meta |
| SUPPORT | 9 | 4 students + getDailyActionView + searchStudents + 3 meta |
| OPERATIONAL | varies | 4 students + 2 ops + searchStudents + 3 meta |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MentorshipEnrollment has no currentPhaseKey column**
- **Found during:** Task 1 — getStudentsByPhase spec said `where: { currentPhaseKey: phaseKey }`
- **Issue:** Schema uses `currentPhaseId` (FK) not `currentPhaseKey`. The MentorshipPhase model has the `key` field.
- **Fix:** Used Prisma nested filter `currentPhase: { key: phaseKey }` which traverses the relation correctly
- **Files modified:** `lib/ai/tools/students/get-students-by-phase.ts`
- **Commit:** 852acac

**2. [Rule 1 - Bug] IntegrationLog model has no `response` field**
- **Found during:** Task 2 — `npx tsc --noEmit` revealed `response` does not exist on IntegrationLogCreateInput
- **Issue:** Plan's canonical code template used `response:` but schema only has `payload` and `error` fields
- **Fix:** Moved QB report data into `payload` JSON as `{ startDate, endDate, report: truncateJson(report) }`
- **Files modified:** `lib/ai/tools/finance/get-quickbooks-report.ts`
- **Commit:** bc25284

**3. [Rule 1 - Bug] Prisma cannot use both `include` and `select` on findMany**
- **Found during:** Task 1 — `npx tsc --noEmit` on getCoordinatorOverview
- **Issue:** Initial code had both `include: { currentPhase }` and `select: { id, currentPhase }` — Prisma rejects this
- **Fix:** Removed redundant `select`, kept only `include: { currentPhase: { select: { key, label } } }`
- **Files modified:** `lib/ai/tools/ops/get-coordinator-overview.ts`
- **Commit:** 852acac

**4. [Rule 1 - Bug] ESM import hoisting breaks process.env assignment in test files**
- **Found during:** Task 1/2 — tests failed with `PrismaClientConstructorValidationError: Invalid value undefined for datasource "db"`
- **Issue:** `process.env.POSTGRES_PRISMA_URL = '...'` in ESM test files is hoisted past by tsx's import resolution; env must be set at shell/CLI level
- **Fix:** Removed in-file env assignments; documented that tests must be run as `POSTGRES_PRISMA_URL='...' npx tsx --test ...`. Run command for CI: `POSTGRES_PRISMA_URL='postgresql://test:test@localhost:5432/test?pgbouncer=true' npx tsx --test tests/ai/...`
- **Files modified:** tests/ai/tools.test.ts, tests/ai/rbac.test.ts, tests/ai/chat-route.test.ts
- **Commit:** 852acac

## Verification Results

- `find lib/ai/tools -name '*.ts' -not -name '_base.ts' -not -name 'index.ts' | wc -l` → **20**
- `grep -rn "defineAiTool" lib/ai/tools/ | wc -l` → **41** (20 tool definitions + index re-exports)
- `grep -rn "requireRole(ctx.user.role" lib/ai/tools/ | wc -l` → **20** (every handler has defense in depth)
- `npx tsc --noEmit` → **PASS (zero type errors)**
- `npx tsx --test tests/ai/tools.test.ts tests/ai/rbac.test.ts tests/ai/chat-route.test.ts` → **38/38 PASS**

## Known Stubs

None — all 20 tools are fully implemented. Handlers that call QB/DocuSign services will return `{ error: "..." }` gracefully when external APIs are unavailable (circuit breakers + catch blocks).

## Self-Check: PASSED

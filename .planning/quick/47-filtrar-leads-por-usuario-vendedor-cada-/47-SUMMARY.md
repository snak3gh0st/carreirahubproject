---
phase: quick-47
plan: 01
subsystem: leads
tags: [rbac, filtering, sales, prisma, api, dashboard]
dependency_graph:
  requires: []
  provides: [lead-visibility-by-role]
  affects: [app/api/leads/route.ts, app/dashboard/leads/page.tsx, prisma/schema.prisma, lib/services/lead.service.ts]
tech_stack:
  added: []
  patterns: [role-based-where-clause, createdById-ownership, server-session-filter]
key_files:
  created: []
  modified:
    - prisma/schema.prisma
    - lib/services/lead.service.ts
    - app/api/leads/route.ts
    - app/dashboard/leads/page.tsx
decisions:
  - "Use createdById (optional) on Lead to preserve backward compatibility — existing leads without an owner remain visible to ADMIN/SDR"
  - "SALES-only filter applied at both API layer (GET /api/leads) and page layer (dashboard/leads) for defence-in-depth"
  - "Pipeline groupBy also filtered so counts reflect only leads visible to the user"
metrics:
  duration: 2 minutes
  completed: 2026-02-23
  tasks_completed: 2
  files_modified: 4
---

# Quick Task 47: Filtrar Leads por Vendedor (SALES) — Summary

**One-liner:** Role-based lead visibility — SALES users see only their own leads via createdById ownership field with filtered findMany/count/groupBy.

## Objective

Each SALES user should only see the leads they personally created. ADMIN and SDR continue to see all leads without restriction.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add createdById to schema and LeadService | b68337f | prisma/schema.prisma, lib/services/lead.service.ts |
| 2 | Apply vendor filter in API and dashboard page | dd18afd | app/api/leads/route.ts, app/dashboard/leads/page.tsx |

## What Was Built

### Task 1 — Schema and Service Changes

**`prisma/schema.prisma`**
- Added `createdById String?` field to Lead model
- Added `createdBy User? @relation("CreatedLeads", ...)` relation on Lead
- Added `createdLeads Lead[] @relation("CreatedLeads")` relation on User
- Added `@@index([createdById])` for query performance
- Ran `db:push` to sync with Neon database (migration applied successfully)

**`lib/services/lead.service.ts`**
- Added `createdById?: string` to `CreateLeadData` interface
- Persists `createdById` in `prisma.lead.create`
- Added `createdById?: string` to `listLeads` filters
- Applied `where.createdById = filters.createdById` when filter provided

### Task 2 — API and Dashboard Filtering

**`app/api/leads/route.ts`**
- `GET`: Reads `getServerSession`, extracts role and userId; passes `createdById: userId` to `listLeads` when `role === "SALES"`; ADMIN/SDR receive no createdById filter
- `POST`: Reads session userId and passes `createdById: userId` to `createLead` so every manually created lead is attributed to its creator

**`app/dashboard/leads/page.tsx`**
- Builds `whereClause = userRole === "SALES" ? { createdById: userId } : {}`
- Applies `whereClause` to `prisma.lead.findMany`, `prisma.lead.count`, and `prisma.lead.groupBy` (pipeline)
- Ensures pagination count and status pipeline cards reflect only visible leads

## Verification Results

1. `npm run db:push` — completed without errors, schema in sync
2. `npm run build` — TypeScript compiled successfully, no new errors
3. `createdById` present in schema.prisma (3 occurrences)
4. `createdById` filter in lead.service.ts listLeads
5. `route.ts` passes `createdById` in POST and filters in GET for SALES
6. `page.tsx` uses `whereClause` in findMany, count, and groupBy

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] prisma/schema.prisma — createdById field and index present
- [x] lib/services/lead.service.ts — createdById in interface and where clause
- [x] app/api/leads/route.ts — createdById saved on POST, filtered on GET
- [x] app/dashboard/leads/page.tsx — whereClause applied to all queries
- [x] Commit b68337f — Task 1
- [x] Commit dd18afd — Task 2
- [x] Build passed without TypeScript errors

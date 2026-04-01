# Phase 17: Daily Action View + Coordinator Overview - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two new Ops Hub pages:
1. `/ops/daily` — Daily Action View: each ops team member sees only their assigned students flagged for attention (SLA expiring ≤2 days OR no session in ≥7 days). Coordinator (ADMIN) sees all students across all team members unfilitered.
2. `/ops/coordinator` — Coordinator Overview: ADMIN-only page with the full flagged student list (same logic as daily, no assignee filter), phase distribution table, and students with overdue QB balances.

Both pages integrate into the existing Ops Hub layout, sidebar nav, and NextAuth session/role system.

</domain>

<decisions>
## Implementation Decisions

### Route Architecture
- Daily action view: new `/ops/daily` page (clean separation, dedicated URL, bookmarkable)
- Coordinator overview: new `/ops/coordinator` page (ADMIN-only)
- Coordinator metrics (phase distribution + overdue QB): on the same `/ops/coordinator` page below the flagged list
- Sidebar nav entries: "Daily Actions" for all ADMIN|OPERATIONAL users; "Coordinator" only visible when role=ADMIN

### SLA & Flag Logic
- Default SLA per phase: 7 calendar days (conservative per STATE.md decision; calibrate after 2-4 weeks real usage)
- When a student triggers BOTH flags (SLA expiring + no recent session): show both badge reasons, highlight SLA as more urgent
- SLA thresholds stored in named constants: `lib/constants/sla.ts` (per STATE.md: "SLA thresholds as named constants")
- Session check: latest `SessionLog.createdAt` across all session log entries for the enrollment

### UI Design — Daily Action View
- Flagged student row: compact list row (name, phase, flag badge, days remaining/overdue, direct profile link)
- Flag badge colors: Red for SLA expiring, Amber for no recent session
- Empty state: "Tudo certo hoje! ✓" green success banner
- Header stat: "X alunos precisam de atenção" count at the top of the list

### Coordinator Overview
- Phase distribution: reuse table pattern from ops home page (phase label + count column)
- QB overdue definition: `qbBalance > 0` (field already on Customer model)
- React Query polling: `useQuery` with `refetchInterval: 60_000` on coordinator page only
- Coordinator access: ADMIN role only — OPERATIONAL users have sidebar link hidden; server-side redirect if accessed directly

### Claude's Discretion
- Exact Portuguese labels for new sidebar entries and page headings
- API route structure for daily action endpoint (`/api/ops/daily` or similar)
- How to handle the case where `assignedTo` is null for an enrollment (likely exclude from per-user daily view, include in coordinator view)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/ops/pipeline/StudentCard.tsx` — existing student card (too heavy for daily view, but reference for data shape)
- `app/ops/pipeline/PipelineBoard.tsx` — pattern for fetching and rendering enrollment data
- `app/api/ops/pipeline/route.ts` — reference API route with full enrollment+transitions+assignedTo+customer include
- `app/ops/page.tsx` — ops home with phase distribution table (reuse pattern for coordinator metrics section)
- `components/ops/ops-sidebar.tsx` — sidebar to extend with new nav entries

### Established Patterns
- Server components for data fetching (see `app/ops/page.tsx`, `app/ops/pipeline/`)
- `getServerSession(authOptions)` for role checks in layouts and API routes
- Role guard: `if (role !== "ADMIN" && role !== "OPERATIONAL") redirect("/")` pattern
- Brand colors: `text-brand-verde`, `bg-brand-verde`, `border-gray-200`, `rounded-2xl`
- Font: `font-display font-bold` for headings, `font-display font-semibold` for subheadings
- Prisma: `qbBalance` field on Customer, `SessionLog` model with `createdAt`, `MentorshipEnrollment` with `assignedTo` relation

### Integration Points
- Ops sidebar: add "Daily Actions" (all users) and "Coordinator" (ADMIN only) nav entries
- Ops layout: no changes needed — new pages inherit layout automatically
- `SessionLog` model: already exists (built in Phase 16), use `createdAt` for last session date
- `MentorshipEnrollment.assignedToId`: filter for current user's daily view; omit filter for coordinator view

</code_context>

<specifics>
## Specific Ideas

- SLA threshold constant: `SLA_DAYS_PER_PHASE = 7` and `SLA_WARNING_DAYS = 2` in `lib/constants/sla.ts`
- Flag types: `"sla_expiring"` and `"no_recent_session"` — student can have both simultaneously
- Daily view page title: "Ações do Dia" (Portuguese, consistent with hub language)
- Coordinator page title: "Visão do Coordenador"
- Phase transition `createdAt` on the most recent transition = phase start date for SLA calculation

</specifics>

<deferred>
## Deferred Ideas

- WhatsApp/Slack notifications for flagged students — explicitly v1.3 per STATE.md
- Per-phase configurable SLA thresholds (e.g., Bastão=14 days, Renovação=30 days) — calibrate after real usage
- Export/CSV of flagged students list — not in scope
- Email digest of daily actions — not in scope for Phase 17

</deferred>

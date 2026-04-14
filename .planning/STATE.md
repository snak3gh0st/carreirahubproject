---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Brand Identity Reskin
status: verifying
stopped_at: Completed 19-carreirausa-ai-internal-copilot-q-a-05-PLAN.md
last_updated: "2026-04-14T19:55:04.218Z"
last_activity: 2026-04-14
progress:
  total_phases: 22
  completed_phases: 21
  total_plans: 68
  completed_plans: 69
  percent: 80
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core value:** Give the Carreira USA support team a single operational workspace to track every student's journey phase, replacing ClickUp as the team's hub.

**Current focus:** Phase 19 — carreirausa-ai-internal-copilot-q-a

## Current Position

Phase: 19 (carreirausa-ai-internal-copilot-q-a) — EXECUTING
Plan: 5 of 5
Status: Phase complete — ready for verification
Last activity: 2026-04-14 - Completed quick task 260414-oco: Wire the forms to the operacional hub correctly

```
Progress: [████████░░] 80% (4/5 phases)
```

## Performance Metrics

**Velocity:**

- Total plans completed: 29
- Average duration: 16 minutes
- Total execution time: 7 hours 53 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. QuickBooks Foundation | 1/1 | 150 min | 150 min |
| 1.1. Dashboard Enhancement | 4/4 | 42 min | 11 min |
| 4.1. Deployment Ready | 3/3 | 35 min | 12 min |
| 3. Finance Workflow Automation | 2/2 | 103 min | 52 min |
| 4. Insights (BI & Analytics) | 3/3 | 60 min | 20 min |
| 2. DocuSign Integration | 4/4 | 14 min | 4 min |
| 5. DocuSign Production Setup | 2/2 | 12 min | 6 min |
| 6. Pipedrive Integration | 5/5 | 19 min | 3.8 min |
| 9. Professional UI/UX Enhancement | 5/5 | 64 min | 13 min |

**Recent Trend:** Stable — last 5 plans averaged 4-13 min each
| Phase 10-token-font-foundation P01 | 3 | 2 tasks | 26 files |
| Phase 10-token-font-foundation P02 | 4 | 2 tasks | 3 files |
| Phase 11 P01 | 7 min | 3 tasks | 6 files |
| Phase 11 P02 | 1 min | 2 tasks | 5 files |
| Phase 11 P03 | 2 min | 2 tasks | 3 files |
| Phase 11 P04 | 5 min | 2 tasks | 5 files |
| Phase 11 P05 | 5 min | 2 tasks | 6 files |
| Phase 13-cefr-english-proficiency-test-engine P01 | 4 | 2 tasks | 10 files |
| Phase 13-cefr-english-proficiency-test-engine P02 | 4 | 2 tasks | 4 files |
| Phase 13-cefr-english-proficiency-test-engine P03 | 4 | 2 tasks | 9 files |
| Phase 14-data-foundation P01 | 3 | 2 tasks | 3 files |
| Phase 14 P02 | 3 | 1 tasks | 1 files |
| Phase 14-data-foundation P03 | 4 | 2 tasks | 3 files |
| Phase 14 P04 | 8 | 3 tasks | 4 files |
| Phase 14-data-foundation P04 | 8 | 4 tasks | 4 files |
| Phase 15-pipeline-board P01 | 2 | 2 tasks | 3 files |
| Phase 15-pipeline-board P02 | 3 | 2 tasks | 7 files |
| Phase 15-pipeline-board P03 | 5 | 2 tasks | 0 files |
| Phase 17-daily-action-view-coordinator-overview P01 | 15 | 2 tasks | 5 files |
| Phase 17-daily-action-view-coordinator-overview P02 | — | 2 tasks | — |
| Phase 17 P02 | 12 | 2 tasks | 4 files |
| Phase 18-client-surveys-intake-and-nps-forms P01 | 4 | 2 tasks | 3 files |
| Phase 18-client-surveys-intake-and-nps-forms P02 | 3 | 3 tasks | 4 files |
| Phase 18-client-surveys-intake-and-nps-forms P03 | 4 | 2 tasks | 2 files |
| Phase 19-carreirausa-ai-internal-copilot-q-a P01 | 4 | 2 tasks | 14 files |
| Phase 19-carreirausa-ai-internal-copilot-q-a P02 | 7 | 2 tasks | 24 files |
| Phase 19 P03 | 5 | 2 tasks | 7 files |
| Phase 19-carreirausa-ai-internal-copilot-q-a P04 | 5 | 2 tasks | 13 files |
| Phase 19-carreirausa-ai-internal-copilot-q-a P05 | 9 | 2 tasks | 8 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- **v1.1 Brand Reskin**: Blaak (serif display) + Neue Montreal (sans body) — match official brand identity guidelines
- **v1.1 Brand Reskin**: Self-host brand fonts via next/font — OTF files bundled in project, no external font CDN
- **v1.1 Brand Reskin**: Brand reskin over full redesign — preserve working layouts, minimize risk, faster delivery
- **v1.1 Token Architecture**: Three-layer CSS custom property system (primitives → semantic → portal overrides)
- **v1.1 Token Architecture**: Tangerina (#FF8142) fails WCAG AA on white/Creme — only valid on dark surfaces or as non-text accent
- **v1.1 Hub Risk**: 74 hardcoded hex literals across 16 hub files will not cascade from config changes — explicit migration required
- **v1.1 Chart Risk**: 129 hardcoded Recharts hex values won't respond to CSS — need `lib/constants/chart-colors.ts` JS constants
- [Phase 10-token-font-foundation]: Self-hosted fonts via next/font/local — OTF files committed to repo, no external font CDN
- [Phase 10-token-font-foundation]: Three-layer CSS token hierarchy established: brand primitives -> semantic aliases -> portal overrides
- [Phase 10-token-font-foundation]: Brand color tint scales are approximate — verify via tints.dev before Phase 11 ships UI
- [Phase 10-token-font-foundation]: Token @import lines placed before @tailwind base in globals.css — ensures CSS custom properties are defined before Tailwind base styles resolve them
- [Phase 10-token-font-foundation]: body uses font-sans antialiased class (Tailwind) rather than inter.className — cleaner separation between font variable injection (html) and usage (body)
- [Phase 10-token-font-foundation]: Brand token Tailwind utilities are additive — all Phase 9 colors preserved intact
- [Phase 11]: Two-tone Logo by default with mono prop for monochrome contexts — Preserves brand fidelity while supporting dark backgrounds (sidebar) and light backgrounds (hub header)
- [Phase 13-cefr-english-proficiency-test-engine]: Question bank stored as TypeScript constant arrays (not DB) — developer-authored content, version-controlled, type-safe, zero DB overhead
- [Phase 13-cefr-english-proficiency-test-engine]: 60% pass threshold (Math.ceil(count * 0.6)) replaces hardcoded 3/5 — supports variable question counts per section
- [Phase 13-cefr-english-proficiency-test-engine]: Backward-compatible schema defaults: questionIds String[] @default([]), questionCount Int @default(25)
- [Phase 13-cefr-english-proficiency-test-engine]: Reading comprehension passages paired as two questions per passage — enables single passage load with two test items for B1/B2 sections
- [Phase 13-cefr-english-proficiency-test-engine]: C2 targets near-native subtleties: academic hedging, moot/begging-the-question vocab, rhetorical device identification, dangling/misplaced modifiers
- [Phase 13-cefr-english-proficiency-test-engine]: totalScore=-1 as pending sentinel — avoids nullable field, reuses existing Int column
- [Phase 13-cefr-english-proficiency-test-engine]: Update-not-create on submit — preserves pending record with questionIds for exact scoring
- [Phase 13-cefr-english-proficiency-test-engine]: questionCount||25 fallback — backward compatible with pre-Plan 01 test records
- **v1.2 Data Model**: MentorshipPhase stored as a lookup table (key, label, sortOrder) — not a Prisma enum — to avoid untransactable ALTER TYPE migrations during phase renames
- **v1.2 Data Model**: MentorshipEnrollment anchored to existing Customer identity — no parallel Student entity to avoid reintroducing the deduplication problem
- **v1.2 Architecture**: Ops Hub at /ops/* with ADMIN | OPERATIONAL role gates following the same NextAuth middleware pattern as the Admin Dashboard
- **v1.2 Architecture**: Phase transitions always written as a Prisma $transaction pairing enrollment update + PhaseTransition log row — atomicity is non-negotiable
- **v1.2 Architecture**: Pipeline board uses single findMany with include and in-memory grouping — acceptable for under 500 students; add pagination from day one
- **v1.2 Architecture**: Daily action SLA thresholds defined as named constants — calibrate after 2-4 weeks of real Phase 14-16 usage, not before
- **v1.2 Scope**: WhatsApp sending, Google Calendar, and Pipedrive auto-enrollment are explicitly v1.3 — not in scope for any Phase 14-17 work
- **v1.2 DnD**: dnd-kit v6.3.1 + sortable v10.0.0 are the only stable React DnD libraries as of 2026 — react-beautiful-dnd is deprecated, @dnd-kit/react is pre-1.0 alpha
- [Phase 14-data-foundation]: Used npx tsx instead of ts-node for prisma seed — ts-node not installed, tsx already used by all project scripts
- [Phase 14-data-foundation]: String fields for programType/status (not Prisma enums) — avoids untransactable ALTER TYPE migrations per D-03
- [Phase 14-data-foundation]: Named relations TransitionFrom/TransitionTo on PhaseTransition — required by Prisma to disambiguate two FK refs to the same model
- [Phase 14-data-foundation]: MentorshipError extends Error with typed code field — API routes instanceof-check to map DUPLICATE_ENROLLMENT to 409 and INVALID_TRANSITION to 422
- [Phase 14-data-foundation]: RBAC enforces ADMIN|OPERATIONAL on all /api/ops/ routes — matches NextAuth middleware pattern
- [Phase 14]: Toast library: sonner v2.0.7 used for enrollment form feedback — already in package.json
- [Phase 14]: Assignable users: manual text input fallback in enrollment form — /api/dashboard/users endpoint does not exist yet
- [Phase 14-data-foundation]: Toast library: sonner v2.0.7 used for enrollment form feedback — already in package.json
- [Phase 14-data-foundation]: Enrollment form moved to /ops/enroll (not /dashboard/ops/enroll) to match Ops Hub portal route prefix
- [Phase 15-pipeline-board]: GET /api/ops/pipeline returns all phases unconditionally — assignee filter is client-side only
- [Phase 15-pipeline-board]: MentorshipError INVALID_TRANSITION maps to HTTP 422; other MentorshipError codes map to 400
- [Phase 15-pipeline-board]: Human verification approved — all 10 pipeline board checks passed, PIPE-03 confirmed complete
- [Phase 17]: SLA_DAYS_PER_PHASE=7 and SLA_WARNING_DAYS=2 as conservative defaults — calibrate after real usage
- [Phase 17-02]: Coordinator page puts all data in single CoordinatorQueryProvider — one polling query renders all three sections for simplicity
- [Phase 17-02]: Coordinator page uses single CoordinatorQueryProvider — one polling query renders all three sections for simplicity
- [Phase 18]: Reuse the existing FormAssignment/FormSubmission infrastructure — no new schema and no DB-backed template definitions
- [Phase 18]: NPS visibility lands on the student profile, not the coordinator dashboard; entry/exit templates share a single `npsScore` answer contract
- [Phase 18]: Intake auto-assignment must be duplicate-safe for re-enrollment scenarios (no second pending onboarding form)
- [Phase 18-client-surveys-intake-and-nps-forms]: NPS templates use existing scale field type with scaleMin:0 and scaleMax:10 — no custom nps field type introduced
- [Phase 18-client-surveys-intake-and-nps-forms]: NPS_SCORE_FIELD = 'npsScore' is the single score contract exported for all downstream NPS extraction
- [Phase 18-client-surveys-intake-and-nps-forms]: Ops assign route scoped to single customerId — simpler contract, UI assigns one form at a time
- [Phase 18-03]: FormsSection receives all data as props from parent query — no second page-level query
- [Phase 18-03]: Active template filtering via useMemo Set: templates in PENDING or IN_PROGRESS state hidden from dropdown
- [Phase 19-carreirausa-ai-internal-copilot-q-a]: Prisma singleton import is @/lib/db (not @/lib/prisma) — project uses lib/db.ts as single PrismaClient export
- [Phase 19-carreirausa-ai-internal-copilot-q-a]: Wave 0 tests run via npx tsx --test — tsx handles @/ alias resolution via tsconfig.json; plain node:test cannot resolve path aliases
- [Phase 19-carreirausa-ai-internal-copilot-q-a]: getStudentsByPhase filters via nested currentPhase: { key: phaseKey } — schema uses currentPhaseId FK not currentPhaseKey column
- [Phase 19-carreirausa-ai-internal-copilot-q-a]: Tests require POSTGRES_PRISMA_URL at CLI level — ESM imports are hoisted past process.env assignments in tsx test files
- [Phase 19]: Kill switch (AI_COPILOT_ENABLED) is first check in POST /ai/chat — before NextAuth getServerSession — so disabling the feature takes effect immediately even for unauthenticated probes
- [Phase 19]: session.user.role IS populated by NextAuth JWT callback — no extra DB lookup needed at request time; TypeScript requires cast to { id?: string; role?: string } since it's not in the default Session type
- [Phase 19]: estimateCostUSD in admin/usage uses AI_MODEL_DEFAULT env var (not hardcoded model) so cost estimates match deployed model configuration
- [Phase 19-carreirausa-ai-internal-copilot-q-a]: useChat body option + per-sendMessage options.body for dynamic context injection — avoids prepareSendMessagesRequest transport wrapper complexity in @ai-sdk/react v3
- [Phase 19-carreirausa-ai-internal-copilot-q-a]: ChatBubble only rendered for isTeamRole users — non-team users already have SupportChatBubble; prevents AI bubble appearing for external-facing users
- [Phase 19-carreirausa-ai-internal-copilot-q-a]: react-markdown@^10.1.0 + remark-gfm@^4.0.1 installed — were not in package.json; required for markdown rendering in MessageBubble
- [Phase 19]: Kill-switch test second case catches Next.js request-scope error — proves execution reached auth layer, not blocked by kill switch
- [Phase 19]: 16 PT-BR golden questions cover 5 domains; structural assertions validate tool registry references at test time (no live model calls)

### Roadmap Evolution

- Phase 13 added: CEFR English Proficiency Test Engine — scientifically validated placement test with randomized question bank (100-200+ questions, A1-C2), adaptive scoring, no-repeat guarantee
- Phases 14-17 added: v1.2 Ops Hub — Student Journey Management (2026-04-01)
- Phase 18 added: Client Surveys - Intake and NPS Forms (2026-04-03)
- Phases 19-21 added: v1.3 CarreiraUSA AI — Internal Suite (2026-04-14). Phase 19 = Q&A read-only copilot (design approved, spec at docs/superpowers/specs/2026-04-14-carreirausa-ai-internal-design.md). Phases 20 (Actions) and 21 (RAG) queued as stubs dependent on Phase 19.

### Blockers/Concerns

- **Logo assets**: Logo integration (Phase 11) requires compass/arrow SVG files from brand team. If unavailable before Phase 11, implement Logo.tsx with placeholder and merge paths as follow-up commit
- **Font licensing**: Confirm Blaak and Neue Montreal licenses permit self-hosted web embedding before committing OTF files to repository (Phase 10 blocker if restricted)
- **Exact color scale values**: Brand color stops in brand.css should be verified via tints.dev before shipping — approximated values are starting points only
- **Phase SLA thresholds (Phase 17)**: Exact days-per-phase values for the daily action view cannot be determined before Phase 14-16 are in production use — define conservative defaults (7 calendar days) and adjust after 2-4 weeks of real data

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260414-d0t | Add reusable email system using Resend | 2026-04-14 | 1437cb7 | — | [260414-d0t-add-reusable-email-system-using-resend](./quick/260414-d0t-add-reusable-email-system-using-resend/) |
| 260414-dg2 | Rebrand emails + 5 internal notification streams | 2026-04-14 | 2b8b767 | Verified ✓ | [260414-dg2-rebrand-emails-5-internal-notification-s](./quick/260414-dg2-rebrand-emails-5-internal-notification-s/) |
| 260414-mmm | Delete message button + AI compliance modal (termo de compromisso) | 2026-04-14 | 1b3f7f6 | — | [260414-mmm-preciso-ter-botao-de-delete-de-msg-e-com](./quick/260414-mmm-preciso-ter-botao-de-delete-de-msg-e-com/) |
| 260414-mud | Enrich AI Copilot with business context + getProcessGuide tool | 2026-04-14 | 8a1ddb6 | — | [260414-mud-enriquecer-ai-copilot-com-contexto-de-ne](./quick/260414-mud-enriquecer-ai-copilot-com-contexto-de-ne/) |
| 260414-ncs | Fix AI context overflow + rich UX loading states | 2026-04-14 | 9a0428f | — | [260414-ncs-fix-ai-context-overflow-ux-de-loading-re](./quick/260414-ncs-fix-ai-context-overflow-ux-de-loading-re/) |
| 260414-oco | Wire forms flow: IN_PROGRESS status + programType whitelist + ops UI hint | 2026-04-14 | 4e102f9 | — | [260414-oco-wire-the-forms-to-the-operacional-hub-co](./quick/260414-oco-wire-the-forms-to-the-operacional-hub-co/) |

## Session Continuity

Last session: 2026-04-14T20:35:00Z
Stopped at: Completed quick task 260414-oco: Wire forms flow IN_PROGRESS status + programType whitelist
Resume file: None
Next action: Manually verify Phase 18 flows and write 18-01/18-02/18-03 summaries

# Digisac Lifecycle Automations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send automatic Digisac WhatsApp messages for new operational lifecycle events: program welcome, form assignment, student-visible document availability, English-test phase readiness, and mentorship renewal reminders.

**Architecture:** Add one focused lifecycle service under `lib/ops` with fixed PT-BR templates, event dedupe through `IntegrationLog.payload.dedupeKey`, and best-effort sending that never blocks the primary enrollment/form/document/phase workflow. Integrate the service only at new-event write points; renewal cron uses an activation cutoff so existing backlog is not messaged automatically.

**Tech Stack:** Next.js App Router, Prisma, existing Digisac REST service, existing Ops Digisac thread/message storage, Node test runner with `tsx`.

---

## Task 1: Lifecycle Templates And Dedupe

**Files:**
- Create: `lib/ops/digisac-lifecycle.ts`
- Test: `tests/digisac-lifecycle.test.ts`

- [ ] Write failing tests for message templates, lifecycle enablement, renewal activation cutoff, and integration-log dedupe.
- [ ] Implement pure helpers and the injectable `sendDigisacLifecycleMessage` function.
- [ ] Verify `npx tsx --test tests/digisac-lifecycle.test.ts` passes.

## Task 2: Automated Message Storage Support

**Files:**
- Modify: `lib/ops/digisac-store.ts`
- Test: `tests/digisac-lifecycle.test.ts`

- [ ] Allow `storeOutboundDigisacMessage` to receive `sentById: null` for system-generated messages.
- [ ] Store automation metadata inside the raw Digisac payload wrapper.

## Task 3: Event Integrations

**Files:**
- Modify: `lib/services/mentorship.service.ts`
- Modify: `app/api/ops/forms/assign/route.ts`
- Modify: `app/api/dashboard/forms/assign/route.ts`
- Modify: `app/api/ops/enrollments/[id]/documents/route.ts`
- Modify: `app/api/cron/mentorship-renewals/route.ts`
- Modify: `.env.example`

- [ ] Send welcome after a new enrollment is created.
- [ ] Send form-assigned messages after new form assignments.
- [ ] Send document notifications only for `STUDENT_VISIBLE` documents.
- [ ] Send English-test readiness when a phase transition moves the enrollment into the English-test scheduling/testing phases.
- [ ] Send renewal reminders only for profiles created after the lifecycle automation activation date.

## Task 4: Verification

**Files:**
- All modified files

- [ ] Run focused tests: `npx tsx --test tests/digisac-lifecycle.test.ts`
- [ ] Run relevant regression tests: `npx tsx --test lib/services/digisac.service.test.ts tests/ops-renewal.test.ts tests/openai-lazy-init.test.ts`
- [ ] Run typecheck: `npx tsc --noEmit --pretty false`
- [ ] Check diff hygiene and preserve unrelated local Hub English/mock-interview changes.

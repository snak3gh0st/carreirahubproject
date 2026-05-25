# Internal AI Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize text-model routing so CarreiraUSA can reduce AI cost while preserving quality for high-value outputs.

**Architecture:** Add a small internal gateway that maps product tasks to default model tiers and env overrides. Keep OpenAI Realtime voice sessions outside this text-model gateway so official oral/mock/collection calls stay on `gpt-realtime-2`.

**Tech Stack:** Next.js App Router, OpenAI AI SDK, OpenAI Chat Completions, Prisma audit rows, `node:test` via `npx tsx --test`.

---

### Task 1: Gateway Model Resolver

**Files:**
- Create: `tests/ai/gateway.test.ts`
- Create: `lib/ai/gateway.ts`
- Modify: `lib/ai/model-selection.ts`
- Modify: `lib/ai/pricing.ts`

- [ ] Write failing tests for dashboard, persona, collection post-call analysis, high-quality report, env overrides, and legacy model normalization.
- [ ] Run `npx tsx --test tests/ai/gateway.test.ts tests/ai/model-selection.test.ts tests/ai/pricing.test.ts` and confirm the new gateway import fails.
- [ ] Implement `lib/ai/gateway.ts` and delegate `resolveDashboardAiModel` to it.
- [ ] Update pricing table for current GPT-5 mini/nano/default route costs.
- [ ] Re-run the tests and confirm they pass.

### Task 2: Wire Gateway Into Existing AI Calls

**Files:**
- Modify: `app/api/dashboard/ai/chat/route.ts`
- Modify: `lib/services/collection-call.service.ts`
- Modify: `.env.example`
- Modify: `README.md`

- [ ] Use gateway task `persona_analysis` when a persona is requested, otherwise `dashboard_copilot`.
- [ ] Use gateway task `collection_call_analysis` for post-call transcript analysis.
- [ ] Add env override names to `.env.example` and README.
- [ ] Run gateway, pricing, model-selection, collection voice, openai lazy-init, and TypeScript checks.

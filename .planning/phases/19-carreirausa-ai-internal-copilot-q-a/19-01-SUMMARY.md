---
phase: 19-carreirausa-ai-internal-copilot-q-a
plan: "01"
subsystem: ai-foundation
tags: [ai, prisma, sdk, foundation, tests]
dependency_graph:
  requires: []
  provides: [lib/ai/types, lib/ai/tools/_base, lib/ai/tools/index, lib/ai/rate-limit, lib/ai/logger, lib/ai/prompts/system.pt-br, lib/ai/prompts/context-builder, lib/ai/dto/index, AiConversation, AiMessage, AiRateLimit]
  affects: [plans 02-05 in phase 19]
tech_stack:
  added: [ai@6.x, "@ai-sdk/openai@3.x", "@ai-sdk/react@3.x"]
  patterns: [defineAiTool helper, RBAC tool registry, rolling-window rate limit, PT-BR system prompt, DTO sanitizers]
key_files:
  created:
    - lib/ai/types.ts
    - lib/ai/tools/_base.ts
    - lib/ai/tools/index.ts
    - lib/ai/rate-limit.ts
    - lib/ai/logger.ts
    - lib/ai/prompts/system.pt-br.ts
    - lib/ai/prompts/context-builder.ts
    - lib/ai/dto/index.ts
    - tests/ai/tools.test.ts
    - tests/ai/rbac.test.ts
    - tests/ai/chat-route.test.ts
  modified:
    - prisma/schema.prisma
    - package.json
    - package-lock.json
decisions:
  - "Prisma singleton is at lib/db.ts (not lib/prisma.ts) — rate-limit.ts imports from @/lib/db"
  - "Wave 0 tests run via npx tsx --test (not node --test) — @/ alias resolved by tsx via tsconfig.json"
  - "AiRateLimit uses userId as @id (PK) — one row per user, upsert-compatible"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 11
  files_modified: 3
requirements:
  - AI-CORE-01
  - AI-CORE-02
---

# Phase 19 Plan 01: AI Foundation — DB Schema + lib/ai/ Scaffold Summary

**One-liner:** Vercel AI SDK v6 installed, 3 Prisma AI tables migrated to Postgres, and `lib/ai/` foundation scaffolded with typed tool registry, rate limiter, PT-BR system prompt, DTO sanitizers, and 8/8 Wave 0 tests green.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Install AI SDK v6 + Prisma tables + generate client | 7b3191b | package.json, prisma/schema.prisma |
| 2 | Scaffold lib/ai/ foundation + Wave 0 tests | 53bf6dc | 11 new files in lib/ai/ and tests/ai/ |

## What Was Built

### Task 1 — AI SDK v6 + Prisma Schema
- Installed `ai@^6.0.159`, `@ai-sdk/openai@^3.0.53`, `@ai-sdk/react@^3.0.161` (coexists with `openai@^4.52.0`)
- Added `AiConversation`, `AiMessage`, `AiRateLimit` models + `AiMessageRole` enum to `prisma/schema.prisma`
- Added inverse relations `aiConversations AiConversation[]` and `aiRateLimit AiRateLimit?` to the `User` model
- Pushed schema to Postgres via `npm run db:push` — tables created in `carreirahub` DB
- Prisma client regenerated with all new accessors

### Task 2 — lib/ai/ Foundation + Wave 0 Tests
- `lib/ai/types.ts`: Core interfaces — `ToolContext`, `SafeInvoiceDto`, `SafeCustomerDto`, `SafeStudentDto`, `SafeLeadDto`, `SafeContractDto`
- `lib/ai/tools/_base.ts`: `defineAiTool<TArgs,TResult>()` helper + `AiToolDefinition` interface + `requireRole()` guard
- `lib/ai/tools/index.ts`: Empty `toolRegistry[]` + `allowedToolsForRole(role)` — Plan 02 will populate the registry
- `lib/ai/rate-limit.ts`: `checkRateLimit(userId, limitPerHour)` — 1-hour rolling window, DB-backed via `AiRateLimit` table
- `lib/ai/logger.ts`: `logAiEvent()` structured JSON logger (stdout)
- `lib/ai/prompts/system.pt-br.ts`: `buildSystemPrompt()` — PT-BR copilot persona, SOMENTE LEITURA mode, prompt-injection defense
- `lib/ai/prompts/context-builder.ts`: `buildPageContext()` + `currentDateInET()` for contextual prompts
- `lib/ai/dto/index.ts`: 5 DTO sanitizers (invoice, customer, student, lead, contract) + `truncateJson()` helper
- 3 Wave 0 test files — 8/8 tests pass via `npx tsx --test`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed prisma singleton import path in rate-limit.ts**
- **Found during:** Task 2 — `npx tsx --test tests/ai/chat-route.test.ts` failed with `Cannot find module '@/lib/prisma'`
- **Issue:** Plan specified `import { prisma } from '@/lib/prisma'` but the prisma singleton in this project lives at `lib/db.ts` (exports `prisma` from there)
- **Fix:** Changed import to `import { prisma } from '@/lib/db'`
- **Files modified:** `lib/ai/rate-limit.ts`
- **Commit:** 53bf6dc

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Prisma singleton import is `@/lib/db` not `@/lib/prisma` | Discovered via failing test — project uses `lib/db.ts` as the single PrismaClient export |
| Tests run via `npx tsx --test` (not `node --test`) | tsx handles `@/` alias resolution via tsconfig.json; plain node:test cannot resolve path aliases |
| `AiRateLimit.userId` as `@id` (primary key) | One row per user, simplifies upsert; avoids separate surrogate PK |

## Verification Results

- `npx prisma validate` — PASS
- `npx tsc --noEmit` — PASS (zero type errors)
- `npx tsx --test tests/ai/tools.test.ts tests/ai/rbac.test.ts tests/ai/chat-route.test.ts` — 8/8 PASS
- `node -e "new PrismaClient().aiConversation.findMany({take:0})"` — PASS (table reachable)

## Package Versions Installed

```
ai@6.3.17
@ai-sdk/openai@3.3.5
@ai-sdk/react@3.3.17
```

## Known Stubs

None — this plan creates foundation only. The `toolRegistry[]` is intentionally empty (Wave 0). Plan 02 populates it with 20 AI tools (AI-CORE-03).

## Self-Check: PASSED

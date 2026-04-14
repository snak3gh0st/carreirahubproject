---
phase: 260414-ncs
plan: 01
type: quick
subsystem: ai-copilot
tags: [ai, context-overflow, ux, quickbooks, loading-states]
dependency_graph:
  requires: []
  provides: [context-safe-ai-chat, compact-qb-report, rich-loading-ux]
  affects: [app/api/dashboard/ai/chat/route.ts, lib/ai/tools/finance/get-quickbooks-report.ts, components/ai/MessageList.tsx, components/ai/ToolCallCard.tsx]
tech_stack:
  added: []
  patterns: [message-truncation, report-summarization, in-flight-tool-detection]
key_files:
  created: []
  modified:
    - app/api/dashboard/ai/chat/route.ts
    - lib/ai/tools/finance/get-quickbooks-report.ts
    - components/ai/MessageList.tsx
    - components/ai/ToolCallCard.tsx
decisions:
  - "summarizeQbReport extracts structured summary (~300 tokens) for P&L; falls back to truncateJson(3KB) for other report types"
  - "detectInFlightTool only inspects last assistant message — sufficient because model processes one tool at a time per step"
  - "resolveToolMeta exported from ToolCallCard so MessageList shares same label map without duplication"
metrics:
  duration: 10 minutes
  completed: 2026-04-14
  tasks_completed: 3
  files_modified: 4
---

# Quick Task 260414-ncs: Fix AI Context Overflow + UX Loading States

**One-liner:** Resolved context_length_exceeded by switching to gpt-4o, truncating message history to 20, and compressing QB P&L from ~5000 tokens to ~300 tokens; added per-tool loading labels and improved ToolCallCard with PT-BR labels, icons, and status badges.

## What Was Done

### Task 1: Backend — Message truncation + QB report summarization

**`app/api/dashboard/ai/chat/route.ts`**

Before `convertToModelMessages(messages)`, added a hard cap:
```typescript
const recentMessages = messages.slice(-20);
const modelMessages = await convertToModelMessages(recentMessages);
```
This prevents context from growing unboundedly across long conversations regardless of model window.

**`lib/ai/tools/finance/get-quickbooks-report.ts`**

Added `summarizeQbReport(report, reportType)` that extracts the essential financial numbers from the raw QB P&L JSON structure:
- `income_total`, `expenses_total`, `net_income`
- `top_expenses` (top 10 by amount, sorted descending)
- `period` (start/end dates) and `currency`

**Payload size before/after:**
- Before: `truncateJson(report)` — raw QB JSON cut at 10KB (~5,000 tokens for a typical P&L)
- After: `summarizeQbReport(report, 'profit_and_loss')` — structured object (~300 tokens)

Non-P&L report types fall back to `truncateJson(report, 3_000)` (~750 tokens) as an intermediate improvement. The `IntegrationLog` payload is unchanged (still uses `truncateJson` for best-effort logging).

### Task 2: Env — Model upgrade to gpt-4o

Changed `.env.local` line 92:
```
# Before:
AI_MODEL_DEFAULT=gpt-4

# After:
AI_MODEL_DEFAULT=gpt-4o
```

**Root cause:** `gpt-4` has an 8K token context window. A single QB P&L response + system prompt + 5 turns of conversation easily exceeds this. `gpt-4o` has a 128K window and is ~3x cheaper per token.

**ACTION REQUIRED — Vercel environment variables:**
The `.env.local` file is gitignored and does not deploy. You must update the `AI_MODEL_DEFAULT` environment variable in the Vercel dashboard for both staging and production environments:

1. Go to Vercel project settings → Environment Variables
2. Find `AI_MODEL_DEFAULT`
3. Set value to `gpt-4o` (not `gpt-4`, not `gpt-4o-mini`)
4. Redeploy for the change to take effect

### Task 3: UX — Rich loading states + improved ToolCallCard

**`components/ai/ToolCallCard.tsx` (full rewrite)**

Added `TOOL_META` registry mapping all 18 tool names to:
- PT-BR friendly label (e.g. `'QuickBooks'`, `'Alunos'`, `'Busca de clientes'`)
- Lucide icon (DollarSign, GraduationCap, Users, FileText, Search, Info, LayoutDashboard)

Visual improvements:
- Friendly label + technical subtext (font-mono, small)
- `Loader2` spinner when tool is in-flight (result === undefined)
- `CheckCircle2` + "Concluído" green badge when tool has a result
- Expand/collapse behavior preserved

Exports `TOOL_META` and `resolveToolMeta` for reuse.

**`components/ai/MessageList.tsx`**

Added `detectInFlightTool(messages)` — inspects the last assistant message's parts array for a tool part that has no `output`/`result`/`state=result`. Returns the toolName or null.

Loading indicator:
```
Before: "Pensando..."  (static, no context)
After:  "Pesquisando quickbooks..."  (when getQuickBooksReport is running)
        "Pesquisando alunos..."       (when getStudentsByPhase is running)
        "Escrevendo resposta..."       (when streaming text, no tool in-flight)
```

## Commits

| Hash | Description |
|------|-------------|
| bea1740 | fix(260414-ncs): truncate message history + summarize QB P&L report |
| 9a0428f | feat(260414-ncs): rich loading states and improved ToolCallCard UX |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `app/api/dashboard/ai/chat/route.ts` contains `messages.slice(-20)` — confirmed
- `lib/ai/tools/finance/get-quickbooks-report.ts` contains `summarizeQbReport` — confirmed
- Tool handler returns `summary:` not `report:` for P&L — confirmed
- `components/ai/ToolCallCard.tsx` exports `TOOL_META` and `resolveToolMeta` — confirmed
- `components/ai/MessageList.tsx` contains `Pesquisando` and `detectInFlightTool` — confirmed
- `npx tsc --noEmit` passes with zero errors — confirmed
- `git log --oneline` shows both commits — confirmed (bea1740, 9a0428f)

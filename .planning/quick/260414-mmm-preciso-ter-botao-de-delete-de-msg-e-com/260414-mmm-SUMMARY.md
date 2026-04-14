---
phase: 260414-mmm-quick
plan: "01"
subsystem: ai-copilot
tags: [ai, compliance, ux, delete, trust, chat]
dependency_graph:
  requires: [Phase 19 AI Copilot — ChatBubble/ChatPanel/MessageBubble]
  provides: [per-message delete, compliance acceptance gate]
  affects: [components/ai/*, app/api/dashboard/ai/messages]
tech_stack:
  added: []
  patterns: [sessionStorage compliance gate, optimistic UI delete, ownership-checked DELETE endpoint]
key_files:
  created:
    - components/ai/ComplianceGate.tsx
    - app/api/dashboard/ai/messages/[id]/route.ts
  modified:
    - components/ai/MessageBubble.tsx
    - components/ai/MessageList.tsx
    - components/ai/ChatPanel.tsx
decisions:
  - ComplianceGate uses sessionStorage (not localStorage) so each new browser tab/session re-prompts per spec
  - Storage key uses -v1 suffix so future wording changes can invalidate acceptance by bumping version
  - Delete is optimistic — UI updates immediately; 404 on synthetic client-side IDs is acceptable (message already gone from UI)
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-14T20:22:29Z"
  tasks: 3
  files: 5
---

# Quick Task 260414-mmm: Message Delete Button + Compliance Gate Summary

**One-liner:** Per-message trash button with confirm() dialog and optimistic removal, plus a sessionStorage-gated "Termo de Compromisso" modal that blocks the AI Copilot until the internal user explicitly accepts terms each browser session.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | DELETE /api/dashboard/ai/messages/[id] | 8d665b2 | app/api/dashboard/ai/messages/[id]/route.ts |
| 2 | Wire delete button (MessageBubble/MessageList/ChatPanel) | 09fc077 | components/ai/MessageBubble.tsx, MessageList.tsx, ChatPanel.tsx |
| 3 | ComplianceGate modal + ChatPanel wrap | 511a72c | components/ai/ComplianceGate.tsx, ChatPanel.tsx |

## What Was Built

### DELETE /api/dashboard/ai/messages/[id]
- NextAuth session check — 401 if unauthenticated
- Ownership: looks up `AiMessage.conversation.userId` — 403 if mismatch
- Deletes the single `AiMessage` row; returns `{ ok: true }`
- Follows identical auth pattern as `conversations/[id]/route.ts`

### Per-Message Delete Button (MessageBubble)
- Trash2 icon (lucide-react) appears on `group-hover` with `opacity-0 → opacity-100` transition
- Assistant messages: delete button placed beside the Copy button in a flex row
- User messages: delete button placed below-right of the bubble
- `window.confirm('Remover esta mensagem?')` prompt before `onDelete()` invocation
- Only rendered when `onDelete` prop is provided (backward compatible)

### MessageList + ChatPanel Wiring
- `MessageList` accepts optional `onDeleteMessage?: (messageId: string) => void`
- Passes `onDelete` only for `text` parts (not `tool-*` parts)
- `ChatPanel.handleDeleteMessage`: optimistic `setMessages` filter first, then async `DELETE` fetch; logs error on failure without breaking UI

### ComplianceGate Modal
- Client component checking `sessionStorage` key `carreirausa-ai-compliance-accepted-v1`
- Returns `null` during hydration to prevent flash (state starts as `null`)
- PT-BR "Termo de Compromisso" modal with 4 LGPD/audit/usage bullets
- "Aceitar e continuar" writes to sessionStorage and reveals children
- `ChatPanel` return JSX wrapped in `<ComplianceGate>` — gates all UI (suggestions, composer, messages)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All functionality is fully wired:
- Delete button calls real API endpoint (optimistic UI with 404 graceful handling for client-side IDs)
- ComplianceGate writes/reads real sessionStorage
- No placeholder data

## Build Status

TypeScript compilation: clean (no new errors).

Pre-existing build failure in `ChatPanel.tsx` (lines 29, 63 — `@typescript-eslint/no-explicit-any` ESLint rule definition not found in project config) existed before this task and is unrelated. Verified by running build on the pre-task commit hash — identical failure.

## Self-Check: PASSED

Files exist:
- components/ai/ComplianceGate.tsx — FOUND
- app/api/dashboard/ai/messages/[id]/route.ts — FOUND
- components/ai/MessageBubble.tsx — FOUND (modified)
- components/ai/MessageList.tsx — FOUND (modified)
- components/ai/ChatPanel.tsx — FOUND (modified)

Commits exist:
- 8d665b2 — FOUND
- 09fc077 — FOUND
- 511a72c — FOUND

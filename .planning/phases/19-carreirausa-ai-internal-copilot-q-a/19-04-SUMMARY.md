---
phase: 19-carreirausa-ai-internal-copilot-q-a
plan: "04"
subsystem: ai-chat-ui
tags: [ai, chat, streaming, useChat, react-markdown, dashboard-ui, portal-separation, rbac]
dependency_graph:
  requires: [app/api/dashboard/ai/chat/route, app/api/dashboard/ai/conversations/route, app/api/dashboard/ai/conversations/[id]/route, app/api/dashboard/ai/admin/usage/route, app/dashboard/layout.tsx, lib/ai/suggestions-by-role]
  provides: [components/ai/ChatBubble, components/ai/ChatPanel, components/ai/MessageList, components/ai/MessageBubble, components/ai/ToolCallCard, components/ai/Composer, components/ai/Suggestions, components/ai/ConversationSidebar, app/dashboard/ai/page, app/dashboard/ai/admin/page, lib/ai/suggestions-by-role]
  affects: [plan 19-05 (hardening + tests consume these components)]
tech_stack:
  added: [react-markdown@^10.1.0, remark-gfm@^4.0.1]
  patterns: [useChat (@ai-sdk/react v3 — sendMessage({ text }) API), body injection via sendMessage second arg options.body, useEffect+fetch (no swr) for conversation list, useSession role-gating on admin page]
key_files:
  created:
    - components/ai/ChatBubble.tsx
    - components/ai/ChatPanel.tsx
    - components/ai/MessageList.tsx
    - components/ai/MessageBubble.tsx
    - components/ai/ToolCallCard.tsx
    - components/ai/Composer.tsx
    - components/ai/Suggestions.tsx
    - components/ai/ConversationSidebar.tsx
    - app/dashboard/ai/layout.tsx
    - app/dashboard/ai/page.tsx
    - app/dashboard/ai/admin/page.tsx
    - lib/ai/suggestions-by-role.ts
  modified:
    - app/dashboard/layout.tsx
decisions:
  - "useChat body option used for static extra fields; dynamic pathname/conversationId injected via sendMessage second arg options.body — avoids re-creating the hook on every pathname change"
  - "react-markdown@^10.1.0 installed — was not in package.json; remark-gfm@^4.0.1 added for table/strikethrough support in PT-BR responses"
  - "swr not used — useEffect+fetch sufficient for one-time conversation list load in ConversationSidebar"
  - "ChatBubble mounted only for isTeamRole (ADMIN|SALES|SDR|FINANCE|SUPPORT|OPERATIONAL) — support chat bubble already handles non-team users; no AI bubble for external-facing users"
  - "ChatBubble hides on /dashboard/ai via usePathname startsWith guard — avoids two overlapping chat surfaces on the AI full-screen page"
  - "Admin usage page uses client-side ADMIN check + router.replace('/dashboard') — consistent with existing ops-hub admin gating pattern; API route enforces ADMIN-only 403 independently"
  - "ConversationSidebar uses groupByDate with 4 PT-BR labels: Hoje/Ontem/Esta semana/Mais antigas — per design spec and plan spec"
metrics:
  duration_minutes: 5
  completed_date: "2026-04-14"
  tasks_completed: 2
  files_created: 12
  files_modified: 1
requirements:
  - AI-CORE-01
  - AI-CORE-02
  - AI-CORE-06
  - AI-CORE-10
  - AI-CORE-12
---

# Phase 19 Plan 04: Chat UI — ChatBubble, Full-Screen Page, Admin Usage Dashboard Summary

**One-liner:** 8 client components + 3 Next.js pages — floating ChatBubble on all /dashboard/* routes, full-screen /dashboard/ai conversation page with sidebar, and ADMIN-only usage KPI dashboard using @ai-sdk/react useChat v3 streaming.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | ChatBubble + ChatPanel + message rendering + mount in layout | 31ae1a8 | 8 new component files, app/dashboard/layout.tsx, package.json |
| 1.5 | checkpoint:human-verify | auto-approved | — |
| 2 | /dashboard/ai page + /dashboard/ai/admin page + ConversationSidebar | 69776a3 | 4 new files |
| 3 | checkpoint:human-verify (end-to-end) | auto-approved | — |

## What Was Built

### components/ai/ChatBubble.tsx

Floating 56x56 primary-colored button fixed at bottom-right. Opens a 400x600px panel overlay. Features:
- Hides on `/dashboard/ai` (pathname guard via `usePathname`)
- Hides when `NEXT_PUBLIC_AI_COPILOT_VISIBLE=false`
- Maximize icon links to `/dashboard/ai`
- Only mounted for `isTeamRole` users in dashboard layout

### components/ai/ChatPanel.tsx

Shared streaming chat panel used by both bubble and full-screen page:
- `useChat({ api: '/api/dashboard/ai/chat', body: {...} })` from `@ai-sdk/react`
- Dynamic body (conversationId, pathname, params) injected per `sendMessage` call
- Loads existing conversation via `GET /api/dashboard/ai/conversations/[id]` on mount when `conversationId` prop is set
- Empty state: welcome message + role-specific suggestion chips
- Filled state: `MessageList` with streaming indicator

### components/ai/MessageBubble.tsx

Renders user messages (plain text, whitespace-pre-wrap) and assistant messages (ReactMarkdown + remark-gfm). Copy button appears on hover for assistant messages.

### components/ai/ToolCallCard.tsx

Collapsible card for tool-call parts in AI SDK v6 messages. Shows tool name, collapsible args + result in pre-formatted JSON.

### components/ai/Composer.tsx

Textarea composer: Enter sends, Shift+Enter inserts newline, 4000 char hard cap, character counter displayed.

### components/ai/Suggestions.tsx

Renders suggestion chip pills from `getSuggestionsForRole()`. Clicks `sendMessage`.

### components/ai/ConversationSidebar.tsx

Fetches `GET /api/dashboard/ai/conversations` on mount. Groups conversations into Hoje/Ontem/Esta semana/Mais antigas. Selected conversation highlighted. "+ Nova conversa" button resets to new chat.

### app/dashboard/ai/page.tsx

Full-screen chat: `ConversationSidebar` (left 256px) + `ChatPanel` (flex-1 right). `key={selectedId ?? 'new'}` forces ChatPanel remount on conversation switch.

### app/dashboard/ai/admin/page.tsx

ADMIN-only (redirects to `/dashboard` for other roles). Fetches `GET /api/dashboard/ai/admin/usage`. Renders:
- 4 KPI cards: Messages today, Cost today, Messages 30d, Cost 30d
- Top 10 users table (email, role, conversations)
- Top 10 tools table (toolName, calls)
- Recent errors table (when, tool, error message)

### lib/ai/suggestions-by-role.ts

`getSuggestionsForRole(role)` returns 3-4 PT-BR suggestions per role:
- ADMIN: faturas, alunos, leads, faturamento
- FINANCE: vencidas, recebimento, contratos, P&L
- SALES/SDR: leads qualificados, Meta, conversão, busca
- OPERATIONAL: alunos por fase, daily action, atrasados, coordenador
- SUPPORT: busca, sessões, próximas ações, tickets
- default: capabilities, date, data model

### app/dashboard/layout.tsx modification

Added `import { ChatBubble }` and `{isTeamRole && <ChatBubble />}` as the last child of the root div. Only team operators (ADMIN|SALES|SDR|FINANCE|SUPPORT|OPERATIONAL) get the AI bubble — non-team users already have the SupportChatBubble.

## @ai-sdk/react v3 — useChat Body Injection

The installed version (`@ai-sdk/react@3.0.161`) exposes the `body` option on `useChat` for static extra fields. For dynamic per-message injection of `pathname` and `params`, `sendMessage` accepts a second options arg: `sendMessage({ text }, { body: { conversationId, pathname, params } })`. This avoids recreating the hook on every pathname change.

**`prepareSendMessagesRequest`** (plan's first-choice approach) is available via `HttpChatTransportInitOptions` and requires constructing a `DefaultChatTransport` instance. The simpler `body` prop + per-sendMessage `options.body` was used instead — same result, less ceremony.

## Portal Separation Verification

- Zero imports of `/api/hub`, `hub-token`, or hub auth in any `components/ai/` file
- ChatBubble only mounted in `app/dashboard/layout.tsx` (not root layout, not hub layout)
- Portal separation per CLAUDE.md: preserved completely

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing dependency] react-markdown not in package.json**
- **Found during:** Task 1 — `MessageBubble.tsx` imports `react-markdown` and `remark-gfm` per plan spec; neither was installed
- **Fix:** `npm install react-markdown remark-gfm` — added `react-markdown@^10.1.0` and `remark-gfm@^4.0.1` to dependencies
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 31ae1a8

**2. [Rule 1 - Adaptation] prepareSendMessagesRequest not needed — simpler body injection used**
- **Found during:** Task 1 — the plan noted "confirm exact prop name from @ai-sdk/react v6"; investigation showed `prepareSendMessagesRequest` requires a `DefaultChatTransport` wrapper; `body` static prop + `sendMessage(msg, { body: {...} })` per-call injection achieves identical behavior more simply
- **Fix:** Used `useChat({ body: {...} })` + `sendMessage(msg, { body: {...} })` pattern
- **Files modified:** `components/ai/ChatPanel.tsx`
- **Commit:** 31ae1a8

**3. [Rule 1 - Adaptation] ChatBubble only rendered for isTeamRole users**
- **Found during:** Task 1 — dashboard layout already had `SupportChatBubble` for `!isTeamRole`; mounting AI bubble unconditionally would render it for external-facing non-team users who already have the support bubble
- **Fix:** `{isTeamRole && <ChatBubble />}` — team operators get AI bubble, others keep support bubble
- **Files modified:** `app/dashboard/layout.tsx`
- **Commit:** 31ae1a8

## Known Stubs

None — all components are fully wired. ConversationSidebar fetches real conversation list. ChatPanel loads real message history when conversationId provided. Admin page fetches real usage data.

## Human Verification Status

Both checkpoints auto-approved in --auto mode. Manual browser verification deferred to operator at next deployment.

## Self-Check: PASSED

---
phase: quick
plan: 041
subsystem: support
tags: [ai, chat, support, tickets, openai, pt-br]
dependency-graph:
  requires: []
  provides: [support-chat-system, ai-chat-widget, ticket-management]
  affects: []
tech-stack:
  added: []
  patterns: [ai-chat-with-escalation, polling-based-realtime, floating-widget]
key-files:
  created:
    - lib/prompts/support-chat.ts
    - lib/services/support-chat.service.ts
    - app/api/support/chat/route.ts
    - app/api/support/tickets/route.ts
    - app/api/support/tickets/[id]/route.ts
    - app/api/support/tickets/[id]/messages/route.ts
    - components/support/support-chat-bubble.tsx
    - components/support/support-chat-widget.tsx
    - components/support/ticket-list.tsx
    - components/support/ticket-chat-view.tsx
    - app/dashboard/support/page.tsx
    - app/dashboard/support/[id]/page.tsx
  modified:
    - prisma/schema.prisma
    - app/dashboard/layout.tsx
    - components/dashboard/professional-sidebar.tsx
decisions:
  - AI responds with [ESCALATE:true/false] flag parsed from response for escalation detection
  - Keyword-based escalation as first check before AI call for instant escalation
  - Polling-based updates (5s chat widget, 10s ticket list) instead of WebSockets
  - Non-team users see floating chat bubble, team users see /dashboard/support
metrics:
  duration: 7 min
  completed: 2026-02-06
---

# Quick Task 041: User Support Chat with AI Escalation Summary

**One-liner:** AI-powered support chat with floating widget for users and ticket management dashboard for Sigma team, with keyword and AI-based escalation to human agents.

## What Was Built

### Schema (SupportTicket + SupportMessage)
- `SupportTicket` model with status flow: AI_HANDLING -> ESCALATED -> IN_PROGRESS -> RESOLVED -> CLOSED
- `SupportMessage` model with USER/AI/AGENT roles
- Priority levels (LOW/MEDIUM/HIGH/URGENT)
- Relations to User model for ticket ownership and agent assignment

### Support Chat Service
- AI-powered responses using OpenAI with PT-BR support prompt
- Dual escalation detection: keyword matching (instant) + AI recommendation (parsed from response)
- Auto-generated ticket subjects from first message
- Graceful fallback when OpenAI API key is missing

### API Routes
- `POST /api/support/chat` - Send message, get AI response, create ticket if needed
- `GET /api/support/tickets` - List tickets (user's own or all for team roles)
- `GET /api/support/tickets/[id]` - Ticket detail with messages
- `PATCH /api/support/tickets/[id]` - Update status (users can escalate, team can resolve/close)
- `POST /api/support/tickets/[id]/messages` - Agent replies (team only)

### User Chat Widget
- Floating gold bubble (bottom-right) for non-team users
- Slide-up chat panel with message history
- Messages styled by role: USER (gold), AI (gray), AGENT (green with "Equipe Sigma" label)
- "Falar com um Humano" escalation button
- 5-second polling for new messages
- Welcome screen with "Iniciar Conversa" button

### Team Dashboard
- `/dashboard/support` - Ticket list with filter tabs (Todos/Escalados/Em Andamento/Resolvidos)
- `/dashboard/support/[id]` - Full chat view with reply input and user info sidebar
- "Resolver Ticket" button for closing tickets
- 10-second polling for new tickets
- Suporte link in sidebar for ADMIN/SUPPORT/OPERATIONAL roles

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Schema + Service + API routes | 0fd7b3e | prisma/schema.prisma, lib/services/support-chat.service.ts, app/api/support/ |
| 2 | User chat widget + Team dashboard UI | 91dd325 | components/support/, app/dashboard/support/, layout.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
